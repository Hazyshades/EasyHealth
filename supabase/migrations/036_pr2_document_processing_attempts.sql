-- PR2 (make-instrumental-publication-atomic), foundation:
-- content-epoch write generation, retained per-claim processing attempts,
-- and service-only atomic claim/transition RPCs.
--
-- `documents.write_generation` is a content epoch, not a deletion counter:
-- it advances by exactly one when a finalizer commit newly advances the
-- authoritative current instrumental publication (migration 037), and later
-- when durable deletion tombstones the document. Idempotent finalizer replay
-- never increments it again.

alter table public.documents
  add column if not exists write_generation bigint not null default 0
    check (write_generation >= 0);

comment on column public.documents.write_generation is
  'Content epoch. Incremented once per finalizer commit that newly advances the current instrumental publication; durable deletion later increments it on tombstone. Legacy rows keep 0.';

-- Monotonicity guard: the epoch can only step forward, one unit at a time.
create or replace function public.documents_write_generation_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.write_generation < old.write_generation then
    raise exception using message = 'write_generation_cannot_decrease';
  end if;
  if new.write_generation > old.write_generation + 1 then
    raise exception using message = 'write_generation_must_advance_by_one';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_write_generation_monotonic on public.documents;
create trigger documents_write_generation_monotonic
  before update of write_generation on public.documents
  for each row
  when (new.write_generation is distinct from old.write_generation)
  execute function public.documents_write_generation_guard();

-- Composite ownership anchor for PR2 child tables (and for later durable
-- deletion). Lets children FK on (document_id, profile_id) so a valid
-- document uuid cannot be attached under a mismatched profile.
create unique index if not exists documents_id_profile_unique
  on public.documents (id, profile_id);

-- ---------------------------------------------------------------------------
-- Retained processing attempts: one row per successful atomic claim.
-- ---------------------------------------------------------------------------

create table if not exists public.document_processing_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.document_processing_jobs(id) on delete cascade,
  document_id uuid not null,
  profile_id uuid not null,
  attempt_number integer not null check (attempt_number >= 1),
  captured_write_generation bigint not null check (captured_write_generation >= 0),
  state text not null default 'active'
    check (state in ('active', 'completed', 'failed', 'requeued', 'reclaimed')),
  claimed_at timestamptz not null default now(),
  terminal_at timestamptz,
  terminal_reason text,
  created_at timestamptz not null default now(),
  constraint document_processing_attempts_id_owner_unique
    unique (id, profile_id, document_id),
  constraint document_processing_attempts_job_attempt_unique
    unique (job_id, attempt_number),
  constraint document_processing_attempts_terminal_consistency
    check ((state = 'active') = (terminal_at is null)),
  constraint document_processing_attempts_document_owner_fk
    foreign key (document_id, profile_id)
    references public.documents (id, profile_id)
    on delete cascade
);

comment on table public.document_processing_attempts is
  'PR2 retained per-claim processing attempts. Durable deletion later extends these rows with lease token/expiry/heartbeat/cancellation instead of adding another attempt or lease table.';
comment on column public.document_processing_attempts.captured_write_generation is
  'documents.write_generation observed at claim time. Prepare/finalize reject the attempt when the document epoch has moved past it.';

-- One active attempt per document, aligned with the one-active-job policy.
create unique index if not exists document_processing_attempts_one_active_per_document
  on public.document_processing_attempts (document_id)
  where state = 'active';

create unique index if not exists document_processing_attempts_one_active_per_job
  on public.document_processing_attempts (job_id)
  where state = 'active';

create index if not exists document_processing_attempts_job_id
  on public.document_processing_attempts (job_id, created_at desc);

alter table public.document_processing_attempts enable row level security;

-- Reads are service-only; every write goes through the SECURITY DEFINER
-- transitions below. No direct client mutation authority.
create policy "service_select_document_processing_attempts"
  on public.document_processing_attempts
  for select
  to service_role
  using (true);

revoke all on table public.document_processing_attempts from public, anon, authenticated;
grant select on table public.document_processing_attempts to service_role;

-- Terminal attempts never change again; active rows only transition once.
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
    or new.claimed_at is distinct from old.claimed_at then
    raise exception using message = 'processing_attempt_identity_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists document_processing_attempts_transition on public.document_processing_attempts;
create trigger document_processing_attempts_transition
  before update on public.document_processing_attempts
  for each row
  execute function public.document_processing_attempts_transition_guard();

-- ---------------------------------------------------------------------------
-- Atomic claim RPC. Replaces the worker's select-then-update claim.
-- Lock order (global DAG): documents -> jobs/attempts.
-- ---------------------------------------------------------------------------

create or replace function public.claim_document_processing_job(p_job_id uuid)
returns table (
  job_id uuid,
  document_id uuid,
  profile_id uuid,
  attempts integer,
  max_attempts integer,
  processing_attempt_id uuid,
  attempt_number integer,
  captured_write_generation bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.document_processing_jobs%rowtype;
  v_document public.documents%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
begin
  -- Snapshot read to learn the document; authoritative checks happen under lock.
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

  if v_document.id is null then
    return;
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.status is distinct from 'queued' then
    return; -- lost the race; not an error
  end if;

  if v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_job_document_profile_mismatch';
  end if;

  -- The partial unique indexes are the hard guarantee; this check returns a
  -- clean no-claim result instead of surfacing a constraint error.
  if exists (
    select 1 from public.document_processing_attempts
    where document_id = v_document.id and state = 'active'
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
    captured_write_generation
  )
  values (
    v_job.id,
    v_document.id,
    v_document.profile_id,
    v_job.attempts + 1,
    v_document.write_generation
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
    v_attempt.captured_write_generation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guarded attempt transitions. Every job/document status mutation after claim
-- goes through one of these so a stale attempt can never move job/document
-- state. All lock documents first, then job, then attempt.
-- ---------------------------------------------------------------------------

create or replace function public.pr2_lock_attempt_for_transition(
  p_attempt_id uuid,
  out v_attempt public.document_processing_attempts,
  out v_job public.document_processing_jobs,
  out v_document public.documents
)
language plpgsql
security definer
set search_path = public
as $$
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

  if v_attempt.state is distinct from 'active' then
    raise exception using message = 'processing_attempt_not_active';
  end if;

  if v_job.id is null or v_job.status is distinct from 'processing' then
    raise exception using message = 'processing_job_not_processing';
  end if;

  if v_document.id is null
    or v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id
    or v_attempt.document_id is distinct from v_document.id
    or v_attempt.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_attempt_ownership_mismatch';
  end if;
end;
$$;

revoke all on function public.pr2_lock_attempt_for_transition(uuid) from public, anon, authenticated, service_role;

-- Terminal failure: document + job + attempt fail together.
create or replace function public.fail_document_processing_attempt(
  p_attempt_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked record;
begin
  v_locked := public.pr2_lock_attempt_for_transition(p_attempt_id);

  update public.document_processing_jobs
  set status = 'failed',
      error = p_message,
      finished_at = now()
  where id = (v_locked.v_job).id;

  update public.documents
  set processing_status = 'failed',
      status = 'failed',
      processing_error = p_message
  where id = (v_locked.v_document).id;

  update public.document_processing_attempts
  set state = 'failed',
      terminal_at = now(),
      terminal_reason = p_message
  where id = p_attempt_id;
end;
$$;

-- Guarded retry: job returns to the queue, attempt becomes terminal.
create or replace function public.requeue_document_processing_attempt(
  p_attempt_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked record;
begin
  v_locked := public.pr2_lock_attempt_for_transition(p_attempt_id);

  update public.document_processing_jobs
  set status = 'queued',
      error = p_message,
      started_at = null,
      finished_at = null
  where id = (v_locked.v_job).id;

  update public.document_processing_attempts
  set state = 'requeued',
      terminal_at = now(),
      terminal_reason = p_message
  where id = p_attempt_id;
end;
$$;

-- Stale-claim reclamation by a supervisor/another worker instance.
create or replace function public.reclaim_document_processing_attempt(
  p_attempt_id uuid,
  p_message text,
  p_fail boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked record;
begin
  v_locked := public.pr2_lock_attempt_for_transition(p_attempt_id);

  if p_fail then
    update public.document_processing_jobs
    set status = 'failed',
        error = p_message,
        finished_at = now()
    where id = (v_locked.v_job).id;

    update public.documents
    set processing_status = 'failed',
        status = 'failed',
        processing_error = p_message
    where id = (v_locked.v_document).id;
  else
    update public.document_processing_jobs
    set status = 'queued',
        error = p_message,
        started_at = null,
        finished_at = null
    where id = (v_locked.v_job).id;
  end if;

  update public.document_processing_attempts
  set state = 'reclaimed',
      terminal_at = now(),
      terminal_reason = p_message
  where id = p_attempt_id;
end;
$$;

-- Non-instrumental completion: document completion fields, job, attempt, and
-- synthesis invalidation in one transaction. Instrumental success MUST use
-- the atomic publication finalizer (migration 037) instead.
create or replace function public.complete_document_processing_attempt(
  p_attempt_id uuid,
  p_document jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked record;
  v_status text;
begin
  v_locked := public.pr2_lock_attempt_for_transition(p_attempt_id);

  if (v_locked.v_document).document_type = 'instrumental_report' then
    raise exception using message = 'instrumental_completion_requires_finalizer';
  end if;

  if jsonb_typeof(p_document) is distinct from 'object' then
    raise exception using message = 'invalid_completion_payload';
  end if;

  v_status := p_document ->> 'processing_status';
  if v_status is null or v_status not in ('ready', 'needs_review') then
    raise exception using message = 'invalid_completion_processing_status';
  end if;

  update public.documents
  set processing_status = v_status,
      status = case when v_status = 'ready' then 'completed' else 'processing' end,
      page_count = coalesce((p_document ->> 'page_count')::integer, page_count),
      thumbnail_storage_path = coalesce(p_document ->> 'thumbnail_storage_path', thumbnail_storage_path),
      processing_version = coalesce(p_document ->> 'processing_version', processing_version),
      extraction_model = coalesce(p_document ->> 'extraction_model', extraction_model),
      processed_at = now(),
      lab_name = case when p_document ? 'lab_name' then nullif(p_document ->> 'lab_name', '') else lab_name end,
      observed_at = case when p_document ? 'observed_at' then (nullif(p_document ->> 'observed_at', ''))::date else observed_at end,
      modality = case when p_document ? 'modality' then nullif(p_document ->> 'modality', '') else modality end,
      document_summary = case when p_document ? 'document_summary' then nullif(p_document ->> 'document_summary', '') else document_summary end,
      ocr_status = coalesce(p_document ->> 'ocr_status', ocr_status),
      extraction_status = coalesce(p_document ->> 'extraction_status', extraction_status),
      detected_document_type = case when p_document ? 'detected_document_type' then nullif(p_document ->> 'detected_document_type', '') else detected_document_type end,
      type_mismatch_warning = coalesce((p_document ->> 'type_mismatch_warning')::boolean, type_mismatch_warning),
      type_mismatch_reason = case when p_document ? 'type_mismatch_reason' then nullif(p_document ->> 'type_mismatch_reason', '') else type_mismatch_reason end,
      processing_error = null
  where id = (v_locked.v_document).id;

  update public.document_processing_jobs
  set status = 'completed',
      error = null,
      finished_at = now()
  where id = (v_locked.v_job).id;

  update public.document_processing_attempts
  set state = 'completed',
      terminal_at = now(),
      terminal_reason = null
  where id = p_attempt_id;

  delete from public.profile_health_synthesis
  where profile_id = (v_locked.v_document).profile_id;
end;
$$;

-- Service-only execution for every claim/transition function.
revoke all on function public.claim_document_processing_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_document_processing_job(uuid) to service_role;

revoke all on function public.fail_document_processing_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_document_processing_attempt(uuid, text) to service_role;

revoke all on function public.requeue_document_processing_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.requeue_document_processing_attempt(uuid, text) to service_role;

revoke all on function public.reclaim_document_processing_attempt(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.reclaim_document_processing_attempt(uuid, text, boolean) to service_role;

revoke all on function public.complete_document_processing_attempt(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_document_processing_attempt(uuid, jsonb) to service_role;

revoke all on function public.documents_write_generation_guard() from public, anon, authenticated;
revoke all on function public.document_processing_attempts_transition_guard() from public, anon, authenticated;
