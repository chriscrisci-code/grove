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
    and current_lease.expires_at > lease_now then
    if current_lease.holder_id = auth.uid() then
      update public.workspace_edit_leases
      set expires_at = lease_expiry,
          updated_at = lease_now
      where workspace_id = p_workspace_id;

      return jsonb_build_object(
        'acquired', true,
        'expiresAt', lease_expiry,
        'leaseToken', current_lease.lease_token
      );
    end if;

    if current_lease.lease_token <> p_lease_token then
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
    'expiresAt', lease_expiry,
    'leaseToken', p_lease_token
  );
end;
$$;
