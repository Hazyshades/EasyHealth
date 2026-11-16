-- EH-170: runtime authorization, clinic reads, consultation, consent, and Dictaphone lifecycle.

alter table public.recording_sessions
  add column if not exists transcription_attempts integer not null default 0,
  add column if not exists transcription_max_attempts integer not null default 3,
  add column if not exists transcription_lease_token uuid,
  add column if not exists transcription_lease_expires_at timestamptz,
  add column if not exists transcription_worker_id text,
  add column if not exists transcription_retryable boolean not null default false,
  add column if not exists transcription_retry_at timestamptz,
  add column if not exists transcription_provider text,
  add column if not exists transcription_model text,
  add column if not exists transcription_started_at timestamptz;

alter table public.recording_sessions
  drop constraint if exists recording_sessions_transcription_attempts_check;
alter table public.recording_sessions
  add constraint recording_sessions_transcription_attempts_check
  check (transcription_attempts >= 0 and transcription_max_attempts > 0);

alter table public.clinical_access_events
  drop constraint if exists clinical_access_events_operation_check;
alter table public.clinical_access_events
  add constraint clinical_access_events_operation_check
  check (operation in ('read', 'create', 'update', 'review', 'export', 'approve', 'revoke', 'expire', 'delete'));

create unique index if not exists consultation_recording_consent_active_unique
  on public.consultation_recording_consents (consultation_id, clinician_profile_id)
  where state = 'active';

create index if not exists recording_sessions_transcription_queue_idx
  on public.recording_sessions (status, transcription_retry_at, transcription_lease_expires_at)
  where status in ('uploaded', 'failed');

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
set search_path = public, pg_temp
as $$
declare
  v_grant public.patient_access_grants%rowtype;
  v_resource_kind text;
  v_result text;
  v_operation text := coalesce(p_operation, 'read');
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
    or v_operation not in ('read', 'create', 'update', 'review', 'export', 'approve', 'revoke', 'delete') then
    return query select false, null::uuid, 'access_denied'::text;
    return;
  end if;

  -- The patient owner may read or export their own projection. Mutating
  -- clinician workspace records remains a clinician-only operation.
  if p_actor_profile_id = p_patient_profile_id then
    if v_operation not in ('read', 'export') then
      perform public.eh170_write_access_event(
        p_clinic_id,
        p_patient_profile_id,
        p_actor_profile_id,
        null,
        v_resource_kind,
        v_operation,
        'denied',
        p_scope
      );
      return query select false, null::uuid, 'access_denied'::text;
      return;
    end if;

    perform public.eh170_write_access_event(
      p_clinic_id,
      p_patient_profile_id,
      p_actor_profile_id,
      null,
      v_resource_kind,
      v_operation,
      'allowed',
      p_scope
    );
    return query select true, null::uuid, null::text;
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
      v_operation,
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
      v_operation,
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
    v_grant.state := 'expired';
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
      v_operation,
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
    v_operation,
    'allowed',
    p_scope
  );
  return query select true, v_grant.id, null::text;
end;
$$;

create or replace function public.eh170_list_clinics(
  p_actor_profile_id uuid
)
returns table (
  clinic_id uuid,
  membership_id uuid,
  name text,
  role text,
  membership_status text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    clinics.id,
    memberships.id,
    clinics.name,
    memberships.role,
    memberships.status
  from public.clinic_memberships as memberships
  join public.clinics as clinics on clinics.id = memberships.clinic_id
  where memberships.clinician_profile_id = p_actor_profile_id
    and memberships.status = 'active'
    and clinics.archived_at is null
  order by clinics.name asc, clinics.id asc;
$$;

create or replace function public.eh170_list_workspace_access(
  p_actor_profile_id uuid
)
returns table (
  perspective text,
  grant_id uuid,
  clinic_id uuid,
  clinic_name text,
  patient_profile_id uuid,
  patient_name text,
  clinician_profile_id uuid,
  clinician_name text,
  state text,
  scopes text[],
  requested_scopes text[],
  expires_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    case when grants.patient_profile_id = p_actor_profile_id
      then 'patient' else 'clinician' end,
    grants.id,
    clinics.id,
    clinics.name,
    grants.patient_profile_id,
    coalesce(nullif(btrim(patient.display_name), ''), nullif(btrim(patient.email), ''), 'Patient'),
    grants.clinician_profile_id,
    coalesce(nullif(btrim(clinician.display_name), ''), nullif(btrim(clinician.email), ''), 'Clinician'),
    grants.state,
    grants.scopes,
    grants.requested_scopes,
    grants.expires_at,
    grants.created_at
  from public.patient_access_grants as grants
  join public.clinics as clinics on clinics.id = grants.clinic_id
  join public.profiles as patient on patient.id = grants.patient_profile_id
  join public.profiles as clinician on clinician.id = grants.clinician_profile_id
  where grants.patient_profile_id = p_actor_profile_id
     or (
       grants.clinician_profile_id = p_actor_profile_id
       and clinics.archived_at is null
       and exists (
         select 1
         from public.clinic_memberships as memberships
         where memberships.clinic_id = grants.clinic_id
           and memberships.clinician_profile_id = p_actor_profile_id
           and memberships.status = 'active'
       )
     )
  order by grants.created_at desc;
$$;

create or replace function public.eh170_list_consultations(
  p_actor_profile_id uuid,
  p_clinic_id uuid default null,
  p_patient_profile_id uuid default null
)
returns table (
  consultation_id uuid,
  clinic_id uuid,
  patient_profile_id uuid,
  patient_name text,
  clinician_profile_id uuid,
  clinician_name text,
  title text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz,
  sources jsonb,
  latest_note jsonb,
  recording_consent_id uuid,
  recording_consent_state text,
  recording_consent_expires_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    consultations.id,
    consultations.clinic_id,
    consultations.patient_profile_id,
    coalesce(nullif(btrim(patient.display_name), ''), nullif(btrim(patient.email), ''), 'Patient'),
    consultations.clinician_profile_id,
    coalesce(nullif(btrim(clinician.display_name), ''), nullif(btrim(clinician.email), ''), 'Clinician'),
    consultations.title,
    consultations.status,
    consultations.started_at,
    consultations.ended_at,
    consultations.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source_kind', sources.source_kind,
          'source_id', sources.source_id,
          'availability', case
            when sources.source_kind = 'observation' and exists (
              select 1 from public.observations
              where observations.id = sources.source_id
                and observations.profile_id = consultations.patient_profile_id
            ) then 'available'
            when sources.source_kind = 'document' and exists (
              select 1 from public.documents
              where documents.id = sources.source_id
                and documents.profile_id = consultations.patient_profile_id
                and documents.lifecycle_state = 'active'
                and documents.upload_state = 'complete'
                and documents.archived_at is null
            ) then 'available'
            when sources.source_kind = 'report' and exists (
              select 1 from public.reports
              where reports.id = sources.source_id
                and reports.profile_id = consultations.patient_profile_id
                and reports.invalidated_at is null
            ) then 'available'
            when sources.source_kind = 'consultation_note' and exists (
              select 1 from public.consultation_note_revisions
              where consultation_note_revisions.id = sources.source_id
                and consultation_note_revisions.patient_profile_id = consultations.patient_profile_id
                and consultation_note_revisions.status <> 'deleted'
            ) then 'available'
            else 'unavailable'
          end
        ) order by sources.created_at asc
      )
      from public.consultation_sources as sources
      where sources.consultation_id = consultations.id
    ), '[]'::jsonb),
    (
      select jsonb_build_object(
        'id', revisions.id,
        'revision_number', revisions.revision_number,
        'status', revisions.status,
        'content', revisions.content,
        'source_references', revisions.source_references,
        'authored_by_profile_id', revisions.authored_by_profile_id,
        'reviewed_by_profile_id', revisions.reviewed_by_profile_id,
        'reviewed_at', revisions.reviewed_at
      )
      from public.consultation_note_revisions as revisions
      where revisions.consultation_id = consultations.id
        and revisions.status <> 'deleted'
      order by revisions.revision_number desc
      limit 1
    ),
    (
      select consents.id
      from public.consultation_recording_consents as consents
      where consents.consultation_id = consultations.id
      order by consents.granted_at desc
      limit 1
    ),
    (
      select case
        when consents.state = 'active'
          and consents.expires_at is not null
          and consents.expires_at <= clock_timestamp() then 'expired'
        else consents.state
      end
      from public.consultation_recording_consents as consents
      where consents.consultation_id = consultations.id
      order by consents.granted_at desc
      limit 1
    ),
    (
      select consents.expires_at
      from public.consultation_recording_consents as consents
      where consents.consultation_id = consultations.id
      order by consents.granted_at desc
      limit 1
    )
  from public.consultations
  join public.profiles as patient on patient.id = consultations.patient_profile_id
  join public.profiles as clinician on clinician.id = consultations.clinician_profile_id
  where (p_clinic_id is null or consultations.clinic_id = p_clinic_id)
    and (p_patient_profile_id is null or consultations.patient_profile_id = p_patient_profile_id)
    and exists (
      select 1
      from public.eh170_authorize_patient_access(
        p_actor_profile_id,
        consultations.clinic_id,
        consultations.patient_profile_id,
        'consultations',
        'read'
      ) as access
      where access.allowed
    )
  order by consultations.created_at desc;
$$;

create or replace function public.eh170_create_consultation(
  p_actor_profile_id uuid,
  p_clinic_id uuid,
  p_patient_profile_id uuid,
  p_title text default 'Consultation'
)
returns table (
  consultation_id uuid,
  clinic_id uuid,
  patient_profile_id uuid,
  clinician_profile_id uuid,
  title text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access record;
  v_consultation public.consultations%rowtype;
begin
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    p_clinic_id,
    p_patient_profile_id,
    'consultations',
    'create'
  );
  if not coalesce(v_access.allowed, false) then
    raise exception using message = 'eh170_access_denied';
  end if;

  if p_title is null or length(btrim(p_title)) not between 1 and 240 then
    raise exception using message = 'eh170_consultation_input_invalid';
  end if;

  insert into public.consultations (
    clinic_id,
    patient_profile_id,
    clinician_profile_id,
    status,
    title,
    started_at,
    created_by_profile_id
  )
  values (
    p_clinic_id,
    p_patient_profile_id,
    p_actor_profile_id,
    'in_progress',
    btrim(p_title),
    clock_timestamp(),
    p_actor_profile_id
  )
  returning * into v_consultation;

  perform public.eh170_write_access_event(
    p_clinic_id,
    p_patient_profile_id,
    p_actor_profile_id,
    v_access.grant_id,
    'consultation',
    'create',
    'allowed',
    'consultations'
  );

  return query select
    v_consultation.id,
    v_consultation.clinic_id,
    v_consultation.patient_profile_id,
    v_consultation.clinician_profile_id,
    v_consultation.title,
    v_consultation.status,
    v_consultation.created_at;
end;
$$;

create or replace function public.eh170_grant_recording_consent(
  p_patient_profile_id uuid,
  p_consultation_id uuid,
  p_expires_at timestamptz default null
)
returns table (
  consent_id uuid,
  consultation_id uuid,
  state text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consultation public.consultations%rowtype;
  v_consent public.consultation_recording_consents%rowtype;
begin
  select * into v_consultation
  from public.consultations
  where id = p_consultation_id
    and patient_profile_id = p_patient_profile_id;
  if v_consultation.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  if p_expires_at is not null and p_expires_at <= clock_timestamp() then
    raise exception using message = 'eh170_consent_input_invalid';
  end if;

  insert into public.consultation_recording_consents (
    consultation_id,
    patient_profile_id,
    clinician_profile_id,
    state,
    granted_at,
    expires_at
  )
  values (
    v_consultation.id,
    p_patient_profile_id,
    v_consultation.clinician_profile_id,
    'active',
    clock_timestamp(),
    p_expires_at
  )
  returning * into v_consent;

  perform public.eh170_write_access_event(
    v_consultation.clinic_id,
    p_patient_profile_id,
    p_patient_profile_id,
    null,
    'consent',
    'approve',
    'allowed',
    'consultations'
  );

  return query select v_consent.id, v_consent.consultation_id, v_consent.state, v_consent.expires_at;
end;
$$;

create or replace function public.eh170_revoke_recording_consent(
  p_patient_profile_id uuid,
  p_consent_id uuid
)
returns table (
  consent_id uuid,
  consultation_id uuid,
  state text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consent public.consultation_recording_consents%rowtype;
  v_clinic_id uuid;
begin
select consents.*
into v_consent
from public.consultation_recording_consents as consents
where consents.id = p_consent_id
  and consents.patient_profile_id = p_patient_profile_id
for update;
select consultations.clinic_id
into v_clinic_id
from public.consultations
where consultations.id = v_consent.consultation_id;
  if v_consent.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  if v_consent.state = 'revoked' then
    return query select v_consent.id, v_consent.consultation_id, v_consent.state, v_consent.revoked_at;
    return;
  end if;

  update public.consultation_recording_consents
  set state = 'revoked',
      revoked_at = clock_timestamp()
  where id = v_consent.id
  returning * into v_consent;

  perform public.eh170_write_access_event(
    v_clinic_id,
    v_consent.patient_profile_id,
    p_patient_profile_id,
    null,
    'consent',
    'revoke',
    'allowed',
    'consultations'
  );

  return query select v_consent.id, v_consent.consultation_id, v_consent.state, v_consent.revoked_at;
end;
$$;

create or replace function public.eh170_start_recording(
  p_actor_profile_id uuid,
  p_consultation_id uuid,
  p_source_language text default null
)
returns table (
  recording_id uuid,
  consultation_id uuid,
  patient_profile_id uuid,
  clinician_profile_id uuid,
  status text,
  source_language text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consultation public.consultations%rowtype;
  v_access record;
  v_consent public.consultation_recording_consents%rowtype;
  v_recording public.recording_sessions%rowtype;
begin
  select * into v_consultation
  from public.consultations
  where id = p_consultation_id;
  if v_consultation.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;

  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_consultation.patient_profile_id,
    'consultations',
    'create'
  );
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_consultation.clinician_profile_id then
    raise exception using message = 'eh170_access_denied';
  end if;

  select * into v_consent
  from public.consultation_recording_consents as consents
  where consents.consultation_id = v_consultation.id
    and consents.patient_profile_id = v_consultation.patient_profile_id
    and consents.clinician_profile_id = p_actor_profile_id
    and consents.state = 'active'
    and (consents.expires_at is null or consents.expires_at > clock_timestamp())
  order by consents.granted_at desc
  limit 1;
  if v_consent.id is null then
    raise exception using message = 'eh170_recording_consent_required';
  end if;

  insert into public.recording_sessions (
    consultation_id,
    patient_profile_id,
    clinician_profile_id,
    consent_id,
    status,
    source_language,
    started_at
  )
  values (
    v_consultation.id,
    v_consultation.patient_profile_id,
    p_actor_profile_id,
    v_consent.id,
    'recording',
    nullif(btrim(p_source_language), ''),
    clock_timestamp()
  )
  returning * into v_recording;

  perform public.eh170_write_access_event(
    v_consultation.clinic_id,
    v_consultation.patient_profile_id,
    p_actor_profile_id,
    v_access.grant_id,
    'recording',
    'create',
    'allowed',
    'consultations'
  );

  return query select
    v_recording.id,
    v_recording.consultation_id,
    v_recording.patient_profile_id,
    v_recording.clinician_profile_id,
    v_recording.status,
    v_recording.source_language,
    v_recording.created_at;
end;
$$;

create or replace function public.eh170_prepare_recording_upload(
  p_actor_profile_id uuid,
  p_recording_id uuid,
  p_storage_path text
)
returns table (
  recording_id uuid,
  storage_path text,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
  select recordings.*
  into v_recording
  from public.recording_sessions as recordings
  where recordings.id = p_recording_id
  for update;
  select consultations.*
  into v_consultation
  from public.consultations
  where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;

  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'update'
  );
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_recording.clinician_profile_id then
    raise exception using message = 'eh170_access_denied';
  end if;
  if not exists (
    select 1
    from public.consultation_recording_consents as consents
    where consents.id = v_recording.consent_id
      and consents.state = 'active'
      and (consents.expires_at is null or consents.expires_at > clock_timestamp())
  ) then
    raise exception using message = 'eh170_recording_consent_required';
  end if;
  if v_recording.status not in ('recording', 'uploading') then
    raise exception using message = 'eh170_recording_state_invalid';
  end if;
  if p_storage_path is null
    or p_storage_path !~ '^consultations/[0-9a-f-]+/recordings/[0-9a-f-]+\.(aac|flac|m4a|mp3|mp4|ogg|wav|webm)$' then
    raise exception using message = 'eh170_recording_path_invalid';
  end if;

  update public.recording_sessions
  set status = 'uploading',
      storage_path = p_storage_path,
      source_audio_deleted_at = null,
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning id, storage_path, status into v_recording.id, v_recording.storage_path, v_recording.status;

  return query select v_recording.id, v_recording.storage_path, v_recording.status;
end;
$$;

create or replace function public.eh170_complete_recording_upload(
  p_actor_profile_id uuid,
  p_recording_id uuid,
  p_source_language text default null
)
returns table (
  recording_id uuid,
  status text,
  uploaded_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id
for update;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'update'
  );
  if not exists (
    select 1
    from public.consultation_recording_consents
    where id = v_recording.consent_id
      and state = 'active'
      and (expires_at is null or expires_at > clock_timestamp())
  ) then
    raise exception using message = 'eh170_recording_consent_required';
  end if;
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_recording.clinician_profile_id
    or v_recording.status <> 'uploading'
    or v_recording.storage_path is null then
    raise exception using message = 'eh170_access_denied';
  end if;

  update public.recording_sessions
  set status = 'uploaded',
      source_language = coalesce(nullif(btrim(p_source_language), ''), source_language),
      uploaded_at = clock_timestamp(),
      updated_at = clock_timestamp(),
      transcription_retryable = false,
      transcription_retry_at = null,
      failure_code = null
  where id = v_recording.id
  returning id, status, uploaded_at into v_recording.id, v_recording.status, v_recording.uploaded_at;

  return query select v_recording.id, v_recording.status, v_recording.uploaded_at;
end;
$$;

create or replace function public.eh170_cancel_recording(
  p_actor_profile_id uuid,
  p_recording_id uuid
)
returns table (
  recording_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id
for update;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'update'
  );
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_recording.clinician_profile_id then
    raise exception using message = 'eh170_access_denied';
  end if;
  if v_recording.status in ('completed', 'clinician_reviewed', 'deleted') then
    raise exception using message = 'eh170_recording_state_invalid';
  end if;

  update public.recording_sessions
  set status = 'cancelled',
      transcription_lease_token = null,
      transcription_lease_expires_at = null,
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning id, status into v_recording.id, v_recording.status;

  return query select v_recording.id, v_recording.status;
end;
$$;

create or replace function public.eh170_read_recording(
  p_actor_profile_id uuid,
  p_recording_id uuid
)
returns table (
  recording_id uuid,
  consultation_id uuid,
  clinic_id uuid,
  patient_profile_id uuid,
  clinician_profile_id uuid,
  status text,
  storage_path text,
  source_language text,
  failure_code text,
  transcription_retryable boolean,
  source_audio_deleted_at timestamptz,
  transcript_status text,
  transcript_text text,
  transcript_source_language text,
  latest_note jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    return;
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'read'
  );
  if not coalesce(v_access.allowed, false) then
    return;
  end if;

  return query select
    v_recording.id,
    v_recording.consultation_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    v_recording.clinician_profile_id,
    v_recording.status,
    v_recording.storage_path,
    v_recording.source_language,
    v_recording.failure_code,
    v_recording.transcription_retryable,
    v_recording.source_audio_deleted_at,
    transcript.status,
    transcript.transcript_text,
    transcript.source_language,
    (
      select jsonb_build_object(
        'id', revisions.id,
        'revision_number', revisions.revision_number,
        'status', revisions.status,
        'content', revisions.content,
        'source_references', revisions.source_references,
        'reviewed_by_profile_id', revisions.reviewed_by_profile_id,
        'reviewed_at', revisions.reviewed_at
      )
      from public.consultation_note_revisions as revisions
      where revisions.consultation_id = v_recording.consultation_id
        and revisions.status <> 'deleted'
      order by revisions.revision_number desc
      limit 1
    ),
    v_recording.created_at,
    v_recording.updated_at
  from public.recording_sessions as current_recording
  left join public.transcript_drafts as transcript
    on transcript.recording_session_id = current_recording.id
  where current_recording.id = v_recording.id;
end;
$$;

create or replace function public.eh170_list_recordings(
  p_actor_profile_id uuid,
  p_consultation_id uuid default null
)
returns table (
  recording_id uuid,
  consultation_id uuid,
  clinic_id uuid,
  patient_profile_id uuid,
  clinician_profile_id uuid,
  status text,
  source_language text,
  failure_code text,
  transcription_retryable boolean,
  source_audio_deleted_at timestamptz,
  transcript_status text,
  latest_note_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    recordings.id,
    recordings.consultation_id,
    consultations.clinic_id,
    recordings.patient_profile_id,
    recordings.clinician_profile_id,
    recordings.status,
    recordings.source_language,
    recordings.failure_code,
    recordings.transcription_retryable,
    recordings.source_audio_deleted_at,
    transcript.status,
    latest_note.status,
    recordings.created_at,
    recordings.updated_at
  from public.recording_sessions as recordings
  join public.consultations on consultations.id = recordings.consultation_id
  left join public.transcript_drafts as transcript
    on transcript.recording_session_id = recordings.id
  left join lateral (
    select revisions.status
    from public.consultation_note_revisions as revisions
    where revisions.consultation_id = recordings.consultation_id
      and revisions.status <> 'deleted'
    order by revisions.revision_number desc
    limit 1
  ) as latest_note on true
  where (p_consultation_id is null or recordings.consultation_id = p_consultation_id)
    and exists (
      select 1
      from public.eh170_authorize_patient_access(
        p_actor_profile_id,
        consultations.clinic_id,
        recordings.patient_profile_id,
        'consultations',
        'read'
      ) as access
      where access.allowed
    )
  order by recordings.created_at desc;
$$;

create or replace function public.eh170_claim_recording_transcription(
  p_worker_id text
)
returns table (
  recording_id uuid,
  consultation_id uuid,
  clinic_id uuid,
  patient_profile_id uuid,
  clinician_profile_id uuid,
  storage_path text,
  source_language text,
  attempt_number integer,
  lease_token uuid,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_clinic_id uuid;
  v_lease uuid;
begin
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    return;
  end if;

select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.storage_path is not null
  and recordings.source_audio_deleted_at is null
  and (
    recordings.status = 'uploaded'
    or (
      recordings.status = 'failed'
      and recordings.transcription_retryable
      and (recordings.transcription_retry_at is null or recordings.transcription_retry_at <= clock_timestamp())
    )
  )
  and (recordings.transcription_lease_expires_at is null or recordings.transcription_lease_expires_at <= clock_timestamp())
  and exists (
    select 1
    from public.consultation_recording_consents as consents
    where consents.id = recordings.consent_id
      and consents.state = 'active'
      and (consents.expires_at is null or consents.expires_at > clock_timestamp())
  )
  and exists (
    select 1
    from public.clinic_memberships as memberships
    join public.clinics on clinics.id = memberships.clinic_id
    join public.patient_access_grants as grants
      on grants.clinic_id = memberships.clinic_id
     and grants.patient_profile_id = recordings.patient_profile_id
     and grants.clinician_profile_id = recordings.clinician_profile_id
    join public.consultations on consultations.id = recordings.consultation_id
    where memberships.clinic_id = consultations.clinic_id
      and memberships.clinician_profile_id = recordings.clinician_profile_id
      and memberships.status = 'active'
      and clinics.archived_at is null
      and grants.state = 'active'
      and 'consultations' = any(grants.scopes)
      and (grants.expires_at is null or grants.expires_at > clock_timestamp())
  )
  order by recordings.created_at asc
for update skip locked
limit 1;
select consultations.clinic_id
into v_clinic_id
from public.consultations
where consultations.id = v_recording.consultation_id;

  if v_recording.id is null then
    return;
  end if;

  v_lease := gen_random_uuid();
  update public.recording_sessions
  set status = 'transcribing',
      transcription_attempts = transcription_attempts + 1,
      transcription_lease_token = v_lease,
      transcription_lease_expires_at = clock_timestamp() + interval '10 minutes',
      transcription_worker_id = btrim(p_worker_id),
      transcription_started_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning * into v_recording;

  return query select
    v_recording.id,
    v_recording.consultation_id,
    v_clinic_id,
    v_recording.patient_profile_id,
    v_recording.clinician_profile_id,
    v_recording.storage_path,
    v_recording.source_language,
    v_recording.transcription_attempts,
    v_recording.transcription_lease_token,
    v_recording.transcription_lease_expires_at;
end;
$$;

create or replace function public.eh170_complete_recording_transcription(
  p_recording_id uuid,
  p_lease_token uuid,
  p_transcript_text text,
  p_source_language text,
  p_provider text,
  p_model text
)
returns table (
  recording_id uuid,
  status text,
  transcript_id uuid,
  transcript_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_consent public.consultation_recording_consents%rowtype;
  v_access record;
  v_transcript public.transcript_drafts%rowtype;
begin
  if p_transcript_text is null or length(btrim(p_transcript_text)) = 0 or length(p_transcript_text) > 2000000 then
    raise exception using message = 'eh170_transcript_input_invalid';
  end if;
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id
  and recordings.status = 'transcribing'
  and recordings.transcription_lease_token = p_lease_token
  and recordings.transcription_lease_expires_at > clock_timestamp()
for update;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_transcription_lease_invalid';
  end if;

  select * into v_access
  from public.eh170_authorize_patient_access(
    v_recording.clinician_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'update'
  );
  if not coalesce(v_access.allowed, false) then
    update public.recording_sessions
    set status = 'failed',
        failure_code = 'access_revoked',
        transcription_retryable = false,
        transcription_lease_token = null,
        transcription_lease_expires_at = null,
        updated_at = clock_timestamp()
    where id = v_recording.id
    returning id, status into v_recording.id, v_recording.status;
    return query select v_recording.id, v_recording.status, null::uuid, null::text;
    return;
  end if;

  select * into v_consent
  from public.consultation_recording_consents as consents
  where consents.id = v_recording.consent_id
    and consents.state = 'active'
    and (consents.expires_at is null or consents.expires_at > clock_timestamp());
  if v_consent.id is null then
    update public.recording_sessions
    set status = 'failed',
        failure_code = 'access_revoked',
        transcription_retryable = false,
        transcription_lease_token = null,
        transcription_lease_expires_at = null,
        updated_at = clock_timestamp()
    where id = v_recording.id
    returning id, status into v_recording.id, v_recording.status;
    return query select v_recording.id, v_recording.status, null::uuid, null::text;
    return;
  end if;

  insert into public.transcript_drafts (
    recording_session_id,
    consultation_id,
    patient_profile_id,
    status,
    transcript_text,
    source_language,
    provider,
    model,
    failure_code
  )
  values (
    v_recording.id,
    v_recording.consultation_id,
    v_recording.patient_profile_id,
    'ready',
    p_transcript_text,
    nullif(btrim(p_source_language), ''),
    nullif(btrim(p_provider), ''),
    nullif(btrim(p_model), ''),
    null
  )
  on conflict (recording_session_id) do update
  set status = 'ready',
      transcript_text = excluded.transcript_text,
      source_language = excluded.source_language,
      provider = excluded.provider,
      model = excluded.model,
      failure_code = null,
      updated_at = clock_timestamp()
  returning * into v_transcript;

  update public.recording_sessions
  set status = 'transcript_ready',
      source_language = coalesce(v_transcript.source_language, source_language),
      transcription_provider = v_transcript.provider,
      transcription_model = v_transcript.model,
      failure_code = null,
      transcription_retryable = false,
      transcription_retry_at = null,
      transcription_lease_token = null,
      transcription_lease_expires_at = null,
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning id, status into v_recording.id, v_recording.status;

  return query select v_recording.id, v_recording.status, v_transcript.id, v_transcript.status;
end;
$$;

create or replace function public.eh170_fail_recording_transcription(
  p_recording_id uuid,
  p_lease_token uuid,
  p_failure_code text,
  p_retryable boolean
)
returns table (
  recording_id uuid,
  status text,
  failure_code text,
  transcription_retryable boolean,
  transcription_retry_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_failure_code text := case p_failure_code
    when 'provider_unavailable' then 'provider_unavailable'
    when 'provider_timeout' then 'provider_timeout'
    when 'provider_rejected' then 'provider_rejected'
    when 'audio_unavailable' then 'audio_unavailable'
    when 'access_revoked' then 'access_revoked'
    else 'transcription_failed'
  end;
  v_can_retry boolean;
begin
  select * into v_recording
  from public.recording_sessions as recordings
  where recordings.id = p_recording_id
    and recordings.status = 'transcribing'
    and recordings.transcription_lease_token = p_lease_token
  for update;
  if v_recording.id is null then
    raise exception using message = 'eh170_transcription_lease_invalid';
  end if;

  v_can_retry := p_retryable and v_failure_code <> 'access_revoked'
    and v_recording.transcription_attempts < v_recording.transcription_max_attempts;
  update public.recording_sessions
  set status = 'failed',
      failure_code = v_failure_code,
      transcription_retryable = v_can_retry,
      transcription_retry_at = case when v_can_retry then clock_timestamp() + interval '1 minute' else null end,
      transcription_lease_token = null,
      transcription_lease_expires_at = null,
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning id, status, failure_code, transcription_retryable, transcription_retry_at
  into v_recording.id, v_recording.status, v_recording.failure_code,
       v_recording.transcription_retryable, v_recording.transcription_retry_at;

  return query select
    v_recording.id,
    v_recording.status,
    v_recording.failure_code,
    v_recording.transcription_retryable,
    v_recording.transcription_retry_at;
end;
$$;

create or replace function public.eh170_retry_recording_transcription(
  p_actor_profile_id uuid,
  p_recording_id uuid
)
returns table (
  recording_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id
for update;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'update'
  );
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_recording.clinician_profile_id
    or v_recording.status <> 'failed'
    or not v_recording.transcription_retryable
    or v_recording.source_audio_deleted_at is not null
    or v_recording.storage_path is null then
    raise exception using message = 'eh170_access_denied';
  end if;

  update public.recording_sessions
  set status = 'uploaded',
      failure_code = null,
      transcription_retryable = false,
      transcription_retry_at = null,
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning id, status into v_recording.id, v_recording.status;
  return query select v_recording.id, v_recording.status;
end;
$$;

create or replace function public.eh170_sanitize_note_content(
  p_content jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when jsonb_typeof(coalesce(p_content, '{}'::jsonb)) = 'object'
      then coalesce(p_content, '{}'::jsonb)
        - 'diagnosis'
        - 'treatment'
        - 'urgency'
        - 'urgency_instruction'
        - 'medication_directive'
    else '{}'::jsonb
  end;
$$;

create or replace function public.eh170_note_source_references_valid(
  p_content jsonb,
  p_source_references jsonb,
  p_recording_id uuid
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
with refs as (
  select value as reference
  from jsonb_array_elements(
    case
      when jsonb_typeof(coalesce(p_source_references, '[]'::jsonb)) = 'array'
        then coalesce(p_source_references, '[]'::jsonb)
      else '[]'::jsonb
    end
  ) as elements(value)
),
fields as (
  select key as field_name
  from jsonb_object_keys(
    case
      when jsonb_typeof(coalesce(p_content, '{}'::jsonb)) = 'object'
        then coalesce(p_content, '{}'::jsonb)
      else '{}'::jsonb
    end
  ) as keys(key)
  where key <> 'limitations'
)
select jsonb_typeof(coalesce(p_source_references, '[]'::jsonb)) = 'array'
  and case
    when jsonb_typeof(coalesce(p_source_references, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(p_source_references, '[]'::jsonb))
    else 0
  end > 0
  and not exists (
    select 1
    from refs
    where jsonb_typeof(reference) <> 'object'
      or nullif(btrim(reference->>'field'), '') is null
      or not (
        (
          reference->>'kind' = 'transcript'
          and reference->>'recording_id' = p_recording_id::text
        )
        or (
          reference->>'kind' = 'unavailable'
          and nullif(btrim(reference->>'reason'), '') is not null
        )
      )
  )
  and not exists (
    select 1
    from fields
    where not exists (
      select 1
      from refs
      where jsonb_typeof(reference) = 'object'
        and reference->>'field' = fields.field_name
    )
  );
$$;

create or replace function public.eh170_create_note_draft(
  p_actor_profile_id uuid,
  p_recording_id uuid,
  p_content jsonb,
  p_source_references jsonb
)
returns table (
  revision_id uuid,
  consultation_id uuid,
  revision_number integer,
  status text,
  content jsonb,
  source_references jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_transcript public.transcript_drafts%rowtype;
  v_access record;
  v_content jsonb;
  v_revision_number integer;
  v_revision public.consultation_note_revisions%rowtype;
begin
  select recordings.*
  into v_recording
  from public.recording_sessions as recordings
  where recordings.id = p_recording_id;
  select consultations.*
  into v_consultation
  from public.consultations
  where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'update'
  );
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_recording.clinician_profile_id then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_transcript
  from public.transcript_drafts as transcripts
  where transcripts.recording_session_id = v_recording.id
    and transcripts.status = 'ready';
  if v_transcript.id is null then
    raise exception using message = 'eh170_transcript_unavailable';
  end if;

  v_content := public.eh170_sanitize_note_content(p_content);
  if p_content ?| array['diagnosis', 'treatment', 'urgency', 'urgency_instruction', 'medication_directive'] then
    v_content := jsonb_set(
      v_content,
      '{limitations}',
      coalesce(v_content->'limitations', '[]'::jsonb) || to_jsonb(array['Unsupported clinical directives were omitted']::text[]),
      true
    );
  end if;
  if not public.eh170_note_source_references_valid(
    v_content,
    p_source_references,
    v_recording.id
  ) then
    raise exception using message = 'eh170_note_source_references_invalid';
  end if;

  select coalesce(max(revisions.revision_number), 0) + 1
  into v_revision_number
  from public.consultation_note_revisions as revisions
  where revisions.consultation_id = v_consultation.id;

  insert into public.consultation_note_revisions (
    consultation_id,
    patient_profile_id,
    recording_session_id,
    transcript_draft_id,
    revision_number,
    status,
    content,
    source_references,
    authored_by_profile_id
  )
  values (
    v_consultation.id,
    v_recording.patient_profile_id,
    v_recording.id,
    v_transcript.id,
    v_revision_number,
    'draft',
    v_content,
    p_source_references,
    p_actor_profile_id
  )
  returning * into v_revision;

  update public.recording_sessions
  set status = 'note_draft', updated_at = clock_timestamp()
  where id = v_recording.id
    and public.recording_sessions.status = 'transcript_ready';

  return query select
    v_revision.id,
    v_revision.consultation_id,
    v_revision.revision_number,
    v_revision.status,
    v_revision.content,
    v_revision.source_references;
end;
$$;

create or replace function public.eh170_save_note_revision(
  p_actor_profile_id uuid,
  p_consultation_id uuid,
  p_recording_id uuid,
  p_transcript_draft_id uuid,
  p_content jsonb,
  p_source_references jsonb,
  p_reviewed boolean default false
)
returns table (
  revision_id uuid,
  consultation_id uuid,
  revision_number integer,
  status text,
  content jsonb,
  source_references jsonb,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consultation public.consultations%rowtype;
  v_recording public.recording_sessions%rowtype;
  v_access record;
  v_revision public.consultation_note_revisions%rowtype;
  v_previous_id uuid;
  v_revision_number integer;
  v_content jsonb;
  v_transcript_draft_id uuid;
begin
  select * into v_consultation
  from public.consultations
  where id = p_consultation_id;
  if v_consultation.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_consultation.patient_profile_id,
    'consultations',
    case when p_reviewed then 'review' else 'update' end
  );
  if not coalesce(v_access.allowed, false)
    or p_actor_profile_id <> v_consultation.clinician_profile_id then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_recording
  from public.recording_sessions as recordings
  where recordings.id = p_recording_id
    and recordings.consultation_id = p_consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  if p_transcript_draft_id is null then
    select transcripts.id
    into v_transcript_draft_id
    from public.transcript_drafts as transcripts
    where transcripts.recording_session_id = p_recording_id
      and transcripts.status = 'ready'
    order by transcripts.updated_at desc
    limit 1;
  else
    v_transcript_draft_id := p_transcript_draft_id;
  end if;
  if v_transcript_draft_id is null
    or not exists (
      select 1
      from public.transcript_drafts as transcripts
      where transcripts.id = v_transcript_draft_id
        and transcripts.recording_session_id = p_recording_id
        and transcripts.status = 'ready'
    ) then
    raise exception using message = 'eh170_transcript_unavailable';
  end if;

  v_content := public.eh170_sanitize_note_content(p_content);
  if p_content ?| array['diagnosis', 'treatment', 'urgency', 'urgency_instruction', 'medication_directive'] then
    v_content := jsonb_set(
      v_content,
      '{limitations}',
      coalesce(v_content->'limitations', '[]'::jsonb) || to_jsonb(array['Unsupported clinical directives were omitted']::text[]),
      true
    );
  end if;
  if not public.eh170_note_source_references_valid(
    v_content,
    p_source_references,
    p_recording_id
  ) then
    raise exception using message = 'eh170_note_source_references_invalid';
  end if;

  select revisions.id, revisions.revision_number
  into v_previous_id, v_revision_number
  from public.consultation_note_revisions as revisions
  where revisions.consultation_id = p_consultation_id
    and revisions.status <> 'deleted'
  order by revisions.revision_number desc
  limit 1
  for update;
  v_revision_number := coalesce(v_revision_number, 0) + 1;

  if v_previous_id is not null then
    update public.consultation_note_revisions
    set status = 'superseded', updated_at = clock_timestamp()
    where id = v_previous_id
      and public.consultation_note_revisions.status in ('draft', 'reviewed');
  end if;

  insert into public.consultation_note_revisions (
    consultation_id,
    patient_profile_id,
    recording_session_id,
    transcript_draft_id,
    revision_number,
    status,
    content,
    source_references,
    authored_by_profile_id,
    reviewed_by_profile_id,
    reviewed_at
  )
  values (
    p_consultation_id,
    v_consultation.patient_profile_id,
    p_recording_id,
    v_transcript_draft_id,
    v_revision_number,
    case when p_reviewed then 'reviewed' else 'draft' end,
    v_content,
    p_source_references,
    p_actor_profile_id,
    case when p_reviewed then p_actor_profile_id else null end,
    case when p_reviewed then clock_timestamp() else null end
  )
  returning * into v_revision;

  update public.recording_sessions
  set status = case when p_reviewed then 'clinician_reviewed' else 'note_draft' end,
      updated_at = clock_timestamp()
  where id = p_recording_id;

  return query select
    v_revision.id,
    v_revision.consultation_id,
    v_revision.revision_number,
    v_revision.status,
    v_revision.content,
    v_revision.source_references,
    v_revision.reviewed_at;
end;
$$;


create or replace function public.eh170_mark_recording_audio_deleted(
  p_actor_profile_id uuid,
  p_recording_id uuid
)
returns table (
  recording_id uuid,
  source_audio_deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id
for update;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'delete'
  );
  if not coalesce(v_access.allowed, false) then
    raise exception using message = 'eh170_access_denied';
  end if;

  update public.recording_sessions
  set source_audio_deleted_at = coalesce(source_audio_deleted_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = v_recording.id
  returning id, source_audio_deleted_at into v_recording.id, v_recording.source_audio_deleted_at;
  return query select v_recording.id, v_recording.source_audio_deleted_at;
end;
$$;

create or replace function public.eh170_delete_transcript(
  p_actor_profile_id uuid,
  p_recording_id uuid
)
returns table (
  recording_id uuid,
  transcript_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
  v_transcript public.transcript_drafts%rowtype;
begin
select recordings.*
into v_recording
from public.recording_sessions as recordings
where recordings.id = p_recording_id;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_recording.consultation_id;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_recording.patient_profile_id,
    'consultations',
    'delete'
  );
  if not coalesce(v_access.allowed, false) then
    raise exception using message = 'eh170_access_denied';
  end if;
  update public.transcript_drafts
  set status = 'deleted', transcript_text = null, updated_at = clock_timestamp()
  where recording_session_id = p_recording_id
  returning id, status into v_transcript.id, v_transcript.status;
  if v_transcript.id is null then
    return query select v_recording.id, null::uuid, 'deleted'::text;
    return;
  end if;
  return query select v_recording.id, v_transcript.id, v_transcript.status;
end;
$$;

create or replace function public.eh170_delete_note_revision(
  p_actor_profile_id uuid,
  p_revision_id uuid
)
returns table (
  revision_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision public.consultation_note_revisions%rowtype;
  v_consultation public.consultations%rowtype;
  v_access record;
begin
select revisions.*
into v_revision
from public.consultation_note_revisions as revisions
where revisions.id = p_revision_id
for update;
select consultations.*
into v_consultation
from public.consultations
where consultations.id = v_revision.consultation_id;
  if v_revision.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_access
  from public.eh170_authorize_patient_access(
    p_actor_profile_id,
    v_consultation.clinic_id,
    v_revision.patient_profile_id,
    'consultations',
    'delete'
  );
  if not coalesce(v_access.allowed, false) then
    raise exception using message = 'eh170_access_denied';
  end if;
  update public.consultation_note_revisions
  set status = 'deleted', content = '{}'::jsonb, source_references = '[]'::jsonb, updated_at = clock_timestamp()
  where id = v_revision.id
  returning id, status into v_revision.id, v_revision.status;
  return query select v_revision.id, v_revision.status;
end;
$$;

revoke all on function public.eh170_authorize_patient_access(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.eh170_authorize_patient_access(uuid, uuid, uuid, text, text)
  to service_role;

revoke all on function public.eh170_list_clinics(uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_list_clinics(uuid)
  to service_role;
revoke all on function public.eh170_list_workspace_access(uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_list_workspace_access(uuid)
  to service_role;
revoke all on function public.eh170_list_consultations(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_list_consultations(uuid, uuid, uuid)
  to service_role;
revoke all on function public.eh170_create_consultation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh170_create_consultation(uuid, uuid, uuid, text)
  to service_role;
revoke all on function public.eh170_grant_recording_consent(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eh170_grant_recording_consent(uuid, uuid, timestamptz)
  to service_role;
revoke all on function public.eh170_revoke_recording_consent(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_revoke_recording_consent(uuid, uuid)
  to service_role;
revoke all on function public.eh170_start_recording(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh170_start_recording(uuid, uuid, text)
  to service_role;
revoke all on function public.eh170_prepare_recording_upload(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh170_prepare_recording_upload(uuid, uuid, text)
  to service_role;
revoke all on function public.eh170_complete_recording_upload(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh170_complete_recording_upload(uuid, uuid, text)
  to service_role;
revoke all on function public.eh170_cancel_recording(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_cancel_recording(uuid, uuid)
  to service_role;
revoke all on function public.eh170_read_recording(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_read_recording(uuid, uuid)
  to service_role;
revoke all on function public.eh170_list_recordings(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_list_recordings(uuid, uuid)
  to service_role;
revoke all on function public.eh170_claim_recording_transcription(text)
  from public, anon, authenticated;
grant execute on function public.eh170_claim_recording_transcription(text)
  to service_role;
revoke all on function public.eh170_complete_recording_transcription(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.eh170_complete_recording_transcription(uuid, uuid, text, text, text, text)
  to service_role;
revoke all on function public.eh170_fail_recording_transcription(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.eh170_fail_recording_transcription(uuid, uuid, text, boolean)
  to service_role;
revoke all on function public.eh170_retry_recording_transcription(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_retry_recording_transcription(uuid, uuid)
  to service_role;
revoke all on function public.eh170_sanitize_note_content(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.eh170_sanitize_note_content(jsonb)
  to postgres;

revoke all on function public.eh170_note_source_references_valid(jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.eh170_note_source_references_valid(jsonb, jsonb, uuid)
  to postgres;
revoke all on function public.eh170_create_note_draft(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.eh170_create_note_draft(uuid, uuid, jsonb, jsonb)
  to service_role;
revoke all on function public.eh170_save_note_revision(uuid, uuid, uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.eh170_save_note_revision(uuid, uuid, uuid, uuid, jsonb, jsonb, boolean)
  to service_role;
revoke all on function public.eh170_mark_recording_audio_deleted(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_mark_recording_audio_deleted(uuid, uuid)
  to service_role;
revoke all on function public.eh170_delete_transcript(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_delete_transcript(uuid, uuid)
  to service_role;
revoke all on function public.eh170_delete_note_revision(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_delete_note_revision(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
