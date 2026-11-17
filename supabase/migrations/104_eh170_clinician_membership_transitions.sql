-- EH-170: named clinician membership invitation and acceptance transitions.

create or replace function public.eh170_invite_clinician_membership(
  p_actor_profile_id uuid,
  p_clinic_id uuid,
  p_clinician_profile_id uuid,
  p_role text default 'clinician'
)
returns table (
  membership_id uuid,
  clinic_id uuid,
  clinician_profile_id uuid,
  role text,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.clinic_memberships%rowtype;
  v_clinic public.clinics%rowtype;
begin
  if p_role not in ('admin', 'clinician') then
    raise exception using message = 'eh170_membership_input_invalid';
  end if;
  select * into v_clinic
  from public.clinics as clinics
  where clinics.id = p_clinic_id
    and clinics.archived_at is null;
  if v_clinic.id is null or not exists (
    select 1
    from public.clinic_memberships as actor_memberships
    where actor_memberships.clinic_id = p_clinic_id
      and actor_memberships.clinician_profile_id = p_actor_profile_id
      and actor_memberships.status = 'active'
      and actor_memberships.role in ('owner', 'admin')
  ) then
    raise exception using message = 'eh170_access_denied';
  end if;
  if not exists (select 1 from public.profiles where id = p_clinician_profile_id) then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_membership
  from public.clinic_memberships as memberships
  where memberships.clinic_id = p_clinic_id
    and memberships.clinician_profile_id = p_clinician_profile_id
  for update;
  if v_membership.id is not null and v_membership.status in ('invited', 'active') then
    raise exception using message = 'eh170_membership_exists';
  end if;

  if v_membership.id is null then
    insert into public.clinic_memberships (
      clinic_id,
      clinician_profile_id,
      role,
      status,
      invited_by_profile_id,
      invited_at
    )
    values (
      p_clinic_id,
      p_clinician_profile_id,
      p_role,
      'invited',
      p_actor_profile_id,
      clock_timestamp()
    )
    returning * into v_membership;
  else
    update public.clinic_memberships
    set role = p_role,
        status = 'invited',
        invited_by_profile_id = p_actor_profile_id,
        invited_at = clock_timestamp(),
        accepted_at = null,
        revoked_at = null,
        updated_at = clock_timestamp()
    where id = v_membership.id
    returning * into v_membership;
  end if;

  perform public.eh170_write_access_event(
    p_clinic_id,
    null,
    p_actor_profile_id,
    null,
    'clinic',
    'create',
    'allowed',
    null
  );

  return query select
    v_membership.id,
    v_membership.clinic_id,
    v_membership.clinician_profile_id,
    v_membership.role,
    v_membership.status;
end;
$$;

create or replace function public.eh170_accept_clinician_membership(
  p_clinician_profile_id uuid,
  p_membership_id uuid
)
returns table (
  membership_id uuid,
  clinic_id uuid,
  clinician_profile_id uuid,
  role text,
  status text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.clinic_memberships%rowtype;
  v_clinic_id uuid;
begin
  select * into v_membership
  from public.clinic_memberships as memberships
  where memberships.id = p_membership_id
    and memberships.clinician_profile_id = p_clinician_profile_id
  for update;
  if v_membership.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  if v_membership.status = 'active' then
    return query select
      v_membership.id,
      v_membership.clinic_id,
      v_membership.clinician_profile_id,
      v_membership.role,
      v_membership.status,
      v_membership.accepted_at;
    return;
  end if;
  if v_membership.status <> 'invited' then
    raise exception using message = 'eh170_membership_state_invalid';
  end if;

  update public.clinic_memberships
  set status = 'active',
      accepted_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = v_membership.id
  returning * into v_membership;
  v_clinic_id := v_membership.clinic_id;

  perform public.eh170_write_access_event(
    v_clinic_id,
    null,
    p_clinician_profile_id,
    null,
    'clinic',
    'approve',
    'allowed',
    null
  );

  return query select
    v_membership.id,
    v_membership.clinic_id,
    v_membership.clinician_profile_id,
    v_membership.role,
    v_membership.status,
    v_membership.accepted_at;
end;
$$;

create or replace function public.eh170_revoke_clinician_membership(
  p_actor_profile_id uuid,
  p_membership_id uuid
)
returns table (
  membership_id uuid,
  clinic_id uuid,
  clinician_profile_id uuid,
  status text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.clinic_memberships%rowtype;
begin
  select * into v_membership
  from public.clinic_memberships as memberships
  where memberships.id = p_membership_id
  for update;
  if v_membership.id is null
    or not exists (
      select 1
      from public.clinic_memberships as actor_memberships
      where actor_memberships.clinic_id = v_membership.clinic_id
        and actor_memberships.clinician_profile_id = p_actor_profile_id
        and actor_memberships.status = 'active'
        and actor_memberships.role in ('owner', 'admin')
    ) then
    raise exception using message = 'eh170_access_denied';
  end if;

  update public.clinic_memberships
  set status = 'revoked',
      revoked_at = coalesce(public.clinic_memberships.revoked_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = v_membership.id
  returning * into v_membership;

  perform public.eh170_write_access_event(
    v_membership.clinic_id,
    null,
    p_actor_profile_id,
    null,
    'clinic',
    'revoke',
    'allowed',
    null
  );

  return query select
    v_membership.id,
    v_membership.clinic_id,
    v_membership.clinician_profile_id,
    v_membership.status,
    v_membership.revoked_at;
end;
$$;

revoke all on function public.eh170_invite_clinician_membership(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh170_invite_clinician_membership(uuid, uuid, uuid, text)
  to service_role;
revoke all on function public.eh170_accept_clinician_membership(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_accept_clinician_membership(uuid, uuid)
  to service_role;
revoke all on function public.eh170_revoke_clinician_membership(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_revoke_clinician_membership(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
