alter table public.billing_settings
add column if not exists plus_admin_emails text[] not null default '{}';

update public.billing_settings
set plus_admin_emails = array['chriscrisci@gmail.com']
where id = true
  and cardinality(plus_admin_emails) = 0;

create table if not exists public.plus_grants (
  email text primary key
    check (
      char_length(email) >= 3
      and char_length(email) <= 320
      and email = lower(email)
    ),
  created_at timestamptz not null default now()
);

alter table public.plus_grants enable row level security;
revoke all on table public.plus_grants from anon, authenticated;

create or replace function public.user_has_plus_grant(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plus_grants grants
    join auth.users users on lower(users.email) = grants.email
    where users.id = check_user_id
  );
$$;

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
        and subscription_status in ('active', 'trialing', 'past_due')
    ) then 'plus'::public.billing_plan
    when public.user_has_plus_grant(check_user_id) then 'plus'::public.billing_plan
    else 'free'::public.billing_plan
  end;
$$;

create or replace function public.caller_can_manage_plus_grants()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.billing_settings settings
    join auth.users users on users.id = auth.uid()
    where settings.id = true
      and lower(users.email) in (
        select lower(trim(admin_email))
        from unnest(settings.plus_admin_emails) as admin_email
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
      'plusGrant', public.user_has_plus_grant(auth.uid()),
      'canManagePlusGrants', public.caller_can_manage_plus_grants(),
      'subscriptionStatus', coalesce(
        (
          select subscription_status
          from public.user_billing
          where user_id = auth.uid()
        ),
        'none'::public.subscription_status
      ),
      'hasStripeCustomer', exists (
        select 1
        from public.user_billing
        where user_id = auth.uid()
          and stripe_customer_id is not null
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

create or replace function public.list_plus_grants()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.caller_can_manage_plus_grants() then
    raise exception 'Only a Grove admin can manage complimentary Plus.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'email', grants.email,
          'createdAt', grants.created_at
        )
        order by grants.created_at
      )
      from public.plus_grants grants
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.grant_complimentary_plus(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text;
begin
  if not public.caller_can_manage_plus_grants() then
    raise exception 'Only a Grove admin can manage complimentary Plus.';
  end if;

  clean_email := lower(trim(p_email));
  if clean_email is null
    or char_length(clean_email) < 3
    or char_length(clean_email) > 320
    or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  insert into public.plus_grants (email)
  values (clean_email)
  on conflict (email) do nothing;

  return jsonb_build_object('ok', true, 'email', clean_email);
end;
$$;

create or replace function public.revoke_complimentary_plus(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text;
begin
  if not public.caller_can_manage_plus_grants() then
    raise exception 'Only a Grove admin can manage complimentary Plus.';
  end if;

  clean_email := lower(trim(p_email));
  delete from public.plus_grants where email = clean_email;
  return jsonb_build_object('ok', true, 'email', clean_email);
end;
$$;

revoke all on function public.user_has_plus_grant(uuid) from public;
revoke all on function public.caller_can_manage_plus_grants() from public;
revoke all on function public.list_plus_grants() from public;
revoke all on function public.grant_complimentary_plus(text) from public;
revoke all on function public.revoke_complimentary_plus(text) from public;

grant execute on function public.user_has_plus_grant(uuid) to authenticated;
grant execute on function public.caller_can_manage_plus_grants() to authenticated;
grant execute on function public.get_my_billing_state() to authenticated;
grant execute on function public.user_effective_plan(uuid) to authenticated;
grant execute on function public.list_plus_grants() to authenticated;
grant execute on function public.grant_complimentary_plus(text) to authenticated;
grant execute on function public.revoke_complimentary_plus(text) to authenticated;
