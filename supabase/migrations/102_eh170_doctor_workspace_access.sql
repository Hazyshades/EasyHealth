-- EH-170: centralized grant authorization, patient transitions, and deny-by-default access.

create or replace function public.eh170_scopes_valid(p_scopes text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_scopes is not null
    and cardinality(p_scopes) > 0
    and public.eh170_unique_text_array(p_scopes)
    and p_scopes <@ array[
      'health_profile',
      'observations',
      'reports',
      'documents',
      'consultations'
    ]::text[];
$$;

revoke all on function public.eh170_scopes_valid(text[])
  from public, anon, authenticated, service_role;
grant execute on function public.eh170_scopes_valid(text[])
  to postgres;

create or replace function public.eh170_write_access_event(
  p_clinic_id uuid,
  p_patient_profile_id uuid,
  p_actor_profile_id uuid,
  p_grant_id uuid,
  p_resource_kind text,
  p_operation text,
  p_result text,
  p_scope text default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.clinical_access_events (
    clinic_id,
    patient_profile_id,
    actor_profile_id,
    grant_id,
    resource_kind,
    operation,
    result,
    scope
  )
  values (
    p_clinic_id,
    p_patient_profile_id,
    p_actor_profile_id,
    p_grant_id,
    p_resource_kind,
    p_operation,
    p_result,
    p_scope
  )
  returning id;
$$;

revoke all on function public.eh170_write_access_event(uuid, uuid, uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.eh170_write_access_event(uuid, uuid, uuid, uuid, text, text, text, text)
  to postgres;


create or replace function public.eh170_authorize_patient_access(
  p_actor_profile_id uuid,
  p_clinic_id uuid,
  p_patient_profile_id uuid,
  p_scope text,
  p_operation text default 'read'
)
returns table (
  allowed boolean,
  grant_id uuid,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.patient_access_grants%rowtype;
  v_resource_kind text;
  v_result text;
begin
  v_resource_kind := case p_scope
    when 'health_profile' then 'health_profile'
    when 'observations' then 'observation'
    when 'reports' then 'report'
    when 'documents' then 'document'
    when 'consultations' then 'consultation'
    else 'patient_profile'
  end;

  if p_actor_profile_id is null
    or p_clinic_id is null
    or p_patient_profile_id is null
    or not public.eh170_scopes_valid(array[p_scope]::text[])
    or p_operation not in ('read', 'create', 'update', 'review', 'export', 'delete') then
    return query select false, null::uuid, 'access_denied'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.clinic_memberships as memberships
    join public.clinics as clinics on clinics.id = memberships.clinic_id
    where memberships.clinic_id = p_clinic_id
      and memberships.clinician_profile_id = p_actor_profile_id
      and memberships.status = 'active'
      and clinics.archived_at is null
  ) then
    perform public.eh170_write_access_event(
      p_clinic_id,
      p_patient_profile_id,
      p_actor_profile_id,
      null,
      v_resource_kind,
      case when p_operation in ('read', 'create', 'update', 'review', 'export', 'delete') then p_operation else 'read' end,
      'denied',
      p_scope
    );
    return query select false, null::uuid, 'access_denied'::text;
    return;
  end if;

  select *
  into v_grant
  from public.patient_access_grants as grants
  where grants.clinic_id = p_clinic_id
    and grants.patient_profile_id = p_patient_profile_id
    and grants.clinician_profile_id = p_actor_profile_id
    and grants.state in ('pending', 'active', 'expired', 'revoked')
  order by grants.created_at desc
  limit 1
  for update;

  if v_grant.id is null then
    perform public.eh170_write_access_event(
      p_clinic_id,
      p_patient_profile_id,
      p_actor_profile_id,
      null,
      v_resource_kind,
      p_operation,
      'denied',
      p_scope
    );
    return query select false, null::uuid, 'access_denied'::text;
    return;
  end if;

  if v_grant.state = 'active'
    and v_grant.expires_at is not null
    and v_grant.expires_at <= clock_timestamp() then
    update public.patient_access_grants
    set state = 'expired',
        updated_at = clock_timestamp()
    where id = v_grant.id;

    perform public.eh170_write_access_event(
      p_clinic_id,
      p_patient_profile_id,
      p_actor_profile_id,
      v_grant.id,
      v_resource_kind,
      p_operation,
      'expired',
      p_scope
    );
    return query select false, v_grant.id, 'access_denied'::text;
    return;
  end if;

  if v_grant.state <> 'active'
    or not (p_scope = any(v_grant.scopes)) then
    v_result := case v_grant.state
      when 'expired' then 'expired'
      when 'revoked' then 'revoked'
      else 'denied'
    end;
    perform public.eh170_write_access_event(
      p_clinic_id,
      p_patient_profile_id,
      p_actor_profile_id,
      v_grant.id,
      v_resource_kind,
      p_operation,
      v_result,
      p_scope
    );
    return query select false, v_grant.id, 'access_denied'::text;
    return;
  end if;

  perform public.eh170_write_access_event(
    p_clinic_id,
    p_patient_profile_id,
    p_actor_profile_id,
    v_grant.id,
    v_resource_kind,
    p_operation,
    'allowed',
    p_scope
  );
  return query select true, v_grant.id, null::text;
end;
$$;

create or replace function public.eh170_create_clinic(
  p_actor_profile_id uuid,
  p_name text
)
returns table (
  clinic_id uuid,
  membership_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_membership_id uuid;
begin
  if p_actor_profile_id is null
    or not exists (select 1 from public.profiles where id = p_actor_profile_id)
    or p_name is null
    or length(btrim(p_name)) not between 1 and 160 then
    raise exception using message = 'eh170_clinic_input_invalid';
  end if;

  insert into public.clinics (name, created_by_profile_id)
  values (btrim(p_name), p_actor_profile_id)
  returning id into v_clinic_id;

  insert into public.clinic_memberships (
    clinic_id,
    clinician_profile_id,
    role,
    status,
    invited_by_profile_id,
    accepted_at
  )
  values (
    v_clinic_id,
    p_actor_profile_id,
    'owner',
    'active',
    p_actor_profile_id,
    clock_timestamp()
  )
  returning id into v_membership_id;

  perform public.eh170_write_access_event(
    v_clinic_id,
    null,
    p_actor_profile_id,
    null,
    'clinic',
    'create',
    'allowed',
    null
  );

  return query select v_clinic_id, v_membership_id;
end;
$$;

create or replace function public.eh170_invite_patient_access(
  p_actor_profile_id uuid,
  p_clinic_id uuid,
  p_patient_profile_id uuid,
  p_requested_scopes text[],
  p_expires_at timestamptz default null
)
returns table (
  grant_id uuid,
  state text,
  scopes text[],
  requested_scopes text[],
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.patient_access_grants%rowtype;
  v_scopes text[] := coalesce(p_requested_scopes, '{}'::text[]);
begin
  if not public.eh170_scopes_valid(v_scopes)
    or p_actor_profile_id is null
    or p_clinic_id is null
    or p_patient_profile_id is null
    or (p_expires_at is not null and p_expires_at <= clock_timestamp()) then
    raise exception using message = 'eh170_grant_input_invalid';
  end if;

  if not exists (
    select 1
    from public.clinic_memberships
    where clinic_id = p_clinic_id
      and clinician_profile_id = p_actor_profile_id
      and status = 'active'
  ) then
    raise exception using message = 'eh170_access_denied';
  end if;

  if not exists (select 1 from public.profiles where id = p_patient_profile_id) then
    raise exception using message = 'eh170_access_denied';
  end if;

  if exists (
    select 1
    from public.patient_access_grants
    where clinic_id = p_clinic_id
      and patient_profile_id = p_patient_profile_id
      and clinician_profile_id = p_actor_profile_id
      and state in ('pending', 'active')
  ) then
    raise exception using message = 'eh170_grant_exists';
  end if;

  insert into public.patient_access_grants (
    clinic_id,
    patient_profile_id,
    clinician_profile_id,
    scopes,
    requested_scopes,
    state,
    issued_by_profile_id,
    expires_at
  )
  values (
    p_clinic_id,
    p_patient_profile_id,
    p_actor_profile_id,
    v_scopes,
    v_scopes,
    'pending',
    p_actor_profile_id,
    p_expires_at
  )
  returning * into v_grant;

  perform public.eh170_write_access_event(
    p_clinic_id,
    p_patient_profile_id,
    p_actor_profile_id,
    v_grant.id,
    'grant',
    'create',
    'allowed',
    null
  );

  return query select v_grant.id, v_grant.state, v_grant.scopes, v_grant.requested_scopes, v_grant.expires_at;
end;
$$;

create or replace function public.eh170_approve_patient_access(
  p_patient_profile_id uuid,
  p_grant_id uuid,
  p_scopes text[] default null
)
returns table (
  grant_id uuid,
  state text,
  scopes text[],
  requested_scopes text[],
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.patient_access_grants%rowtype;
  v_scopes text[];
begin
  select * into v_grant
  from public.patient_access_grants
  where id = p_grant_id
    and patient_profile_id = p_patient_profile_id
  for update;

  if v_grant.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;

  if v_grant.state = 'active' then
    return query select v_grant.id, v_grant.state, v_grant.scopes, v_grant.requested_scopes, v_grant.expires_at;
    return;
  end if;

  if v_grant.state <> 'pending'
    or (v_grant.expires_at is not null and v_grant.expires_at <= clock_timestamp())
    or not exists (
      select 1
      from public.clinic_memberships
      where clinic_id = v_grant.clinic_id
        and clinician_profile_id = v_grant.clinician_profile_id
        and status = 'active'
    ) then
    if v_grant.expires_at is not null and v_grant.expires_at <= clock_timestamp() then
      update public.patient_access_grants
      set state = 'expired', updated_at = clock_timestamp()
      where id = v_grant.id;
      perform public.eh170_write_access_event(
        v_grant.clinic_id,
        v_grant.patient_profile_id,
        p_patient_profile_id,
        v_grant.id,
        'grant',
        'approve',
        'expired',
        null
      );
    end if;
    raise exception using message = 'eh170_access_denied';
  end if;

  v_scopes := coalesce(p_scopes, v_grant.requested_scopes);
  if not public.eh170_scopes_valid(v_scopes)
    or not (v_scopes <@ v_grant.requested_scopes) then
    raise exception using message = 'eh170_grant_scope_invalid';
  end if;

  update public.patient_access_grants
  set scopes = v_scopes,
      state = 'active',
      approved_by_profile_id = p_patient_profile_id,
      approved_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = v_grant.id
  returning * into v_grant;

  perform public.eh170_write_access_event(
    v_grant.clinic_id,
    v_grant.patient_profile_id,
    p_patient_profile_id,
    v_grant.id,
    'grant',
    'approve',
    'allowed',
    null
  );

  return query select v_grant.id, v_grant.state, v_grant.scopes, v_grant.requested_scopes, v_grant.expires_at;
end;
$$;

create or replace function public.eh170_update_patient_access_scopes(
  p_patient_profile_id uuid,
  p_grant_id uuid,
  p_scopes text[]
)
returns table (
  grant_id uuid,
  state text,
  scopes text[],
  requested_scopes text[],
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.patient_access_grants%rowtype;
begin
  if not public.eh170_scopes_valid(p_scopes) then
    raise exception using message = 'eh170_grant_scope_invalid';
  end if;

  select * into v_grant
  from public.patient_access_grants
  where id = p_grant_id
    and patient_profile_id = p_patient_profile_id
  for update;

  if v_grant.id is null
    or v_grant.state <> 'active'
    or not (p_scopes <@ v_grant.scopes) then
    raise exception using message = 'eh170_access_denied';
  end if;

  update public.patient_access_grants
  set scopes = p_scopes,
      updated_at = clock_timestamp()
  where id = v_grant.id
  returning * into v_grant;

  perform public.eh170_write_access_event(
    v_grant.clinic_id,
    v_grant.patient_profile_id,
    p_patient_profile_id,
    v_grant.id,
    'grant',
    'update',
    'allowed',
    null
  );

  return query select v_grant.id, v_grant.state, v_grant.scopes, v_grant.requested_scopes, v_grant.expires_at;
end;
$$;

create or replace function public.eh170_revoke_patient_access(
  p_patient_profile_id uuid,
  p_grant_id uuid
)
returns table (
  grant_id uuid,
  state text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.patient_access_grants%rowtype;
begin
  select * into v_grant
  from public.patient_access_grants
  where id = p_grant_id
    and patient_profile_id = p_patient_profile_id
  for update;

  if v_grant.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;

  if v_grant.state in ('revoked', 'expired', 'declined') then
    return query select v_grant.id, v_grant.state, v_grant.revoked_at;
    return;
  end if;

  update public.patient_access_grants
  set state = 'revoked',
      revoked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = v_grant.id
  returning * into v_grant;

  perform public.eh170_write_access_event(
    v_grant.clinic_id,
    v_grant.patient_profile_id,
    p_patient_profile_id,
    v_grant.id,
    'grant',
    'revoke',
    'allowed',
    null
  );

  return query select v_grant.id, v_grant.state, v_grant.revoked_at;
end;
$$;

create or replace function public.eh170_expire_patient_access(
  p_grant_id uuid
)
returns table (
  grant_id uuid,
  state text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.patient_access_grants%rowtype;
begin
  select * into v_grant
  from public.patient_access_grants
  where id = p_grant_id
    and state in ('pending', 'active')
    and expires_at is not null
    and expires_at <= clock_timestamp()
  for update;

  if v_grant.id is null then
    return;
  end if;

  update public.patient_access_grants
  set state = 'expired', updated_at = clock_timestamp()
  where id = v_grant.id
  returning * into v_grant;

  perform public.eh170_write_access_event(
    v_grant.clinic_id,
    v_grant.patient_profile_id,
    null,
    v_grant.id,
    'grant',
    'expire',
    'expired',
    null
  );

  return query select v_grant.id, v_grant.state;
end;
$$;

revoke all on function public.eh170_authorize_patient_access(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.eh170_authorize_patient_access(uuid, uuid, uuid, text, text)
  to service_role;
revoke all on function public.eh170_create_clinic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh170_create_clinic(uuid, text)
  to service_role;
revoke all on function public.eh170_invite_patient_access(uuid, uuid, uuid, text[], timestamptz)
  from public, anon, authenticated;
grant execute on function public.eh170_invite_patient_access(uuid, uuid, uuid, text[], timestamptz)
  to service_role;
revoke all on function public.eh170_approve_patient_access(uuid, uuid, text[])
  from public, anon, authenticated;
grant execute on function public.eh170_approve_patient_access(uuid, uuid, text[])
  to service_role;
revoke all on function public.eh170_update_patient_access_scopes(uuid, uuid, text[])
  from public, anon, authenticated;
grant execute on function public.eh170_update_patient_access_scopes(uuid, uuid, text[])
  to service_role;
revoke all on function public.eh170_revoke_patient_access(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_revoke_patient_access(uuid, uuid)
  to service_role;
revoke all on function public.eh170_expire_patient_access(uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_expire_patient_access(uuid)
  to service_role;

revoke all on table public.clinics from public, anon, authenticated, service_role;
revoke all on table public.clinic_memberships from public, anon, authenticated, service_role;
revoke all on table public.patient_access_grants from public, anon, authenticated, service_role;
revoke all on table public.consultations from public, anon, authenticated, service_role;
revoke all on table public.consultation_sources from public, anon, authenticated, service_role;
revoke all on table public.consultation_recording_consents from public, anon, authenticated, service_role;
revoke all on table public.recording_sessions from public, anon, authenticated, service_role;
revoke all on table public.transcript_drafts from public, anon, authenticated, service_role;
revoke all on table public.consultation_note_revisions from public, anon, authenticated, service_role;
revoke all on table public.clinical_access_events from public, anon, authenticated, service_role;

create policy "eh170_deny_direct_clinics"
  on public.clinics for all to public using (false) with check (false);
create policy "eh170_deny_direct_clinic_memberships"
  on public.clinic_memberships for all to public using (false) with check (false);
create policy "eh170_deny_direct_patient_access_grants"
  on public.patient_access_grants for all to public using (false) with check (false);
create policy "eh170_deny_direct_consultations"
  on public.consultations for all to public using (false) with check (false);
create policy "eh170_deny_direct_consultation_sources"
  on public.consultation_sources for all to public using (false) with check (false);
create policy "eh170_deny_direct_recording_consents"
  on public.consultation_recording_consents for all to public using (false) with check (false);
create policy "eh170_deny_direct_recording_sessions"
  on public.recording_sessions for all to public using (false) with check (false);
create policy "eh170_deny_direct_transcript_drafts"
  on public.transcript_drafts for all to public using (false) with check (false);
create policy "eh170_deny_direct_consultation_note_revisions"
  on public.consultation_note_revisions for all to public using (false) with check (false);
create policy "eh170_deny_direct_clinical_access_events"
  on public.clinical_access_events for all to public using (false) with check (false);

drop policy if exists "eh170_deny_direct_doctor_recordings"
  on storage.objects;
create policy "eh170_deny_direct_doctor_recordings"
  on storage.objects for all to public
  using (bucket_id = 'doctor-recordings' and false)
  with check (bucket_id = 'doctor-recordings' and false);

notify pgrst, 'reload schema';
