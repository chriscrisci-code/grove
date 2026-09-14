-- Beta forever: accounts created while preview/beta is open keep full access
-- after pay tiers turn on. Stamp on every new user_billing row while
-- billing_settings.preview_mode is true.

alter table public.user_billing
add column if not exists beta_forever boolean not null default false;

comment on column public.user_billing.beta_forever is
  'True for accounts created during Grove beta; keeps full access after paid plans launch.';

create or replace function public.user_billing_stamp_beta_forever()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
    (select preview_mode from public.billing_settings where id = true),
    true
  ) then
    new.beta_forever := true;
  end if;
  return new;
end;
$$;

drop trigger if exists user_billing_stamp_beta_forever on public.user_billing;
create trigger user_billing_stamp_beta_forever
before insert on public.user_billing
for each row
execute function public.user_billing_stamp_beta_forever();

-- Existing writers and any auth users without a billing row yet.
update public.user_billing
set beta_forever = true;

insert into public.user_billing (user_id, beta_forever)
select users.id, true
from auth.users users
on conflict (user_id) do update
set beta_forever = true;

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
    when exists (
      select 1
      from public.user_billing
      where user_id = check_user_id
        and beta_forever = true
    ) then 'plus'::public.billing_plan
    when public.user_has_plus_grant(check_user_id) then 'plus'::public.billing_plan
    else 'free'::public.billing_plan
  end;
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
      'betaForever', exists (
        select 1
        from public.user_billing
        where user_id = auth.uid()
          and beta_forever = true
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

grant execute on function public.get_my_billing_state() to authenticated;
grant execute on function public.user_effective_plan(uuid) to authenticated;
