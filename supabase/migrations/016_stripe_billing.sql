-- Stripe subscription sync. Preview mode stays on until you flip it after a
-- live test: update public.billing_settings set preview_mode = false where id = true;

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

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

create or replace function public.sync_stripe_subscription(
  check_user_id uuid,
  customer_id text,
  subscription_id text,
  status public.subscription_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if check_user_id is null then
    raise exception 'User is required';
  end if;

  if status in ('active', 'trialing', 'past_due') then
    insert into public.user_billing (
      user_id,
      plan,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id
    )
    values (
      check_user_id,
      'plus',
      status,
      nullif(customer_id, ''),
      nullif(subscription_id, '')
    )
    on conflict (user_id) do update
    set plan = 'plus',
        subscription_status = excluded.subscription_status,
        stripe_customer_id = coalesce(
          excluded.stripe_customer_id,
          public.user_billing.stripe_customer_id
        ),
        stripe_subscription_id = coalesce(
          excluded.stripe_subscription_id,
          public.user_billing.stripe_subscription_id
        );
    return;
  end if;

  perform public.begin_free_plan(check_user_id);

  update public.user_billing
  set subscription_status = status,
      stripe_customer_id = coalesce(nullif(customer_id, ''), stripe_customer_id),
      stripe_subscription_id = coalesce(
        nullif(subscription_id, ''),
        stripe_subscription_id
      )
  where user_id = check_user_id;
end;
$$;

revoke all on function public.sync_stripe_subscription(uuid, text, text, public.subscription_status) from public;
grant execute on function public.sync_stripe_subscription(uuid, text, text, public.subscription_status) to service_role;
grant execute on function public.get_my_billing_state() to authenticated;
grant execute on function public.user_effective_plan(uuid) to authenticated;
