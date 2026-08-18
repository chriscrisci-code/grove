create type public.billing_plan as enum ('free', 'plus');

create type public.subscription_status as enum (
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid'
);

create table public.billing_settings (
  id boolean primary key default true check (id = true),
  preview_mode boolean not null default true,
  active_story_cooldown interval not null default interval '30 days',
  updated_at timestamptz not null default now()
);

insert into public.billing_settings (id, preview_mode)
values (true, true)
on conflict (id) do nothing;

create table public.user_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.billing_plan not null default 'free',
  subscription_status public.subscription_status not null default 'none',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  active_workspace_id uuid references public.workspaces(id) on delete set null,
  active_workspace_changed_at timestamptz,
  active_workspace_grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_billing_active_workspace_idx
on public.user_billing (active_workspace_id);

alter table public.billing_settings enable row level security;
alter table public.user_billing enable row level security;

create policy "Authenticated users can view billing settings"
on public.billing_settings for select
to authenticated
using (true);

create policy "Users can view their billing state"
on public.user_billing for select
to authenticated
using (user_id = auth.uid());

create trigger user_billing_touch_updated_at
before update on public.user_billing
for each row execute function public.touch_updated_at();

create or replace function public.user_effective_plan(check_user_id uuid)
returns public.billing_plan
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(
      (select preview_mode from public.billing_settings where id = true),
      true
    ) then 'plus'::public.billing_plan
    when exists (
      select 1
      from public.user_billing
      where user_id = check_user_id
        and plan = 'plus'
        and subscription_status in ('active', 'trialing')
    ) then 'plus'::public.billing_plan
    else 'free'::public.billing_plan
  end;
$$;

create or replace function public.workspace_is_editable(check_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        public.user_effective_plan(workspaces.owner_id) = 'plus'
        or user_billing.active_workspace_id = workspaces.id
      from public.workspaces
      left join public.user_billing
        on user_billing.user_id = workspaces.owner_id
      where workspaces.id = check_workspace_id
    ),
    false
  );
$$;

create or replace function public.caller_can_edit_workspace(
  check_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      public.workspace_role_for(check_workspace_id)::text,
      ''
    ) in ('owner', 'editor')
    and public.workspace_is_editable(check_workspace_id);
$$;

create or replace function public.caller_can_create_workspace()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      public.user_effective_plan(auth.uid()) = 'plus'
      or not exists (
        select 1
        from public.workspaces
        where owner_id = auth.uid()
      )
    );
$$;

create or replace function public.get_my_billing_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    else jsonb_build_object(
      'effectivePlan', public.user_effective_plan(auth.uid()),
      'previewMode', coalesce(
        (select preview_mode from public.billing_settings where id = true),
        true
      ),
      'activeWorkspaceId', (
        select active_workspace_id
        from public.user_billing
        where user_id = auth.uid()
      ),
      'activeWorkspaceChangedAt', (
        select active_workspace_changed_at
        from public.user_billing
        where user_id = auth.uid()
      ),
      'nextActiveSwitchAt', (
        select case
          when active_workspace_grace_until >= now() then null
          else active_workspace_changed_at
            + coalesce(
              (
                select active_story_cooldown
                from public.billing_settings
                where id = true
              ),
              interval '30 days'
            )
          end
        from public.user_billing
        where user_id = auth.uid()
          and public.user_effective_plan(auth.uid()) = 'free'
      ),
      'activeSelectionGraceUntil', (
        select active_workspace_grace_until
        from public.user_billing
        where user_id = auth.uid()
          and public.user_effective_plan(auth.uid()) = 'free'
      )
    )
  end;
$$;

create or replace function public.set_active_free_workspace(
  workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing_row public.user_billing%rowtype;
  cooldown interval;
  next_switch timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.workspaces
    where id = workspace_id
      and owner_id = auth.uid()
  ) then
    raise exception 'Only the story owner can make it active';
  end if;

  insert into public.user_billing (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select *
  into billing_row
  from public.user_billing
  where user_id = auth.uid()
  for update;

  if billing_row.active_workspace_id = workspace_id then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  if public.user_effective_plan(auth.uid()) = 'plus' then
    update public.user_billing
    set active_workspace_id = workspace_id,
        active_workspace_changed_at = null
    where user_id = auth.uid();

    return jsonb_build_object('ok', true, 'changed', true);
  end if;

  select coalesce(active_story_cooldown, interval '30 days')
  into cooldown
  from public.billing_settings
  where id = true;

  cooldown := coalesce(cooldown, interval '30 days');
  next_switch := billing_row.active_workspace_changed_at + cooldown;

  if coalesce(billing_row.active_workspace_grace_until, '-infinity') < now()
    and billing_row.active_workspace_changed_at is not null
    and now() < next_switch then
    raise exception 'Your Active Free Story can be changed again on %',
      to_char(next_switch, 'Mon DD, YYYY');
  end if;

  update public.user_billing
  set active_workspace_id = workspace_id,
      active_workspace_changed_at = now()
  where user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'changed', true,
    'nextActiveSwitchAt', now() + cooldown
  );
end;
$$;

-- Stripe will call this service-only function when Plus access actually ends.
-- The seven-day selection grace period lets the writer reconsider which story
-- should stay editable before the normal 30-day switch limit takes effect.
create or replace function public.begin_free_plan(check_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fallback_workspace_id uuid;
begin
  select id
  into fallback_workspace_id
  from public.workspaces
  where owner_id = check_user_id
  order by updated_at desc, created_at desc
  limit 1;

  insert into public.user_billing (
    user_id,
    plan,
    subscription_status,
    active_workspace_id,
    active_workspace_changed_at,
    active_workspace_grace_until
  )
  values (
    check_user_id,
    'free',
    'canceled',
    fallback_workspace_id,
    now(),
    now() + interval '7 days'
  )
  on conflict (user_id) do update
  set plan = 'free',
      subscription_status = 'canceled',
      active_workspace_id = excluded.active_workspace_id,
      active_workspace_changed_at = excluded.active_workspace_changed_at,
      active_workspace_grace_until = excluded.active_workspace_grace_until;

  return fallback_workspace_id;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from auth.users
  where id = auth.uid();
end;
$$;

revoke all on function public.user_effective_plan(uuid) from public;
revoke all on function public.workspace_is_editable(uuid) from public;
revoke all on function public.caller_can_edit_workspace(uuid) from public;
revoke all on function public.caller_can_create_workspace() from public;
revoke all on function public.get_my_billing_state() from public;
revoke all on function public.set_active_free_workspace(uuid) from public;
revoke all on function public.begin_free_plan(uuid) from public;
revoke all on function public.delete_my_account() from public;

grant execute on function public.user_effective_plan(uuid) to authenticated;
grant execute on function public.workspace_is_editable(uuid) to authenticated;
grant execute on function public.caller_can_edit_workspace(uuid) to authenticated;
grant execute on function public.caller_can_create_workspace() to authenticated;
grant execute on function public.get_my_billing_state() to authenticated;
grant execute on function public.set_active_free_workspace(uuid) to authenticated;
grant execute on function public.begin_free_plan(uuid) to service_role;
grant execute on function public.delete_my_account() to authenticated;

insert into public.user_billing (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

update public.user_billing
set active_workspace_id = most_recent.id,
    active_workspace_changed_at = null,
    active_workspace_grace_until = null
from (
  select distinct on (owner_id)
    owner_id,
    id
  from public.workspaces
  order by owner_id, updated_at desc, created_at desc
) as most_recent
where user_billing.user_id = most_recent.owner_id
  and user_billing.active_workspace_id is null;

create or replace function public.create_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.user_billing (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('My Story', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.pages (workspace_id, title, created_by)
  values (new_workspace_id, 'Welcome to Grove', new.id);

  update public.user_billing
  set active_workspace_id = new_workspace_id,
      active_workspace_changed_at = null,
      active_workspace_grace_until = null
  where user_id = new.id;

  return new;
end;
$$;

create or replace function public.create_workspace(
  project_name text,
  project_description text default null,
  project_genre text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  clean_name text := trim(project_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_billing (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  perform 1
  from public.user_billing
  where user_id = auth.uid()
  for update;

  if not public.caller_can_create_workspace() then
    raise exception 'Grove Free includes one story. Upgrade to create another.';
  end if;
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Project name must contain 1 to 120 characters';
  end if;

  insert into public.workspaces (
    name,
    description,
    genre,
    owner_id
  )
  values (
    clean_name,
    nullif(trim(project_description), ''),
    nullif(trim(project_genre), ''),
    auth.uid()
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  insert into public.pages (workspace_id, title, content, created_by)
  values (
    new_workspace_id,
    'Start Here',
    '{"html":"<p>Begin writing your story…</p>"}'::jsonb,
    auth.uid()
  );

  insert into public.user_billing (user_id, active_workspace_id)
  values (auth.uid(), new_workspace_id)
  on conflict (user_id) do update
  set active_workspace_id = case
    when public.user_billing.active_workspace_id is null
      then excluded.active_workspace_id
    else public.user_billing.active_workspace_id
  end;

  return new_workspace_id;
end;
$$;

create or replace function public.pick_active_story_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.user_billing
    where user_id = old.owner_id
      and active_workspace_id is null
  ) then
    update public.user_billing
    set active_workspace_id = (
          select id
          from public.workspaces
          where owner_id = old.owner_id
          order by updated_at desc, created_at desc
          limit 1
        ),
        active_workspace_changed_at = null,
        active_workspace_grace_until = null
    where user_id = old.owner_id;
  end if;
  return old;
end;
$$;

drop trigger if exists pick_active_story_after_workspace_delete
on public.workspaces;
create trigger pick_active_story_after_workspace_delete
after delete on public.workspaces
for each row execute function public.pick_active_story_after_delete();

drop policy if exists "Owners can update workspaces" on public.workspaces;
create policy "Owners can update workspaces"
on public.workspaces for update
using (
  owner_id = auth.uid()
  and public.workspace_is_editable(id)
)
with check (
  owner_id = auth.uid()
  and public.workspace_is_editable(id)
);

drop policy if exists "Owners can manage memberships"
on public.workspace_members;
create policy "Owners can manage memberships"
on public.workspace_members for all
using (
  public.workspace_role_for(workspace_id) = 'owner'
  and public.workspace_is_editable(workspace_id)
)
with check (
  public.workspace_role_for(workspace_id) = 'owner'
  and public.workspace_is_editable(workspace_id)
);

drop policy if exists "Editors can create pages" on public.pages;
create policy "Editors can create pages"
on public.pages for insert
with check (
  created_by = auth.uid()
  and public.caller_can_edit_workspace(workspace_id)
);

drop policy if exists "Editors can update pages" on public.pages;
create policy "Editors can update pages"
on public.pages for update
using (public.caller_can_edit_workspace(workspace_id))
with check (public.caller_can_edit_workspace(workspace_id));

drop policy if exists "Editors can delete pages" on public.pages;
create policy "Editors can delete pages"
on public.pages for delete
using (public.caller_can_edit_workspace(workspace_id));

drop policy if exists "Editors can create tags" on public.tags;
create policy "Editors can create tags"
on public.tags for insert
with check (
  created_by = auth.uid()
  and public.caller_can_edit_workspace(workspace_id)
);

drop policy if exists "Editors can update tags" on public.tags;
create policy "Editors can update tags"
on public.tags for update
using (public.caller_can_edit_workspace(workspace_id))
with check (public.caller_can_edit_workspace(workspace_id));

drop policy if exists "Editors can delete tags" on public.tags;
create policy "Editors can delete tags"
on public.tags for delete
using (public.caller_can_edit_workspace(workspace_id));

drop policy if exists "Editors can assign page tags" on public.page_tags;
create policy "Editors can assign page tags"
on public.page_tags for insert
with check (
  exists (
    select 1
    from public.pages
    join public.tags
      on public.tags.id = page_tags.tag_id
      and public.tags.workspace_id = public.pages.workspace_id
    where public.pages.id = page_tags.page_id
      and public.caller_can_edit_workspace(public.pages.workspace_id)
  )
);

drop policy if exists "Editors can remove page tags" on public.page_tags;
create policy "Editors can remove page tags"
on public.page_tags for delete
using (
  exists (
    select 1
    from public.pages
    join public.tags
      on public.tags.id = page_tags.tag_id
      and public.tags.workspace_id = public.pages.workspace_id
    where public.pages.id = page_tags.page_id
      and public.caller_can_edit_workspace(public.pages.workspace_id)
  )
);

drop policy if exists "Editors can create page relationships"
on public.page_relationships;
create policy "Editors can create page relationships"
on public.page_relationships for insert
with check (
  public.caller_can_edit_workspace(workspace_id)
  and exists (
    select 1 from public.pages
    where public.pages.id = from_page_id
      and public.pages.workspace_id = page_relationships.workspace_id
  )
  and exists (
    select 1 from public.pages
    where public.pages.id = to_page_id
      and public.pages.workspace_id = page_relationships.workspace_id
  )
);

drop policy if exists "Editors can delete page relationships"
on public.page_relationships;
create policy "Editors can delete page relationships"
on public.page_relationships for delete
using (public.caller_can_edit_workspace(workspace_id));

drop policy if exists "Editors can save page research"
on public.research_links;
create policy "Editors can save page research"
on public.research_links for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.pages
    where pages.id = research_links.page_id
      and public.caller_can_edit_workspace(pages.workspace_id)
  )
);

drop policy if exists "Editors can delete page research"
on public.research_links;
create policy "Editors can delete page research"
on public.research_links for delete
using (
  exists (
    select 1
    from public.pages
    where pages.id = research_links.page_id
      and public.caller_can_edit_workspace(pages.workspace_id)
  )
);

create or replace function public.save_workspace_geography(
  project_id uuid,
  map_document jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.caller_can_edit_workspace(project_id) then
    raise exception 'This story is read-only';
  end if;

  update public.workspaces
  set geography = map_document
  where id = project_id;

  if not found then
    raise exception 'Project not found';
  end if;
end;
$$;

drop policy if exists "Editors can upload workspace covers"
on storage.objects;
create policy "Editors can upload workspace covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-covers'
  and public.caller_can_edit_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "Editors can replace workspace covers"
on storage.objects;
create policy "Editors can replace workspace covers"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace-covers'
  and public.caller_can_edit_workspace(
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'workspace-covers'
  and public.caller_can_edit_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "Editors can delete workspace covers"
on storage.objects;
-- Owners retain storage delete permission so deleting a read-only story or
-- account can clean up its private objects before the workspace row cascades.
create policy "Editors can delete workspace covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-covers'
  and (
    public.workspace_role_for(
      ((storage.foldername(name))[1])::uuid
    ) = 'owner'
    or public.caller_can_edit_workspace(
      ((storage.foldername(name))[1])::uuid
    )
  )
);

drop policy if exists "Editors can upload geography backgrounds"
on storage.objects;
create policy "Editors can upload geography backgrounds"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-geography'
  and public.caller_can_edit_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "Editors can replace geography backgrounds"
on storage.objects;
create policy "Editors can replace geography backgrounds"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace-geography'
  and public.caller_can_edit_workspace(
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'workspace-geography'
  and public.caller_can_edit_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "Editors can delete geography backgrounds"
on storage.objects;
-- Matches cover deletion: this is needed for intentional whole-story cleanup.
create policy "Editors can delete geography backgrounds"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-geography'
  and (
    public.workspace_role_for(
      ((storage.foldername(name))[1])::uuid
    ) = 'owner'
    or public.caller_can_edit_workspace(
      ((storage.foldername(name))[1])::uuid
    )
  )
);
