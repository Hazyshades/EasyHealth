-- EH-104 durable deletion foundation: lifecycle fencing, generation-bound leases,
-- and registered storage-write intents. Storage URLs are intentionally absent from
-- every database return value; the app broker performs late exchange.

alter table public.documents
  add column if not exists lifecycle_state text not null default 'active',
  add column if not exists upload_state text not null default 'complete';

alter table public.documents
  drop constraint if exists documents_lifecycle_state_check,
  drop constraint if exists documents_upload_state_check;

alter table public.documents
  add constraint documents_lifecycle_state_check
    check (lifecycle_state in ('active', 'deleting')),
  add constraint documents_upload_state_check
    check (upload_state in ('pending', 'complete', 'failed'));

create index if not exists documents_profile_lifecycle_idx
  on public.documents (profile_id, lifecycle_state, created_at desc);

alter table public.document_processing_attempts
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists cancellation_requested boolean not null default false,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists lease_released_at timestamptz;

alter table public.document_processing_attempts
  drop constraint if exists document_processing_attempts_state_check;

alter table public.document_processing_attempts
  add constraint document_processing_attempts_state_check
    check (state in ('active', 'completed', 'failed', 'requeued', 'reclaimed', 'cancelled'));

-- Existing attempts were claimed by the pre-lease worker. Expire their old
-- capabilities during rollout; old workers cannot pass the new lease fence.
update public.document_processing_attempts
set lease_token = coalesce(lease_token, gen_random_uuid()),
    lease_expires_at = coalesce(lease_expires_at, now()),
    last_heartbeat_at = coalesce(last_heartbeat_at, claimed_at)
where state = 'active';

create index if not exists document_processing_attempts_lease_idx
  on public.document_processing_attempts (state, lease_expires_at)
  where state = 'active';

create or replace function public.document_processing_attempts_transition_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.state <> 'active' then
    raise exception using message = 'processing_attempt_terminal';
  end if;
  if new.id is distinct from old.id
    or new.job_id is distinct from old.job_id
    or new.document_id is distinct from old.document_id
    or new.profile_id is distinct from old.profile_id
    or new.attempt_number is distinct from old.attempt_number
    or new.captured_write_generation is distinct from old.captured_write_generation
    or new.claimed_at is distinct from old.claimed_at
    or new.lease_token is distinct from old.lease_token then
    raise exception using message = 'processing_attempt_identity_immutable';
  end if;
  return new;
end;
$$;

create or replace function public.document_processing_job_lifecycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('queued', 'processing') and not exists (
    select 1
    from public.documents
    where id = new.document_id
      and profile_id = new.profile_id
      and lifecycle_state = 'active'
      and upload_state = 'complete'
  ) then
    raise exception using message = 'document_processing_job_fence_rejected';
  end if;
  return new;
end;
$$;

drop trigger if exists document_processing_job_lifecycle_guard
  on public.document_processing_jobs;
create trigger document_processing_job_lifecycle_guard
before insert or update of document_id, profile_id, status
on public.document_processing_jobs
for each row
execute function public.document_processing_job_lifecycle_guard();

create or replace function public.eh104_document_lifecycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.lifecycle_state is distinct from old.lifecycle_state
    and (
      new.lifecycle_state is distinct from 'deleting'
      or current_setting('eh104.tombstone', true) is distinct from 'on'
    ) then
    raise exception using message = 'document_lifecycle_mutation_forbidden';
  end if;
  if new.upload_state is distinct from old.upload_state
    and (
      (new.upload_state = 'complete'
        and current_setting('eh104.upload_complete', true) is distinct from 'on')
      or (new.upload_state = 'failed'
        and current_setting('eh104.upload_failed', true) is distinct from 'on')
      or new.upload_state not in ('complete', 'failed')
    ) then
    raise exception using message = 'document_upload_state_mutation_forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists eh104_document_lifecycle_guard
  on public.documents;
create trigger eh104_document_lifecycle_guard
before update of lifecycle_state, upload_state
on public.documents
for each row
execute function public.eh104_document_lifecycle_guard();
create or replace function public.eh104_assert_document_active_for_write(
  p_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lifecycle_state text;
begin
  if p_document_id is null then
    return;
  end if;

  select lifecycle_state
  into v_lifecycle_state
  from public.documents
  where id = p_document_id
  for update;

  if v_lifecycle_state is distinct from 'active' then
    raise exception using message = 'document_deleting';
  end if;
end;
$$;

create or replace function public.eh104_document_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_document_id uuid;
begin
  if current_setting('eh104.deletion_purge', true) = 'on'
    or current_setting('eh104.tombstone', true) = 'on'
    or current_setting('eh104.upload_complete', true) = 'on'
    or current_setting('eh104.upload_failed', true) = 'on' then
    return new;
  end if;

  if tg_table_name = 'documents' then
    if old.lifecycle_state = 'deleting'
      or new.lifecycle_state = 'deleting' then
      raise exception using message = 'document_deleting';
    end if;
    return new;
  end if;

  if tg_table_name = 'observation_change_events' then
    select extracted.document_id
    into v_document_id
    from public.document_extracted_biomarkers as extracted
    where extracted.id = (v_payload ->> 'extracted_biomarker_id')::uuid;

    if v_document_id is null then
      select observation.document_id
      into v_document_id
      from public.observations as observation
      where observation.id = (v_payload ->> 'observation_id')::uuid;
    end if;

    if v_document_id is null then
      v_document_id := (v_payload ->> 'document_id')::uuid;
    end if;
  elsif tg_table_name = 'document_processing_attempts' then
    if tg_op = 'UPDATE' and new.state = 'cancelled' then
      return new;
    end if;
  elsif tg_table_name = 'document_storage_write_intents' then
    if tg_op = 'UPDATE' and new.state in ('failed', 'expired') then
      return new;
    end if;
  elsif tg_table_name = 'observation_normalization_revisions' then
    select extracted.document_id
    into v_document_id
    from public.document_extracted_biomarkers as extracted
    where extracted.id = (v_payload ->> 'extracted_biomarker_id')::uuid;
  elsif tg_table_name = 'medical_event_dates' then
    select event.source_document_id
    into v_document_id
    from public.medical_events as event
    where event.id = (v_payload ->> 'medical_event_id')::uuid;
  elsif tg_table_name = 'health_profile_assessment_versions' then
    for v_document_id in
      select value::uuid
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(v_payload -> 'source_document_ids') = 'array'
            then v_payload -> 'source_document_ids'
          else '[]'::jsonb
        end
      )
      order by value::uuid
    loop
      perform public.eh104_assert_document_active_for_write(v_document_id);
    end loop;
    return new;
  elsif tg_table_name = 'document_duplicate_candidates' then
    for v_document_id in
      select value::uuid
      from jsonb_array_elements_text(
        jsonb_build_array(
          v_payload ->> 'left_document_id',
          v_payload ->> 'right_document_id'
        )
      )
      order by value::uuid
    loop
      perform public.eh104_assert_document_active_for_write(v_document_id);
    end loop;
    return new;
  elsif tg_table_name = 'registry_reprocess_batches' then
    v_document_id := nullif(v_payload ->> 'scope_document_id', '')::uuid;
  elsif tg_table_name = 'medical_events' then
    v_document_id := (v_payload ->> 'source_document_id')::uuid;
  else
    v_document_id := nullif(v_payload ->> 'document_id', '')::uuid;
  end if;

  perform public.eh104_assert_document_active_for_write(v_document_id);
  return new;
end;
$$;

drop trigger if exists eh104_document_mutation_guard
  on public.documents;
create trigger eh104_document_mutation_guard
before update on public.documents
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_pages;
create trigger eh104_document_mutation_guard
before insert or update on public.document_pages
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_extracted_biomarkers;
create trigger eh104_document_mutation_guard
before insert or update on public.document_extracted_biomarkers
for each row
execute function public.eh104_document_mutation_guard();


drop trigger if exists eh104_document_mutation_guard
  on public.document_extracted_clinical_notes;
create trigger eh104_document_mutation_guard
before insert or update on public.document_extracted_clinical_notes
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_extracted_prescriptions;
create trigger eh104_document_mutation_guard
before insert or update on public.document_extracted_prescriptions
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_extracted_referrals;
create trigger eh104_document_mutation_guard
before insert or update on public.document_extracted_referrals
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_extracted_instrumental_measures;
create trigger eh104_document_mutation_guard
before insert or update on public.document_extracted_instrumental_measures
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_extracted_finding_versions;
create trigger eh104_document_mutation_guard
before insert or update on public.document_extracted_finding_versions
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_instrumental_snapshot_contents;
create trigger eh104_document_mutation_guard
before insert or update on public.document_instrumental_snapshot_contents
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_instrumental_publications;
create trigger eh104_document_mutation_guard
before insert or update on public.document_instrumental_publications
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_instrumental_current_publication;
create trigger eh104_document_mutation_guard
before insert or update on public.document_instrumental_current_publication
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.ai_invocations;
create trigger eh104_document_mutation_guard
before insert or update on public.ai_invocations
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_processing_attempts;
create trigger eh104_document_mutation_guard
before insert or update on public.document_processing_attempts
for each row
execute function public.eh104_document_mutation_guard();
drop trigger if exists eh104_document_mutation_guard
  on public.document_processing_jobs;
create trigger eh104_document_mutation_guard
before insert or update on public.document_processing_jobs
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.observations;
create trigger eh104_document_mutation_guard
before insert or update on public.observations
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.observation_normalization_revisions;
create trigger eh104_document_mutation_guard
before insert or update on public.observation_normalization_revisions
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.medical_events;
create trigger eh104_document_mutation_guard
before insert or update on public.medical_events
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.medical_event_dates;
create trigger eh104_document_mutation_guard
before insert or update on public.medical_event_dates
for each row
execute function public.eh104_document_mutation_guard();


drop trigger if exists eh104_document_mutation_guard
  on public.registry_reprocess_batch_rows;
create trigger eh104_document_mutation_guard
before insert or update on public.registry_reprocess_batch_rows
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.eh120_lifecycle_transition_operations;
create trigger eh104_document_mutation_guard
before insert or update on public.eh120_lifecycle_transition_operations
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.observation_change_events;
create trigger eh104_document_mutation_guard
before insert or update on public.observation_change_events
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.assessment_dependency_events;
create trigger eh104_document_mutation_guard
before insert or update on public.assessment_dependency_events
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.document_duplicate_candidates;
create trigger eh104_document_mutation_guard
before insert or update on public.document_duplicate_candidates
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.batch_verification_operations;
create trigger eh104_document_mutation_guard
before insert or update on public.batch_verification_operations
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.registry_reprocess_batches;
create trigger eh104_document_mutation_guard
before insert or update on public.registry_reprocess_batches
for each row
execute function public.eh104_document_mutation_guard();

drop trigger if exists eh104_document_mutation_guard
  on public.health_profile_assessment_versions;
create trigger eh104_document_mutation_guard
before insert or update on public.health_profile_assessment_versions
for each row
execute function public.eh104_document_mutation_guard();

revoke all on function public.eh104_assert_document_active_for_write(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.eh104_document_mutation_guard()
  from public, anon, authenticated;

revoke all on function public.eh104_document_lifecycle_guard()
  from public, anon, authenticated;

-- The old claim function returned a fixed composite shape. Drop it before the
-- replacement adds the lease capability fields.
drop function if exists public.claim_document_processing_job(uuid);

create or replace function public.claim_document_processing_job(p_job_id uuid)
returns table (
  job_id uuid,
  document_id uuid,
  profile_id uuid,
  attempts integer,
  max_attempts integer,
  processing_attempt_id uuid,
  attempt_number integer,
  captured_write_generation bigint,
  lease_token uuid,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.document_processing_jobs%rowtype;
  v_document public.documents%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
  v_lease_token uuid := gen_random_uuid();
  v_lease_expires_at timestamptz := now() + interval '5 minutes';
begin
  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id;

  if v_job.id is null then
    return;
  end if;

  select * into v_document
  from public.documents
  where id = v_job.document_id
  for update;

  if v_document.id is null
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.upload_state is distinct from 'complete' then
    return;
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.status is distinct from 'queued' then
    return;
  end if;

  if v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_job_document_profile_mismatch';
  end if;

  if exists (
    select 1
    from public.document_processing_attempts as attempt
    where attempt.document_id = v_document.id
      and attempt.state = 'active'
  ) then
    return;
  end if;

  update public.document_processing_jobs
  set status = 'processing',
      attempts = v_job.attempts + 1,
      started_at = now(),
      finished_at = null
  where id = v_job.id;

  insert into public.document_processing_attempts (
    job_id,
    document_id,
    profile_id,
    attempt_number,
    captured_write_generation,
    lease_token,
    lease_expires_at,
    last_heartbeat_at
  )
  values (
    v_job.id,
    v_document.id,
    v_document.profile_id,
    v_job.attempts + 1,
    v_document.write_generation,
    v_lease_token,
    v_lease_expires_at,
    now()
  )
  returning * into v_attempt;

  return query select
    v_job.id,
    v_document.id,
    v_document.profile_id,
    v_job.attempts + 1,
    v_job.max_attempts,
    v_attempt.id,
    v_attempt.attempt_number,
    v_attempt.captured_write_generation,
    v_attempt.lease_token,
    v_attempt.lease_expires_at;
end;
$$;

revoke all on function public.claim_document_processing_job(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_document_processing_job(uuid)
  to service_role;

create or replace function public.eh104_assert_processing_lease(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_allow_expired boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.document_processing_attempts%rowtype;
  v_job public.document_processing_jobs%rowtype;
  v_document public.documents%rowtype;
begin
  select * into v_attempt
  from public.document_processing_attempts
  where id = p_attempt_id;

  if v_attempt.id is null then
    raise exception using message = 'processing_attempt_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_attempt.document_id
  for update;

  select * into v_job
  from public.document_processing_jobs
  where id = v_attempt.job_id
  for update;

  select * into v_attempt
  from public.document_processing_attempts
  where id = p_attempt_id
  for update;

  if v_document.id is null
    or v_job.id is null
    or v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id
    or v_attempt.document_id is distinct from v_document.id
    or v_attempt.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_attempt_ownership_mismatch';
  end if;
  if v_document.lifecycle_state is distinct from 'active' then
    raise exception using message = 'document_deleting';
  end if;
  if v_attempt.state is distinct from 'active' then
    raise exception using message = 'processing_attempt_not_active';
  end if;
  if v_attempt.lease_token is distinct from p_lease_token then
    raise exception using message = 'processing_attempt_lease_mismatch';
  end if;
  if v_attempt.captured_write_generation is distinct from p_write_generation then
    raise exception using message = 'processing_attempt_generation_mismatch';
  end if;
  if not p_allow_expired and v_attempt.cancellation_requested then
    raise exception using message = 'processing_attempt_cancellation_requested';
  end if;
  if not p_allow_expired
    and (v_attempt.lease_expires_at is null or v_attempt.lease_expires_at <= now()) then
    raise exception using message = 'processing_attempt_lease_expired';
  end if;
end;
$$;

revoke all on function public.eh104_assert_processing_lease(uuid, uuid, bigint, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.heartbeat_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_extend_seconds integer default 300
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  if p_extend_seconds < 30 or p_extend_seconds > 900 then
    raise exception using message = 'invalid_processing_lease_extension';
  end if;
  perform public.eh104_assert_processing_lease(
    p_attempt_id,
    p_lease_token,
    p_write_generation,
    false
  );
  v_expires := now() + make_interval(secs => p_extend_seconds);
  update public.document_processing_attempts
  set lease_expires_at = v_expires,
      last_heartbeat_at = now()
  where id = p_attempt_id;
  return v_expires;
end;
$$;

create or replace function public.release_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_terminal_state text,
  p_terminal_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_terminal_state not in ('completed', 'failed', 'requeued', 'reclaimed', 'cancelled') then
    raise exception using message = 'invalid_processing_terminal_state';
  end if;
  perform public.eh104_assert_processing_lease(
    p_attempt_id,
    p_lease_token,
    p_write_generation,
    false
  );
  update public.document_processing_attempts
  set state = p_terminal_state,
      terminal_at = now(),
      terminal_reason = left(coalesce(p_terminal_reason, p_terminal_state), 120),
      lease_expires_at = null,
      last_heartbeat_at = now(),
      lease_released_at = now()
  where id = p_attempt_id;
end;
$$;

revoke all on function public.heartbeat_document_processing_attempt(uuid, uuid, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.heartbeat_document_processing_attempt(uuid, uuid, bigint, integer)
  to service_role;
revoke all on function public.release_document_processing_attempt(uuid, uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.release_document_processing_attempt(uuid, uuid, bigint, text, text)
  to service_role;

create table if not exists public.document_storage_write_intents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  profile_id uuid not null,
  processing_attempt_id uuid,
  lease_token uuid,
  write_generation bigint not null check (write_generation >= 0),
  principal_kind text not null check (principal_kind in ('owner', 'worker')),
  operation_kind text not null check (
    operation_kind in (
      'owner_original',
      'attempt_thumbnail',
      'attempt_page_preview',
      'attempt_ocr_fulltext',
      'attempt_ocr_page_json',
      'attempt_extraction_json'
    )
  ),
  bucket text not null check (bucket = 'lab-documents'),
  object_path text not null,
  content_type text not null,
  state text not null default 'pending' check (
    state in ('pending', 'exchanged', 'completed', 'failed', 'expired')
  ),
  page_number integer,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  last_exchange_at timestamptz,
  upload_window_until timestamptz,
  completed_at timestamptz,
  terminal_at timestamptz,
  terminal_reason text,
  created_at timestamptz not null default now(),
  constraint document_storage_write_intent_owner_shape check (
    (principal_kind = 'owner' and processing_attempt_id is null and lease_token is null)
    or (principal_kind = 'worker' and processing_attempt_id is not null and lease_token is not null)
  ),
  constraint document_storage_write_intent_page_shape check (
    (operation_kind in ('attempt_page_preview', 'attempt_ocr_page_json')) = (page_number is not null)
  )
);

create unique index if not exists document_storage_write_intents_active_path_idx
  on public.document_storage_write_intents (bucket, object_path)
  where state in ('pending', 'exchanged');
create index if not exists document_storage_write_intents_document_idx
  on public.document_storage_write_intents (document_id, state, created_at desc);
create index if not exists document_storage_write_intents_recovery_idx
  on public.document_storage_write_intents (state, deadline_at)
  where state in ('pending', 'exchanged');

alter table public.document_storage_write_intents enable row level security;
revoke all on public.document_storage_write_intents from public, anon, authenticated;
grant select on public.document_storage_write_intents to service_role;

create table if not exists public.document_storage_upload_tickets (
  ticket_hash text primary key check (ticket_hash ~ '^[0-9a-f]{64}$'),
  intent_id uuid not null references public.document_storage_write_intents(id) on delete cascade,
  profile_id uuid not null,
  processing_attempt_id uuid,
  write_generation bigint not null check (write_generation >= 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists document_storage_upload_tickets_intent_idx
  on public.document_storage_upload_tickets (intent_id, expires_at);

alter table public.document_storage_upload_tickets enable row level security;
revoke all on public.document_storage_upload_tickets from public, anon, authenticated;
grant select on public.document_storage_upload_tickets to service_role;
drop trigger if exists eh104_document_mutation_guard
  on public.document_storage_write_intents;
create trigger eh104_document_mutation_guard
before insert or update on public.document_storage_write_intents
for each row
execute function public.eh104_document_mutation_guard();


create or replace function public.eh104_storage_intent_path(
  p_profile_id uuid,
  p_document_id uuid,
  p_generation bigint,
  p_attempt_id uuid,
  p_operation_kind text,
  p_page_number integer,
  p_extension text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_prefix text := format('%s/%s', p_profile_id, p_document_id);
  v_attempt_prefix text;
  v_extension text := lower(coalesce(nullif(p_extension, ''), 'bin'));
begin
  if p_operation_kind = 'owner_original' then
    if v_extension !~ '^[a-z0-9]{1,10}$' then
      raise exception using message = 'invalid_storage_extension';
    end if;
    return format('%s/original.%s', v_prefix, v_extension);
  end if;
  if p_attempt_id is null then
    raise exception using message = 'storage_attempt_required';
  end if;
  v_attempt_prefix := format(
    '%s/generations/%s/attempts/%s',
    v_prefix,
    p_generation,
    p_attempt_id
  );
  if p_operation_kind = 'attempt_thumbnail' then
    return v_attempt_prefix || '/thumb.webp';
  elsif p_operation_kind = 'attempt_page_preview' then
    if p_page_number is null or p_page_number < 1 then
      raise exception using message = 'storage_page_number_required';
    end if;
    return format('%s/pages/page-%s.webp', v_attempt_prefix, p_page_number);
  elsif p_operation_kind = 'attempt_ocr_fulltext' then
    return v_attempt_prefix || '/ocr/fulltext.txt';
  elsif p_operation_kind = 'attempt_ocr_page_json' then
    if p_page_number is null or p_page_number < 1 then
      raise exception using message = 'storage_page_number_required';
    end if;
    return format('%s/ocr/page-%s.json', v_attempt_prefix, p_page_number);
  elsif p_operation_kind = 'attempt_extraction_json' then
    return v_attempt_prefix || '/extraction/biomarkers.json';
  end if;
  raise exception using message = 'invalid_storage_operation_kind';
end;
$$;

revoke all on function public.eh104_storage_intent_path(uuid, uuid, bigint, uuid, text, integer, text)
  from public, anon, authenticated, service_role;

create or replace function public.create_document_upload_reservation(
  p_profile_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_content_sha256 text,
  p_document_type text,
  p_file_kind text,
  p_extension text
)
returns table (
  document_id uuid,
  intent_id uuid,
  bucket text,
  object_path text,
  content_type text,
  write_generation bigint,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid := gen_random_uuid();
  v_path text;
  v_intent_id uuid;
  v_deadline timestamptz := now() + interval '10 minutes';
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception using message = 'profile_not_found';
  end if;
  if p_mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
    'text/plain', 'application/json'
  ) then
    raise exception using message = 'unsupported_document_mime_type';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 10 * 1024 * 1024 then
    raise exception using message = 'invalid_document_size';
  end if;
  if p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_document_content_hash';
  end if;

  if p_document_type not in ('lab_result', 'instrumental_report', 'consultation_note', 'dicom') then
    raise exception using message = 'invalid_document_type';
  end if;
  if p_file_kind not in ('pdf', 'image', 'unknown') then
    raise exception using message = 'invalid_document_file_kind';
  end if;


  v_path := public.eh104_storage_intent_path(
    p_profile_id,
    v_document_id,
    0,
    null,
    'owner_original',
    null,
    p_extension
  );

  insert into public.documents (
    id,
    profile_id,
    storage_path,
    original_filename,
    status,
    mime_type,
    file_size_bytes,
    original_storage_path,
    lifecycle_state,
    upload_state,
    processing_status,
    document_type,
    file_kind,
    content_sha256

  )
  values (
    v_document_id,
    p_profile_id,
    v_path,
    left(p_original_filename, 500),
    'processing',
    p_mime_type,
    p_file_size_bytes,
    v_path,
    'active',
    'pending',
    'upload_pending',
    p_document_type,
    p_file_kind,
    p_content_sha256
  );

  insert into public.document_storage_write_intents (
    document_id,
    profile_id,
    write_generation,
    principal_kind,
    operation_kind,
    bucket,
    object_path,
    content_type,
    deadline_at
  )
  values (
    v_document_id,
    p_profile_id,
    0,
    'owner',
    'owner_original',
    'lab-documents',
    v_path,
    p_mime_type,
    v_deadline
  )
  returning id into v_intent_id;

  return query select
    v_document_id,
    v_intent_id,
    'lab-documents'::text,
    v_path,
    p_mime_type,
    0::bigint,
    v_deadline;
end;
$$;

create or replace function public.register_storage_write_intent(
  p_document_id uuid,
  p_profile_id uuid,
  p_processing_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_operation_kind text,
  p_content_type text,
  p_page_number integer default null,
  p_extension text default null
)
returns table (
  intent_id uuid,
  bucket text,
  object_path text,
  content_type text,
  write_generation bigint,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_path text;
  v_intent_id uuid;
  v_deadline timestamptz := now() + interval '10 minutes';
begin
  if p_operation_kind = 'owner_original' then
    if p_processing_attempt_id is not null or p_lease_token is not null then
      raise exception using message = 'owner_storage_intent_shape_invalid';
    end if;
    select * into v_document
    from public.documents
    where id = p_document_id and profile_id = p_profile_id
    for update;
    if v_document.id is null then
      raise exception using message = 'document_not_found';
    end if;
    if v_document.lifecycle_state is distinct from 'active'
      or v_document.upload_state is distinct from 'pending'
      or p_write_generation is distinct from v_document.write_generation then
      raise exception using message = 'storage_intent_fence_rejected';
    end if;
  else
    if p_processing_attempt_id is null or p_lease_token is null then
      raise exception using message = 'worker_storage_intent_shape_invalid';
    end if;
    perform public.eh104_assert_processing_lease(
      p_processing_attempt_id,
      p_lease_token,
      p_write_generation,
      false
    );
    select * into v_document
    from public.documents
    where id = p_document_id and profile_id = p_profile_id
    for update;
    if v_document.id is null or v_document.write_generation is distinct from p_write_generation then
      raise exception using message = 'storage_intent_fence_rejected';
    end if;
  end if;

  if p_content_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
    'text/plain', 'application/json'
  ) then
    raise exception using message = 'unsupported_storage_content_type';
  end if;

  v_path := public.eh104_storage_intent_path(
    p_profile_id,
    p_document_id,
    p_write_generation,
    p_processing_attempt_id,
    p_operation_kind,
    p_page_number,
    p_extension
  );

  insert into public.document_storage_write_intents (
    document_id,
    profile_id,
    processing_attempt_id,
    lease_token,
    write_generation,
    principal_kind,
    operation_kind,
    bucket,
    object_path,
    content_type,
    page_number,
    deadline_at
  )
  values (
    p_document_id,
    p_profile_id,
    p_processing_attempt_id,
    p_lease_token,
    p_write_generation,
    case when p_operation_kind = 'owner_original' then 'owner' else 'worker' end,
    p_operation_kind,
    'lab-documents',
    v_path,
    p_content_type,
    p_page_number,
    v_deadline
  )
  returning id into v_intent_id;

  return query select
    v_intent_id,
    'lab-documents'::text,
    v_path,
    p_content_type,
    p_write_generation,
    v_deadline;
end;
$$;

create or replace function public.issue_storage_upload_ticket(
  p_intent_id uuid,
  p_ticket_hash text,
  p_expires_at timestamptz,
  p_profile_id uuid,
  p_processing_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint
)
returns table (
  intent_id uuid,
  bucket text,
  object_path text,
  content_type text,
  write_generation bigint,
  deadline_at timestamptz,
  ticket_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.document_storage_write_intents%rowtype;
  v_document public.documents%rowtype;
  v_ticket_expires timestamptz;
begin
  if p_ticket_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_storage_ticket_hash';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '120 seconds' then
    raise exception using message = 'invalid_storage_ticket_expiry';
  end if;

  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id;
  if v_intent.id is null then
    raise exception using message = 'storage_intent_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_intent.document_id
  for update;
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id
  for update;
  if v_document.id is null
    or v_document.profile_id is distinct from v_intent.profile_id
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.write_generation is distinct from v_intent.write_generation
    or v_intent.state is distinct from 'pending'
    or v_intent.deadline_at <= now() then
    raise exception using message = 'storage_intent_fence_rejected';
  end if;

  if v_intent.principal_kind = 'owner' then
    if p_profile_id is distinct from v_intent.profile_id
      or p_processing_attempt_id is not null
      or p_lease_token is not null
      or p_write_generation is distinct from v_intent.write_generation then
      raise exception using message = 'storage_ticket_owner_mismatch';
    end if;
  else
    if p_processing_attempt_id is distinct from v_intent.processing_attempt_id
      or p_lease_token is distinct from v_intent.lease_token
      or p_write_generation is distinct from v_intent.write_generation then
      raise exception using message = 'storage_ticket_worker_mismatch';
    end if;
    perform public.eh104_assert_processing_lease(
      p_processing_attempt_id,
      p_lease_token,
      p_write_generation,
      false
    );
  end if;

  v_ticket_expires := least(p_expires_at, v_intent.deadline_at);
  insert into public.document_storage_upload_tickets (
    ticket_hash,
    intent_id,
    profile_id,
    processing_attempt_id,
    write_generation,
    expires_at
  )
  values (
    p_ticket_hash,
    v_intent.id,
    v_intent.profile_id,
    v_intent.processing_attempt_id,
    v_intent.write_generation,
    v_ticket_expires
  );

  return query select
    v_intent.id,
    v_intent.bucket,
    v_intent.object_path,
    v_intent.content_type,
    v_intent.write_generation,
    v_intent.deadline_at,
    v_ticket_expires;
end;
$$;

create or replace function public.consume_storage_upload_ticket(
  p_intent_id uuid,
  p_ticket_hash text
)
returns table (
  intent_id uuid,
  bucket text,
  object_path text,
  content_type text,
  write_generation bigint,
  deadline_at timestamptz,
  ticket_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.document_storage_write_intents%rowtype;
  v_document public.documents%rowtype;
  v_ticket public.document_storage_upload_tickets%rowtype;
begin
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id;
  if v_intent.id is null then
    raise exception using message = 'storage_intent_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_intent.document_id
  for update;
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id
  for update;
  select * into v_ticket
  from public.document_storage_upload_tickets
  where intent_id = p_intent_id
    and ticket_hash = p_ticket_hash
  for update;

  if v_ticket.ticket_hash is null then
    raise exception using message = 'storage_ticket_not_found';
  end if;
  if v_ticket.consumed_at is not null then
    raise exception using message = 'storage_ticket_already_consumed';
  end if;
  if v_ticket.expires_at <= now() then
    raise exception using message = 'storage_ticket_expired';
  end if;
  if v_intent.state is distinct from 'pending'
    or v_intent.deadline_at <= now()
    or v_document.id is null
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.write_generation is distinct from v_intent.write_generation then
    raise exception using message = 'storage_intent_fence_rejected';
  end if;

  update public.document_storage_upload_tickets
  set consumed_at = now()
  where ticket_hash = p_ticket_hash;
  update public.document_storage_write_intents
  set state = 'exchanged',
      last_exchange_at = now(),
      upload_window_until = v_intent.deadline_at
  where id = p_intent_id;

  return query select
    v_intent.id,
    v_intent.bucket,
    v_intent.object_path,
    v_intent.content_type,
    v_intent.write_generation,
    v_intent.deadline_at,
    v_ticket.expires_at;
end;
$$;

create or replace function public.complete_storage_write_intent(
  p_intent_id uuid,
  p_ticket_hash text,
  p_object_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.document_storage_write_intents%rowtype;
  v_document public.documents%rowtype;
  v_ticket public.document_storage_upload_tickets%rowtype;
begin
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id;
  if v_intent.id is null then
    raise exception using message = 'storage_intent_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_intent.document_id
  for update;
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id
  for update;
  select * into v_ticket
  from public.document_storage_upload_tickets
  where intent_id = p_intent_id
    and ticket_hash = p_ticket_hash;

  if v_ticket.ticket_hash is null or v_ticket.consumed_at is null then
    raise exception using message = 'storage_ticket_not_consumed';
  end if;
  if not p_object_verified then
    raise exception using message = 'storage_object_not_verified';
  end if;
  if v_intent.state is distinct from 'exchanged' then
    raise exception using message = 'storage_intent_not_exchanged';
  end if;
  if v_document.id is null
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.write_generation is distinct from v_intent.write_generation then
    raise exception using message = 'storage_intent_fence_rejected';
  end if;

  if v_intent.principal_kind = 'worker' then
    perform public.eh104_assert_processing_lease(
      v_intent.processing_attempt_id,
      v_intent.lease_token,
      v_intent.write_generation,
      false
    );
  else
    perform set_config('eh104.upload_complete', 'on', true);
    update public.documents
    set upload_state = 'complete'
    where id = v_document.id and upload_state = 'pending';
  end if;

  update public.document_storage_write_intents
  set state = 'completed',
      completed_at = now(),
      upload_window_until = null
  where id = p_intent_id;
  if v_intent.principal_kind = 'owner' then
    perform set_config('eh104.upload_complete', 'off', true);
  end if;
end;
$$;

create or replace function public.fail_storage_write_intent(
  p_intent_id uuid,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.document_storage_write_intents%rowtype;
begin
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id
  for update;

  if v_intent.id is null then
    return;
  end if;

  if v_intent.state in ('pending', 'exchanged')
    and v_intent.principal_kind = 'owner' then
    perform set_config('eh104.upload_failed', 'on', true);
    update public.documents
    set upload_state = 'failed',
        status = 'failed',
        processing_status = 'failed',
        processing_error = left(coalesce(p_reason_code, 'storage_intent_failed'), 120)
    where id = v_intent.document_id
      and lifecycle_state = 'active'
      and upload_state = 'pending';
  end if;

  update public.document_storage_write_intents
  set state = 'failed',
      terminal_at = now(),
      terminal_reason = left(coalesce(p_reason_code, 'storage_intent_failed'), 120),
      upload_window_until = null
  where id = p_intent_id
    and state in ('pending', 'exchanged');
  if v_intent.principal_kind = 'owner' then
    perform set_config('eh104.upload_failed', 'off', true);
  end if;
end;
$$;

revoke all on function public.create_document_upload_reservation(uuid, text, text, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_document_upload_reservation(uuid, text, text, bigint, text, text, text, text)
  to service_role;
revoke all on function public.register_storage_write_intent(uuid, uuid, uuid, uuid, bigint, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.register_storage_write_intent(uuid, uuid, uuid, uuid, bigint, text, text, integer, text)
  to service_role;
revoke all on function public.issue_storage_upload_ticket(uuid, text, timestamptz, uuid, uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.issue_storage_upload_ticket(uuid, text, timestamptz, uuid, uuid, uuid, bigint)
  to service_role;
revoke all on function public.consume_storage_upload_ticket(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_storage_upload_ticket(uuid, text)
  to service_role;
revoke all on function public.complete_storage_write_intent(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_storage_write_intent(uuid, text, boolean)
  to service_role;
revoke all on function public.fail_storage_write_intent(uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_storage_write_intent(uuid, text)
  to service_role;

-- Leased wrappers replace the old tokenless runtime transitions. The old
-- functions remain private implementation helpers for SECURITY DEFINER calls.
create or replace function public.fail_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.eh104_assert_processing_lease(p_attempt_id, p_lease_token, p_write_generation, true);
  perform public.fail_document_processing_attempt(p_attempt_id, left(coalesce(p_message, 'processing_failed'), 120));
end;
$$;

create or replace function public.requeue_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.eh104_assert_processing_lease(p_attempt_id, p_lease_token, p_write_generation, true);
  perform public.requeue_document_processing_attempt(p_attempt_id, left(coalesce(p_message, 'processing_requeued'), 120));
end;
$$;

create or replace function public.reclaim_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_message text,
  p_fail boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.eh104_assert_processing_lease(p_attempt_id, p_lease_token, p_write_generation, true);
  perform public.reclaim_document_processing_attempt(
    p_attempt_id,
    left(coalesce(p_message, 'processing_reclaimed'), 120),
    p_fail
  );
end;
$$;

revoke all on function public.fail_document_processing_attempt(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.requeue_document_processing_attempt(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reclaim_document_processing_attempt(uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_document_processing_attempt(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.fail_document_processing_attempt(uuid, uuid, bigint, text)
  to service_role;
revoke all on function public.requeue_document_processing_attempt(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.requeue_document_processing_attempt(uuid, uuid, bigint, text)
  to service_role;
revoke all on function public.reclaim_document_processing_attempt(uuid, uuid, bigint, text, boolean)
  from public, anon, authenticated;
grant execute on function public.reclaim_document_processing_attempt(uuid, uuid, bigint, text, boolean)
  to service_role;

notify pgrst, 'reload schema';
