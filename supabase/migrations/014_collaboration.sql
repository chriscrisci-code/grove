create or replace function public.caller_is_workspace_owner(
  check_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces
    where id = check_workspace_id
      and owner_id = auth.uid()
  );
$$;

create or replace function public.caller_can_comment_workspace(
  check_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.workspace_role_for(check_workspace_id) is not null;
$$;

revoke all on function public.caller_is_workspace_owner(uuid) from public;
revoke all on function public.caller_can_comment_workspace(uuid) from public;
grant execute on function public.caller_is_workspace_owner(uuid) to authenticated;
grant execute on function public.caller_can_comment_workspace(uuid)
to authenticated;

create or replace function public.collaboration_token()
returns text
language sql
volatile
set search_path = extensions, public
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

create or replace function public.collaboration_token_hash(p_value text)
returns bytea
language sql
immutable
set search_path = extensions, public
as $$
  select digest(p_value, 'sha256');
$$;

revoke all on function public.collaboration_token() from public;
revoke all on function public.collaboration_token_hash(text) from public;

drop policy if exists "Owners can manage memberships"
on public.workspace_members;

create policy "Owners can update collaborator roles"
on public.workspace_members for update
using (
  public.caller_is_workspace_owner(workspace_id)
  and role <> 'owner'
)
with check (
  public.caller_is_workspace_owner(workspace_id)
  and role in ('editor', 'viewer')
);

create policy "Owners can remove collaborators"
on public.workspace_members for delete
using (
  public.caller_is_workspace_owner(workspace_id)
  and role <> 'owner'
);

revoke insert, update, delete on public.workspace_members
from anon, authenticated;

create index if not exists workspace_members_user_idx
on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  invited_email text not null check (
    char_length(invited_email) between 3 and 320
    and invited_email = lower(trim(invited_email))
  ),
  role public.workspace_role not null check (role in ('editor', 'viewer')),
  token_hash bytea not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index workspace_invites_pending_email_idx
on public.workspace_invites (workspace_id, invited_email)
where accepted_at is null and revoked_at is null;

create index workspace_invites_workspace_created_idx
on public.workspace_invites (workspace_id, created_at desc);

alter table public.workspace_invites enable row level security;

create table public.page_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'comment'
    check (kind in ('comment', 'suggestion')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  quoted_text text check (
    quoted_text is null or char_length(quoted_text) <= 2000
  ),
  suggestion_text text check (
    suggestion_text is null or char_length(suggestion_text) <= 4000
  ),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    kind = 'comment'
    or char_length(trim(coalesce(suggestion_text, ''))) > 0
  )
);

create index page_comments_page_created_idx
on public.page_comments (page_id, created_at desc);

create index page_comments_workspace_created_idx
on public.page_comments (workspace_id, created_at desc);

create trigger page_comments_touch_updated_at
before update on public.page_comments
for each row execute function public.touch_updated_at();

alter table public.page_comments enable row level security;

create policy "Members can view page comments"
on public.page_comments for select
using (public.caller_can_comment_workspace(workspace_id));

create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_email text,
  p_role public.workspace_role
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(trim(p_email));
  raw_token text := public.collaboration_token();
  new_invite_id uuid;
  invite_expiry timestamptz := now() + interval '14 days';
begin
  if not public.caller_is_workspace_owner(p_workspace_id) then
    raise exception 'Only the story owner can invite collaborators';
  end if;
  if public.user_effective_plan(auth.uid()) <> 'plus' then
    raise exception 'Sharing with collaborators requires Grove Plus';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Choose Reviewer or Editor';
  end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(clean_email) > 320 then
    raise exception 'Enter a valid email address';
  end if;
  if clean_email = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'You already own this story';
  end if;

  update public.workspace_invites
  set revoked_at = now(),
      revoked_by = auth.uid()
  where workspace_id = p_workspace_id
    and invited_email = clean_email
    and accepted_at is null
    and revoked_at is null;

  insert into public.workspace_invites (
    workspace_id,
    invited_email,
    role,
    token_hash,
    invited_by,
    expires_at
  )
  values (
    p_workspace_id,
    clean_email,
    p_role,
    public.collaboration_token_hash(raw_token),
    auth.uid(),
    invite_expiry
  )
  returning id into new_invite_id;

  return jsonb_build_object(
    'inviteId', new_invite_id,
    'token', raw_token,
    'email', clean_email,
    'role', p_role,
    'expiresAt', invite_expiry
  );
end;
$$;

create or replace function public.list_workspace_invites(
  p_workspace_id uuid
)
returns table (
  id uuid,
  invited_email text,
  role public.workspace_role,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.caller_is_workspace_owner(p_workspace_id) then
    raise exception 'Only the story owner can view invitations';
  end if;

  return query
  select
    invites.id,
    invites.invited_email,
    invites.role,
    invites.expires_at,
    invites.created_at
  from public.workspace_invites as invites
  where invites.workspace_id = p_workspace_id
    and invites.accepted_at is null
    and invites.revoked_at is null
    and invites.expires_at > now()
  order by invites.created_at desc;
end;
$$;

create or replace function public.revoke_workspace_invite(
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_workspace_id uuid;
begin
  select workspace_id
  into invite_workspace_id
  from public.workspace_invites
  where id = p_invite_id
    and accepted_at is null
    and revoked_at is null;

  if invite_workspace_id is null
    or not public.caller_is_workspace_owner(invite_workspace_id) then
    raise exception 'Invitation not found';
  end if;

  update public.workspace_invites
  set revoked_at = now(),
      revoked_by = auth.uid()
  where id = p_invite_id;
end;
$$;

create or replace function public.list_workspace_collaborators(
  p_workspace_id uuid
)
returns table (
  user_id uuid,
  email text,
  role public.workspace_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.caller_is_workspace_owner(p_workspace_id) then
    raise exception 'Only the story owner can view collaborators';
  end if;

  return query
  select
    members.user_id,
    coalesce(users.email, 'Unknown collaborator'),
    members.role,
    members.created_at
  from public.workspace_members as members
  left join auth.users as users on users.id = members.user_id
  where members.workspace_id = p_workspace_id
  order by
    case members.role
      when 'owner' then 0
      when 'editor' then 1
      else 2
    end,
    members.created_at;
end;
$$;

create or replace function public.update_workspace_collaborator_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.caller_is_workspace_owner(p_workspace_id) then
    raise exception 'Only the story owner can change collaborator roles';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Choose Reviewer or Editor';
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id
    and user_id = p_user_id
    and role <> 'owner';

  if not found then
    raise exception 'Collaborator not found';
  end if;
end;
$$;

create or replace function public.remove_workspace_collaborator(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.caller_is_workspace_owner(p_workspace_id) then
    raise exception 'Only the story owner can remove collaborators';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id
    and role <> 'owner';

  if not found then
    raise exception 'Collaborator not found';
  end if;
end;
$$;

create or replace function public.peek_workspace_invite(
  p_token text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'valid', true,
        'workspaceName', workspaces.name,
        'role', invites.role,
        'expiresAt', invites.expires_at
      )
      from public.workspace_invites as invites
      join public.workspaces
        on workspaces.id = invites.workspace_id
      where invites.token_hash = public.collaboration_token_hash(p_token)
        and invites.accepted_at is null
        and invites.revoked_at is null
        and invites.expires_at > now()
      limit 1
    ),
    jsonb_build_object('valid', false)
  );
$$;

create or replace function public.accept_workspace_invite(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matching_invite public.workspace_invites%rowtype;
  caller_email text;
  caller_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(email), email_confirmed_at
  into caller_email, caller_email_confirmed_at
  from auth.users
  where id = auth.uid();

  if caller_email is null or caller_email_confirmed_at is null then
    raise exception 'Confirm your email address before accepting an invitation';
  end if;

  select *
  into matching_invite
  from public.workspace_invites
  where token_hash = public.collaboration_token_hash(p_token)
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if matching_invite.id is null then
    raise exception 'This invitation is invalid or has expired';
  end if;
  if caller_email <> matching_invite.invited_email then
    raise exception 'Sign in with the email address that was invited';
  end if;
  if public.caller_is_workspace_owner(matching_invite.workspace_id) then
    raise exception 'You already own this story';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (
    matching_invite.workspace_id,
    auth.uid(),
    matching_invite.role
  )
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  update public.workspace_invites
  set accepted_at = now(),
      accepted_by = auth.uid()
  where id = matching_invite.id;

  return jsonb_build_object(
    'workspaceId', matching_invite.workspace_id,
    'role', matching_invite.role
  );
end;
$$;

create or replace function public.list_page_comments(
  p_page_id uuid
)
returns table (
  id uuid,
  author_id uuid,
  author_email text,
  kind text,
  body text,
  quoted_text text,
  suggestion_text text,
  resolved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  comment_workspace_id uuid;
begin
  select workspace_id
  into comment_workspace_id
  from public.pages
  where pages.id = p_page_id;

  if comment_workspace_id is null
    or not public.caller_can_comment_workspace(comment_workspace_id) then
    raise exception 'Page not found';
  end if;

  return query
  select
    comments.id,
    comments.author_id,
    coalesce(users.email, 'Former collaborator'),
    comments.kind,
    comments.body,
    comments.quoted_text,
    comments.suggestion_text,
    comments.resolved_at,
    comments.created_at
  from public.page_comments as comments
  left join auth.users as users on users.id = comments.author_id
  where comments.page_id = p_page_id
  order by
    (comments.resolved_at is not null),
    comments.created_at desc;
end;
$$;

create or replace function public.create_page_comment(
  p_page_id uuid,
  p_kind text,
  p_body text,
  p_quoted_text text default null,
  p_suggestion_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  comment_workspace_id uuid;
  new_comment_id uuid;
  clean_body text := trim(p_body);
  clean_quote text := nullif(trim(p_quoted_text), '');
  clean_suggestion text := nullif(trim(p_suggestion_text), '');
begin
  select workspace_id
  into comment_workspace_id
  from public.pages
  where pages.id = p_page_id
    and deleted_at is null;

  if comment_workspace_id is null
    or not public.caller_can_comment_workspace(comment_workspace_id) then
    raise exception 'Page not found';
  end if;
  if p_kind not in ('comment', 'suggestion') then
    raise exception 'Choose Comment or Suggestion';
  end if;
  if char_length(clean_body) < 1 or char_length(clean_body) > 4000 then
    raise exception 'Comments must contain 1 to 4000 characters';
  end if;
  if char_length(coalesce(clean_quote, '')) > 2000 then
    raise exception 'The quoted selection is too long';
  end if;
  if p_kind = 'suggestion'
    and char_length(coalesce(clean_suggestion, '')) < 1 then
    raise exception 'Add the text you are suggesting';
  end if;
  if char_length(coalesce(clean_suggestion, '')) > 4000 then
    raise exception 'Suggestions must contain 4000 characters or fewer';
  end if;

  insert into public.page_comments (
    workspace_id,
    page_id,
    author_id,
    kind,
    body,
    quoted_text,
    suggestion_text
  )
  values (
    comment_workspace_id,
    p_page_id,
    auth.uid(),
    p_kind,
    clean_body,
    clean_quote,
    clean_suggestion
  )
  returning id into new_comment_id;

  return new_comment_id;
end;
$$;

create or replace function public.set_page_comment_resolved(
  p_comment_id uuid,
  p_resolved boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  comment_workspace_id uuid;
  caller_role public.workspace_role;
begin
  select workspace_id
  into comment_workspace_id
  from public.page_comments
  where id = p_comment_id;

  caller_role := public.workspace_role_for(comment_workspace_id);
  if coalesce(caller_role::text, '') not in ('owner', 'editor') then
    raise exception 'Only an owner or editor can resolve comments';
  end if;

  update public.page_comments
  set resolved_at = case when p_resolved then now() else null end,
      resolved_by = case when p_resolved then auth.uid() else null end
  where id = p_comment_id;
end;
$$;

create or replace function public.delete_page_comment(
  p_comment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_comment public.page_comments%rowtype;
begin
  select *
  into target_comment
  from public.page_comments
  where id = p_comment_id;

  if target_comment.id is null
    or not public.caller_can_comment_workspace(target_comment.workspace_id)
    or (
      target_comment.author_id <> auth.uid()
      and not public.caller_is_workspace_owner(target_comment.workspace_id)
    ) then
    raise exception 'Comment not found';
  end if;

  delete from public.page_comments
  where id = p_comment_id;
end;
$$;

revoke all on table public.workspace_invites from anon, authenticated;
revoke insert, update, delete on table public.page_comments
from anon, authenticated;

revoke all on function public.create_workspace_invite(
  uuid, text, public.workspace_role
) from public;
revoke all on function public.list_workspace_invites(uuid) from public;
revoke all on function public.revoke_workspace_invite(uuid) from public;
revoke all on function public.list_workspace_collaborators(uuid) from public;
revoke all on function public.update_workspace_collaborator_role(
  uuid, uuid, public.workspace_role
) from public;
revoke all on function public.remove_workspace_collaborator(uuid, uuid)
from public;
revoke all on function public.peek_workspace_invite(text) from public;
revoke all on function public.accept_workspace_invite(text) from public;
revoke all on function public.list_page_comments(uuid) from public;
revoke all on function public.create_page_comment(
  uuid, text, text, text, text
) from public;
revoke all on function public.set_page_comment_resolved(uuid, boolean)
from public;
revoke all on function public.delete_page_comment(uuid) from public;

grant execute on function public.create_workspace_invite(
  uuid, text, public.workspace_role
) to authenticated;
grant execute on function public.list_workspace_invites(uuid)
to authenticated;
grant execute on function public.revoke_workspace_invite(uuid)
to authenticated;
grant execute on function public.list_workspace_collaborators(uuid)
to authenticated;
grant execute on function public.update_workspace_collaborator_role(
  uuid, uuid, public.workspace_role
) to authenticated;
grant execute on function public.remove_workspace_collaborator(uuid, uuid)
to authenticated;
grant execute on function public.peek_workspace_invite(text)
to anon, authenticated;
grant execute on function public.accept_workspace_invite(text)
to authenticated;
grant execute on function public.list_page_comments(uuid)
to authenticated;
grant execute on function public.create_page_comment(
  uuid, text, text, text, text
) to authenticated;
grant execute on function public.set_page_comment_resolved(uuid, boolean)
to authenticated;
grant execute on function public.delete_page_comment(uuid)
to authenticated;

-- Grove collaboration is intentionally asynchronous in this release. A short
-- renewable lease prevents two browser sessions from overwriting the same
-- story with the editor's whole-document autosave.
create table public.workspace_edit_leases (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  holder_id uuid not null references auth.users(id) on delete cascade,
  lease_token uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_edit_leases enable row level security;
revoke all on table public.workspace_edit_leases from anon, authenticated;

create or replace function public.claim_workspace_edit_lease(
  p_workspace_id uuid,
  p_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_lease public.workspace_edit_leases%rowtype;
  holder_email text;
  lease_now timestamptz;
  lease_expiry timestamptz;
begin
  if not public.caller_can_edit_workspace(p_workspace_id) then
    return jsonb_build_object(
      'acquired', false,
      'reason', 'read_only'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text, 0)
  );
  lease_now := clock_timestamp();
  lease_expiry := lease_now + interval '90 seconds';

  select *
  into current_lease
  from public.workspace_edit_leases
  where workspace_id = p_workspace_id;

  if current_lease.workspace_id is not null
    and current_lease.expires_at > lease_now
    and (
      current_lease.holder_id <> auth.uid()
      or current_lease.lease_token <> p_lease_token
    ) then
    select email
    into holder_email
    from auth.users
    where id = current_lease.holder_id;

    return jsonb_build_object(
      'acquired', false,
      'reason', 'in_use',
      'holderEmail', coalesce(holder_email, 'Another collaborator'),
      'expiresAt', current_lease.expires_at
    );
  end if;

  insert into public.workspace_edit_leases (
    workspace_id,
    holder_id,
    lease_token,
    expires_at,
    updated_at
  )
  values (
    p_workspace_id,
    auth.uid(),
    p_lease_token,
    lease_expiry,
    now()
  )
  on conflict (workspace_id) do update
  set holder_id = excluded.holder_id,
      lease_token = excluded.lease_token,
      expires_at = excluded.expires_at,
      updated_at = now();

  return jsonb_build_object(
    'acquired', true,
    'expiresAt', lease_expiry
  );
end;
$$;

create or replace function public.renew_workspace_edit_lease(
  p_workspace_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text, 0)
  );

  update public.workspace_edit_leases
  set expires_at = clock_timestamp() + interval '90 seconds',
      updated_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and holder_id = auth.uid()
    and lease_token = p_lease_token
    and public.caller_can_edit_workspace(p_workspace_id);

  return found;
end;
$$;

create or replace function public.release_workspace_edit_lease(
  p_workspace_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text, 0)
  );

  delete from public.workspace_edit_leases
  where workspace_id = p_workspace_id
    and holder_id = auth.uid()
    and lease_token = p_lease_token;
end;
$$;

revoke all on function public.claim_workspace_edit_lease(uuid, uuid)
from public;
revoke all on function public.renew_workspace_edit_lease(uuid, uuid)
from public;
revoke all on function public.release_workspace_edit_lease(uuid, uuid)
from public;

grant execute on function public.claim_workspace_edit_lease(uuid, uuid)
to authenticated;
grant execute on function public.renew_workspace_edit_lease(uuid, uuid)
to authenticated;
grant execute on function public.release_workspace_edit_lease(uuid, uuid)
to authenticated;

create or replace function public.caller_can_write_workspace(
  check_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.caller_can_edit_workspace(check_workspace_id)
    and exists (
      select 1
      from public.workspace_edit_leases
      where workspace_id = check_workspace_id
        and holder_id = auth.uid()
        and expires_at > clock_timestamp()
    );
$$;

create or replace function public.save_workspace_pages(
  p_workspace_id uuid,
  p_lease_token uuid,
  p_pages jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_document jsonb;
  page_id uuid;
  parent_page_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text, 0)
  );

  if not public.caller_can_edit_workspace(p_workspace_id)
    or not exists (
      select 1
      from public.workspace_edit_leases
      where workspace_id = p_workspace_id
        and holder_id = auth.uid()
        and lease_token = p_lease_token
        and expires_at > clock_timestamp()
    ) then
    raise exception 'Your editing session is no longer active';
  end if;
  if jsonb_typeof(p_pages) <> 'array'
    or jsonb_array_length(p_pages) > 5000 then
    raise exception 'Invalid page save';
  end if;

  for page_document in
    select value from jsonb_array_elements(p_pages)
  loop
    page_id := (page_document ->> 'id')::uuid;
    parent_page_id := nullif(page_document ->> 'parent_id', '')::uuid;

    if exists (
      select 1
      from public.pages
      where id = page_id
        and workspace_id <> p_workspace_id
    ) then
      raise exception 'Page does not belong to this story';
    end if;
    if parent_page_id is not null
      and not exists (
        select 1
        from public.pages
        where id = parent_page_id
          and workspace_id = p_workspace_id
      )
      and not exists (
        select 1
        from jsonb_array_elements(p_pages) as pending_page(value)
        where (pending_page.value ->> 'id')::uuid = parent_page_id
      ) then
      raise exception 'Parent page does not belong to this story';
    end if;

    insert into public.pages (
      id,
      workspace_id,
      parent_id,
      title,
      content,
      page_type,
      fields,
      position,
      created_by
    )
    values (
      page_id,
      p_workspace_id,
      parent_page_id,
      coalesce(nullif(page_document ->> 'title', ''), 'Untitled'),
      coalesce(
        page_document -> 'content',
        '{"html":"<p></p>"}'::jsonb
      ),
      coalesce(page_document ->> 'page_type', 'page'),
      coalesce(page_document -> 'fields', '{}'::jsonb),
      coalesce((page_document ->> 'position')::double precision, 0),
      auth.uid()
    )
    on conflict (id) do update
    set parent_id = excluded.parent_id,
        title = excluded.title,
        content = excluded.content,
        page_type = excluded.page_type,
        fields = excluded.fields,
        position = excluded.position
    where pages.workspace_id = p_workspace_id;
  end loop;
end;
$$;

revoke all on function public.caller_can_write_workspace(uuid) from public;
revoke all on function public.save_workspace_pages(uuid, uuid, jsonb)
from public;
grant execute on function public.caller_can_write_workspace(uuid)
to authenticated;
grant execute on function public.save_workspace_pages(uuid, uuid, jsonb)
to authenticated;

drop policy if exists "Owners can update workspaces" on public.workspaces;
create policy "Owners can update workspaces"
on public.workspaces for update
using (
  owner_id = auth.uid()
  and public.caller_can_edit_workspace(id)
)
with check (
  owner_id = auth.uid()
  and public.caller_can_edit_workspace(id)
);

drop policy if exists "Editors can create pages" on public.pages;
create policy "Editors can create pages"
on public.pages for insert
with check (
  created_by = auth.uid()
  and public.caller_can_write_workspace(workspace_id)
);

drop policy if exists "Editors can update pages" on public.pages;
create policy "Editors can update pages"
on public.pages for update
using (public.caller_can_write_workspace(workspace_id))
with check (public.caller_can_write_workspace(workspace_id));

drop policy if exists "Editors can delete pages" on public.pages;
create policy "Editors can delete pages"
on public.pages for delete
using (public.caller_can_write_workspace(workspace_id));

drop policy if exists "Editors can create tags" on public.tags;
create policy "Editors can create tags"
on public.tags for insert
with check (
  created_by = auth.uid()
  and public.caller_can_write_workspace(workspace_id)
);

drop policy if exists "Editors can update tags" on public.tags;
create policy "Editors can update tags"
on public.tags for update
using (public.caller_can_write_workspace(workspace_id))
with check (public.caller_can_write_workspace(workspace_id));

drop policy if exists "Editors can delete tags" on public.tags;
create policy "Editors can delete tags"
on public.tags for delete
using (public.caller_can_write_workspace(workspace_id));

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
      and public.caller_can_write_workspace(public.pages.workspace_id)
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
      and public.caller_can_write_workspace(public.pages.workspace_id)
  )
);

drop policy if exists "Editors can create page relationships"
on public.page_relationships;
create policy "Editors can create page relationships"
on public.page_relationships for insert
with check (
  public.caller_can_write_workspace(workspace_id)
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
using (public.caller_can_write_workspace(workspace_id));

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
      and public.caller_can_write_workspace(pages.workspace_id)
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
      and public.caller_can_write_workspace(pages.workspace_id)
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
  if not public.caller_can_write_workspace(project_id) then
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
create policy "Editors can delete workspace covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-covers'
  and (
    public.workspace_role_for(
      ((storage.foldername(name))[1])::uuid
    ) = 'owner'
    or public.caller_can_write_workspace(
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
  and public.caller_can_write_workspace(
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
  and public.caller_can_write_workspace(
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'workspace-geography'
  and public.caller_can_write_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "Editors can delete geography backgrounds"
on storage.objects;
create policy "Editors can delete geography backgrounds"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-geography'
  and (
    public.workspace_role_for(
      ((storage.foldername(name))[1])::uuid
    ) = 'owner'
    or public.caller_can_write_workspace(
      ((storage.foldername(name))[1])::uuid
    )
  )
);
