-- EH-170: retention workers use audited, service-role-only deletion transitions.

create or replace function public.eh170_retention_actor_is_valid(
  p_actor_profile_id uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_actor_profile_id
  );
$$;

create or replace function public.eh170_retention_list_audio_candidates(
  p_before timestamptz
)
returns table (
  recording_id uuid,
  storage_path text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select recordings.id, recordings.storage_path
  from public.recording_sessions as recordings
  where recordings.source_audio_deleted_at is null
    and recordings.storage_path is not null
    and coalesce(
      recordings.source_audio_delete_eligible_at,
      recordings.uploaded_at,
      recordings.updated_at
    ) < p_before
  order by coalesce(
    recordings.source_audio_delete_eligible_at,
    recordings.uploaded_at,
    recordings.updated_at
  )
  limit 25;
$$;

create or replace function public.eh170_retention_list_transcript_candidates(
  p_before timestamptz
)
returns table (
  transcript_id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select transcripts.id
  from public.transcript_drafts as transcripts
  where transcripts.status in ('ready', 'failed')
    and transcripts.updated_at < p_before
  order by transcripts.updated_at
  limit 25;
$$;

create or replace function public.eh170_retention_list_note_candidates(
  p_before timestamptz
)
returns table (
  revision_id uuid
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select revisions.id
  from public.consultation_note_revisions as revisions
  where revisions.status in ('draft', 'reviewed', 'superseded')
    and revisions.updated_at < p_before
  order by revisions.updated_at
  limit 25;
$$;

create or replace function public.eh170_retention_prepare_audio_delete(
  p_actor_profile_id uuid,
  p_recording_id uuid,
  p_before timestamptz
)
returns table (
  recording_id uuid,
  storage_path text,
  source_audio_deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recording public.recording_sessions%rowtype;
begin
  if p_before is null then
    raise exception using message = 'eh170_retention_cutoff_required';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = p_actor_profile_id
  ) then
    raise exception using message = 'eh170_access_denied';
  end if;
  select * into v_recording
  from public.recording_sessions
  where id = p_recording_id
  for update;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  if v_recording.source_audio_deleted_at is not null then
    return query select
      v_recording.id,
      null::text,
      v_recording.source_audio_deleted_at;
    return;
  end if;
  if coalesce(
    v_recording.source_audio_delete_eligible_at,
    v_recording.uploaded_at,
    v_recording.updated_at
  ) >= p_before then
    return;
  end if;
  if v_recording.source_audio_delete_actor_profile_id is not null then
    if v_recording.source_audio_delete_actor_profile_id = p_actor_profile_id then
      return query select
        v_recording.id,
        v_recording.storage_path,
        null::timestamptz;
      return;
    end if;
    if v_recording.source_audio_delete_requested_at is null
      or v_recording.source_audio_delete_requested_at >= p_before then
      raise exception using message = 'eh170_access_denied';
    end if;
  end if;
  update public.recording_sessions as recordings
  set source_audio_delete_requested_at = clock_timestamp(),
      source_audio_delete_actor_profile_id = p_actor_profile_id,
      source_audio_delete_grant_id = null,
      source_audio_delete_eligible_at = coalesce(
        v_recording.source_audio_delete_eligible_at,
        v_recording.uploaded_at,
        v_recording.updated_at
      ),
      updated_at = clock_timestamp()
  where recordings.id = v_recording.id
  returning recordings.id, recordings.storage_path
    into v_recording.id, v_recording.storage_path;
  return query select v_recording.id, v_recording.storage_path, null::timestamptz;
end;
$$;

create or replace function public.eh170_retention_mark_audio_deleted(
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
  v_clinic_id uuid;
begin
  select * into v_recording
  from public.recording_sessions
  where id = p_recording_id
  for update;
  if v_recording.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  if v_recording.source_audio_deleted_at is not null then
    return query select v_recording.id, v_recording.source_audio_deleted_at;
    return;
  end if;
  if v_recording.source_audio_delete_actor_profile_id is distinct from p_actor_profile_id
    or v_recording.source_audio_delete_requested_at is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select clinic_id into v_clinic_id
  from public.consultations
  where id = v_recording.consultation_id;

  update public.recording_sessions as recordings
  set source_audio_deleted_at = coalesce(recordings.source_audio_deleted_at, clock_timestamp()),
      source_audio_delete_requested_at = null,
      source_audio_delete_actor_profile_id = null,
      source_audio_delete_grant_id = null,
      source_audio_delete_eligible_at = null,
      updated_at = clock_timestamp()
  where recordings.id = v_recording.id
  returning recordings.id, recordings.source_audio_deleted_at
  into v_recording.id, v_recording.source_audio_deleted_at;

  perform public.eh170_write_access_event(
    v_clinic_id,
    v_recording.patient_profile_id,
    p_actor_profile_id,
    null,
    'recording',
    'delete',
    'allowed',
    'consultations'
  );
  return query select v_recording.id, v_recording.source_audio_deleted_at;
end;
$$;

create or replace function public.eh170_retention_delete_transcript(
  p_actor_profile_id uuid,
  p_transcript_id uuid
)
returns table (
  transcript_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transcript public.transcript_drafts%rowtype;
  v_clinic_id uuid;
begin
  select * into v_transcript
  from public.transcript_drafts
  where id = p_transcript_id
  for update;
  if v_transcript.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select consultations.clinic_id into v_clinic_id
  from public.consultations
  where consultations.id = v_transcript.consultation_id;

  update public.transcript_drafts
  set status = 'deleted',
      transcript_text = null,
      updated_at = clock_timestamp()
  where id = v_transcript.id
  returning id, status into v_transcript.id, v_transcript.status;

  perform public.eh170_write_access_event(
    v_clinic_id,
    v_transcript.patient_profile_id,
    p_actor_profile_id,
    null,
    'transcript',
    'delete',
    'allowed',
    'consultations'
  );
  return query select v_transcript.id, v_transcript.status;
end;
$$;

create or replace function public.eh170_retention_delete_note_revision(
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
  v_clinic_id uuid;
begin
  select * into v_revision
  from public.consultation_note_revisions
  where id = p_revision_id
  for update;
  if v_revision.id is null then
    raise exception using message = 'eh170_access_denied';
  end if;
  select consultations.clinic_id into v_clinic_id
  from public.consultations
  where consultations.id = v_revision.consultation_id;

  update public.consultation_note_revisions
  set status = 'deleted',
      content = '{}'::jsonb,
      source_references = '[]'::jsonb,
      updated_at = clock_timestamp()
  where id = v_revision.id
  returning id, status into v_revision.id, v_revision.status;

  perform public.eh170_write_access_event(
    v_clinic_id,
    v_revision.patient_profile_id,
    p_actor_profile_id,
    null,
    'note',
    'delete',
    'allowed',
    'consultations'
  );
  return query select v_revision.id, v_revision.status;
end;
$$;

revoke all on function public.eh170_retention_prepare_audio_delete(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_prepare_audio_delete(uuid, uuid, timestamptz)
  to service_role;
revoke all on function public.eh170_retention_actor_is_valid(uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_actor_is_valid(uuid)
  to service_role;

revoke all on function public.eh170_retention_list_audio_candidates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_list_audio_candidates(timestamptz)
  to service_role;
revoke all on function public.eh170_retention_list_transcript_candidates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_list_transcript_candidates(timestamptz)
  to service_role;
revoke all on function public.eh170_retention_list_note_candidates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_list_note_candidates(timestamptz)
  to service_role;
revoke all on function public.eh170_retention_mark_audio_deleted(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_mark_audio_deleted(uuid, uuid)
  to service_role;
revoke all on function public.eh170_retention_delete_transcript(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_delete_transcript(uuid, uuid)
  to service_role;
revoke all on function public.eh170_retention_delete_note_revision(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.eh170_retention_delete_note_revision(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
