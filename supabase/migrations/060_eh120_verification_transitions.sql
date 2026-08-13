-- EH-120: explicit document laboratory lifecycle and trusted transitions.
--
-- `record_status` is owned by document_extracted_biomarkers. It is not a
-- verification status and is never inferred by consumer queries. All changes
-- to record_status/is_current/superseded_at pass through the service seams in
-- this migration; direct table updates are rejected by a trigger.

-- ── 1. Add the lifecycle columns and perform an unambiguous backfill ─────────

alter table public.document_extracted_biomarkers
  add column if not exists record_status text,
  add column if not exists lifecycle_reason_code text,
  add column if not exists lifecycle_request_hash text,
  add column if not exists superseded_by_processing_attempt_id uuid,
  add column if not exists processing_attempt_id uuid;

do $$
declare
  conflict_count bigint;
begin
  select count(*)
  into conflict_count
  from public.document_extracted_biomarkers as extracted
  where
    -- A legacy rejected row cannot also be a superseded row.
    (extracted.status = 'rejected' and extracted.is_current is false)
    -- `is_current` and `superseded_at` are one lineage pair.
    or (extracted.is_current is true and extracted.superseded_at is not null)
    or (extracted.is_current is false and extracted.superseded_at is null)
    -- A partially applied EH-120 rollout must not be silently repaired.
    or (extracted.record_status = 'active' and extracted.is_current is not true)
    or (extracted.record_status = 'rejected' and extracted.is_current is not true)
    or (extracted.record_status = 'superseded' and extracted.is_current is not false);

  if conflict_count > 0 then
    raise exception using
      message = 'eh120_record_lifecycle_preflight_failed',
      detail = format('%s extracted laboratory rows have contradictory lifecycle fields', conflict_count);
  end if;

  update public.document_extracted_biomarkers as extracted
  set record_status = case
    when extracted.status = 'rejected' then 'rejected'
    when extracted.is_current is false then 'superseded'
    else 'active'
  end
  where extracted.record_status is null;

  update public.document_extracted_biomarkers as extracted
  set lifecycle_reason_code = case
    when extracted.record_status = 'rejected' then coalesce(extracted.lifecycle_reason_code, 'other')
    when extracted.record_status = 'superseded' then coalesce(extracted.lifecycle_reason_code, 'document_reprocessed')
    else extracted.lifecycle_reason_code
  end
  where extracted.lifecycle_reason_code is null
    and extracted.record_status in ('rejected', 'superseded');
end;
$$;

alter table public.document_extracted_biomarkers
  alter column record_status set default 'active',
  alter column record_status set not null;

alter table public.document_extracted_biomarkers
  drop constraint if exists document_extracted_biomarkers_record_status_check,
  drop constraint if exists document_extracted_biomarkers_lifecycle_reason_code_check,
  drop constraint if exists document_extracted_biomarkers_lifecycle_request_hash_check,
  drop constraint if exists document_extracted_biomarkers_record_lineage_check,
  drop constraint if exists document_extracted_biomarkers_processing_attempt_fk,
  drop constraint if exists document_extracted_biomarkers_lifecycle_reason_owner_check,
  drop constraint if exists document_extracted_biomarkers_superseded_by_attempt_fk;

alter table public.document_extracted_biomarkers
  add constraint document_extracted_biomarkers_record_status_check
    check (record_status in ('active', 'rejected', 'superseded')),
  add constraint document_extracted_biomarkers_lifecycle_reason_code_check
    check (
      lifecycle_reason_code is null
      or lifecycle_reason_code in (
        'incorrect_extraction', 'duplicate_source', 'wrong_document',
        'privacy_request', 'other', 'document_reprocessed',
        'catalog_reprocessed', 'verification_reversed',
        'protected_human_decision', 'retryable_failure',
        'automatic_quality_gate'
      )
    ),
  add constraint document_extracted_biomarkers_lifecycle_request_hash_check
    check (lifecycle_request_hash is null or lifecycle_request_hash ~ '^[0-9a-f]{64}$'),
  add constraint document_extracted_biomarkers_record_lineage_check
    check (
      (record_status in ('active', 'rejected') and is_current is true and superseded_at is null)
      or (record_status = 'superseded' and is_current is false and superseded_at is not null)
    ),
  add constraint document_extracted_biomarkers_processing_attempt_fk
    foreign key (processing_attempt_id, profile_id, document_id)
    references public.document_processing_attempts (id, profile_id, document_id)
    on delete restrict,
  add constraint document_extracted_biomarkers_lifecycle_reason_owner_check
    check (
      (record_status = 'active' and lifecycle_reason_code is null and superseded_by_processing_attempt_id is null)
      or (record_status = 'rejected' and lifecycle_reason_code in ('incorrect_extraction', 'duplicate_source', 'wrong_document', 'privacy_request', 'other') and superseded_by_processing_attempt_id is null)
      or (record_status = 'superseded' and lifecycle_reason_code in ('document_reprocessed', 'catalog_reprocessed', 'retryable_failure'))
    ),
  add constraint document_extracted_biomarkers_superseded_by_attempt_fk
    foreign key (superseded_by_processing_attempt_id)
    references public.document_processing_attempts(id)
    on delete restrict;

alter table public.document_extracted_biomarkers
  add constraint document_extracted_biomarkers_rejected_reason_check
    check (
      record_status <> 'rejected'
      or lifecycle_reason_code in ('incorrect_extraction', 'duplicate_source', 'wrong_document', 'privacy_request', 'other')
    ),
  add constraint document_extracted_biomarkers_superseded_reason_check
    check (
      record_status <> 'superseded'
      or lifecycle_reason_code in ('document_reprocessed', 'catalog_reprocessed', 'retryable_failure')
    );

create index if not exists document_extracted_biomarkers_record_status_idx
  on public.document_extracted_biomarkers (document_id, record_status, created_at desc);

create or replace function public.eh120_record_lifecycle_preflight()
returns table (
  finding_code text,
  subject_id uuid,
  details jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when extracted.record_status not in ('active', 'rejected', 'superseded')
        then 'invalid_record_status'
      when extracted.record_status in ('active', 'rejected')
        and (extracted.is_current is not true or extracted.superseded_at is not null)
        then 'record_lineage_mismatch'
      when extracted.record_status = 'superseded'
        and (extracted.is_current is not false or extracted.superseded_at is null)
        then 'record_lineage_mismatch'
      when extracted.record_status = 'rejected'
        and extracted.lifecycle_reason_code not in ('incorrect_extraction', 'duplicate_source', 'wrong_document', 'privacy_request', 'other')
        then 'rejected_reason_missing'
      when extracted.record_status = 'superseded'
        and extracted.lifecycle_reason_code not in ('document_reprocessed', 'catalog_reprocessed', 'retryable_failure')
        then 'superseded_reason_missing'
      else 'unknown'
    end,
    extracted.id,
    jsonb_build_object(
      'record_status', extracted.record_status,
      'is_current', extracted.is_current,
      'superseded_at', extracted.superseded_at,
      'lifecycle_reason_code', extracted.lifecycle_reason_code
    )
  from public.document_extracted_biomarkers as extracted
  where extracted.record_status not in ('active', 'rejected', 'superseded')
     or (extracted.record_status in ('active', 'rejected')
       and (extracted.is_current is not true or extracted.superseded_at is not null))
     or (extracted.record_status = 'superseded'
       and (extracted.is_current is not false or extracted.superseded_at is null))
     or (extracted.record_status = 'rejected'
       and extracted.lifecycle_reason_code not in ('incorrect_extraction', 'duplicate_source', 'wrong_document', 'privacy_request', 'other'))
     or (extracted.record_status = 'superseded'
       and extracted.lifecycle_reason_code not in ('document_reprocessed', 'catalog_reprocessed', 'retryable_failure'));
$$;

-- ── 2. Service operation ledger for lifecycle idempotency ────────────────────

create table if not exists public.eh120_lifecycle_transition_operations (
  request_hash text primary key check (request_hash ~ '^[0-9a-f]{64}$'),
  operation text not null check (operation in ('reject', 'supersede')),
  document_id uuid not null references public.documents(id) on delete cascade,
  extracted_biomarker_id uuid references public.document_extracted_biomarkers(id) on delete cascade,
  processing_attempt_id uuid,
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_id uuid,
  reason_code text not null check (reason_code in (
    'incorrect_extraction', 'duplicate_source', 'wrong_document',
    'privacy_request', 'other', 'document_reprocessed', 'catalog_reprocessed'
  )),
  expected_source_snapshot timestamptz,
  expected_active_revision_id uuid,
  prior_record_status text not null check (prior_record_status in ('active', 'rejected', 'superseded')),
  next_record_status text not null check (next_record_status in ('rejected', 'superseded')),
  result jsonb not null default '[]'::jsonb check (jsonb_typeof(result) = 'array'),
  created_at timestamptz not null default now(),
  constraint eh120_lifecycle_operation_actor_check
    check ((actor_type = 'system' and actor_id is null) or (actor_type = 'user' and actor_id is not null))
);

create index if not exists document_extracted_biomarkers_processing_attempt_idx
  on public.document_extracted_biomarkers (document_id, processing_attempt_id);

alter table public.eh120_lifecycle_transition_operations enable row level security;
drop policy if exists "service_all_eh120_lifecycle_transition_operations"
  on public.eh120_lifecycle_transition_operations;
create policy "service_all_eh120_lifecycle_transition_operations"
  on public.eh120_lifecycle_transition_operations
  for all to service_role using (true) with check (true);
revoke all on public.eh120_lifecycle_transition_operations from public, anon, authenticated;
grant select, insert, update on public.eh120_lifecycle_transition_operations to service_role;

-- ── 3. Direct-write and source-lineage guards ────────────────────────────────

create or replace function public.eh120_guard_source_lifecycle_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
    and old.record_status is distinct from 'active' then
    raise exception using message = 'terminal_record';
  end if;

  if TG_OP = 'INSERT'
    and (
      new.record_status is distinct from 'active'
      or new.is_current is not true
      or new.superseded_at is not null
    )
    and coalesce(current_setting('easyhealth.lifecycle_transition', true), '') <> 'on' then
    raise exception using message = 'eh120_lifecycle_transition_required';
  elsif TG_OP = 'UPDATE'
    and (
      new.record_status is distinct from old.record_status
      or new.is_current is distinct from old.is_current
      or new.superseded_at is distinct from old.superseded_at
      or new.lifecycle_reason_code is distinct from old.lifecycle_reason_code
      or new.lifecycle_request_hash is distinct from old.lifecycle_request_hash
      or new.superseded_by_processing_attempt_id is distinct from old.superseded_by_processing_attempt_id
      or new.processing_attempt_id is distinct from old.processing_attempt_id
    )
    and coalesce(current_setting('easyhealth.lifecycle_transition', true), '') <> 'on' then
    raise exception using message = 'eh120_lifecycle_transition_required';
  end if;
  return new;
end;
$$;

create or replace function public.eh120_validate_source_lineage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    new.record_status in ('active', 'rejected')
    and (new.is_current is not true or new.superseded_at is not null)
  ) or (
    new.record_status = 'superseded'
    and (new.is_current is not false or new.superseded_at is null)
  ) then
    raise exception using message = 'eh120_record_lineage_mismatch';
  end if;
  if new.record_status = 'active'
    and (
      new.lifecycle_reason_code is not null
      or new.superseded_by_processing_attempt_id is not null
    ) then
    raise exception using message = 'eh120_active_lifecycle_metadata_invalid';
  end if;
  if new.record_status = 'rejected'
    and new.lifecycle_reason_code not in ('incorrect_extraction', 'duplicate_source', 'wrong_document', 'privacy_request', 'other') then
    raise exception using message = 'eh120_rejection_reason_required';
  end if;
  if new.record_status = 'rejected'
    and new.superseded_by_processing_attempt_id is not null then
    raise exception using message = 'eh120_rejected_source_cannot_be_superseded';
  end if;
  if new.record_status = 'superseded'
    and new.lifecycle_reason_code not in ('document_reprocessed', 'catalog_reprocessed', 'retryable_failure') then
    raise exception using message = 'eh120_supersession_reason_required';
  end if;
  return new;
end;
$$;

drop trigger if exists eh120_source_lifecycle_write_guard
  on public.document_extracted_biomarkers;
create trigger eh120_source_lifecycle_write_guard
before insert or update
on public.document_extracted_biomarkers
for each row execute function public.eh120_guard_source_lifecycle_write();

drop trigger if exists eh120_source_lineage_guard
  on public.document_extracted_biomarkers;
create trigger eh120_source_lineage_guard
before insert or update of record_status, is_current, superseded_at,
  lifecycle_reason_code, superseded_by_processing_attempt_id
on public.document_extracted_biomarkers
for each row execute function public.eh120_validate_source_lineage();

comment on column public.document_extracted_biomarkers.record_status is
  'EH-120 source lifecycle: active, rejected, or superseded. Independent from extraction status and verification_status.';
comment on column public.document_extracted_biomarkers.lifecycle_reason_code is
  'EH-120 stable non-PII lifecycle reason. Free-form document content is not stored here.';

-- ── 4. Owner rejection seam ──────────────────────────────────────────────────

create or replace function public.eh120_reject_document_extracted_biomarker(
  p_extracted_biomarker_id uuid,
  p_profile_id uuid,
  p_expected_source_snapshot timestamptz,
  p_expected_active_revision_id uuid,
  p_reason_code text,
  p_request_hash text
)
returns table (
  extracted_biomarker_id uuid,
  prior_record_status text,
  next_record_status text,
  active_revision_id uuid,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.document_extracted_biomarkers%rowtype;
  active_revision_id uuid;
  operation_row public.eh120_lifecycle_transition_operations%rowtype;
  result_row jsonb;
begin
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_lifecycle_request_hash';
  end if;
  if p_profile_id is null then
    raise exception using message = 'authorization_required';
  end if;
  if p_expected_source_snapshot is null then
    raise exception using message = 'stale_source_snapshot';
  end if;
  if p_reason_code not in ('incorrect_extraction', 'duplicate_source', 'wrong_document', 'privacy_request', 'other') then
    raise exception using message = 'invalid_lifecycle_reason_code';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_hash, 120));

  select * into operation_row
  from public.eh120_lifecycle_transition_operations
  where request_hash = p_request_hash
  for update;
  if operation_row.request_hash is not null then
    if operation_row.operation <> 'reject'
      or operation_row.extracted_biomarker_id is distinct from p_extracted_biomarker_id
      or operation_row.actor_type is distinct from 'user'
      or operation_row.actor_id is distinct from p_profile_id
      or operation_row.reason_code is distinct from p_reason_code
      or operation_row.expected_source_snapshot is distinct from p_expected_source_snapshot
      or operation_row.expected_active_revision_id is distinct from p_expected_active_revision_id then
      raise exception using message = 'lifecycle_idempotency_conflict';
    end if;
    result_row := operation_row.result -> 0;
    return query select
      p_extracted_biomarker_id,
      operation_row.prior_record_status,
      operation_row.next_record_status,
      nullif(result_row ->> 'active_revision_id', '')::uuid,
      true;
    return;
  end if;

  select * into source_row
  from public.document_extracted_biomarkers
  where id = p_extracted_biomarker_id
  for update;
  if source_row.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;
  if source_row.profile_id is distinct from p_profile_id then
    raise exception using message = 'foreign_owner';
  end if;
  if source_row.record_status <> 'active' then
    raise exception using message = 'terminal_record';
  end if;
  if source_row.is_current is not true then
    raise exception using message = 'record_not_current';
  end if;
  if source_row.created_at is distinct from p_expected_source_snapshot then
    raise exception using message = 'stale_source_snapshot';
  end if;

  select revision.id into active_revision_id
  from public.observation_normalization_revisions as revision
  where revision.extracted_biomarker_id = source_row.id
    and revision.is_active
  order by revision.created_at desc
  limit 1
  for update;
  if active_revision_id is distinct from p_expected_active_revision_id then
    raise exception using message = 'stale_revision_snapshot';
  end if;

  insert into public.eh120_lifecycle_transition_operations (
    request_hash, operation, document_id, extracted_biomarker_id,
    actor_type, actor_id, reason_code, expected_source_snapshot,
    expected_active_revision_id, prior_record_status, next_record_status
  ) values (
    p_request_hash, 'reject', source_row.document_id, source_row.id,
    'user', p_profile_id, p_reason_code, p_expected_source_snapshot,
    p_expected_active_revision_id, source_row.record_status, 'rejected'
  ) returning * into operation_row;

  perform set_config('easyhealth.lifecycle_transition', 'on', true);
  update public.document_extracted_biomarkers
  set record_status = 'rejected',
      lifecycle_reason_code = p_reason_code,
      lifecycle_request_hash = p_request_hash
  where id = source_row.id;

  result_row := jsonb_build_object(
    'extracted_biomarker_id', source_row.id,
    'active_revision_id', active_revision_id
  );
  update public.eh120_lifecycle_transition_operations
  set result = jsonb_build_array(result_row)
  where request_hash = p_request_hash;

  return query select source_row.id, 'active'::text, 'rejected'::text, active_revision_id, false;
end;
$$;

-- ── 5. Service supersession seam ────────────────────────────────────────────

create or replace function public.eh120_supersede_document_extracted_biomarkers(
  p_document_id uuid,
  p_profile_id uuid,
  p_processing_attempt_id uuid,
  p_request_hash text
)
returns table (
  extracted_biomarker_id uuid,
  prior_record_status text,
  next_record_status text,
  active_revision_id uuid,
  outcome_code text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  document_profile_id uuid;
  operation_row public.eh120_lifecycle_transition_operations%rowtype;
  source_row public.document_extracted_biomarkers%rowtype;
  active_revision_id uuid;
  protected boolean;
  result_row jsonb;
  results jsonb := '[]'::jsonb;
begin
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_lifecycle_request_hash';
  end if;
  if p_document_id is null or p_profile_id is null or p_processing_attempt_id is null then
    raise exception using message = 'authorization_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_hash, 120));

  select profile_id into document_profile_id
  from public.documents
  where id = p_document_id
  for update;
  if document_profile_id is null then
    raise exception using message = 'document_not_found';
  end if;
  if document_profile_id is distinct from p_profile_id then
    raise exception using message = 'foreign_owner';
  end if;

  if not exists (
    select 1
    from public.document_processing_attempts
    where id = p_processing_attempt_id
      and document_id = p_document_id
      and profile_id = p_profile_id
      and state = 'completed'
  ) then
    raise exception using message = 'processing_attempt_not_completed';
  end if;

  select * into operation_row
  from public.eh120_lifecycle_transition_operations
  where request_hash = p_request_hash
  for update;
  if operation_row.request_hash is not null then
    if operation_row.operation <> 'supersede'
      or operation_row.document_id is distinct from p_document_id
      or operation_row.processing_attempt_id is distinct from p_processing_attempt_id
      or operation_row.actor_type is distinct from 'system'
      or operation_row.actor_id is not null
      or operation_row.reason_code is distinct from 'document_reprocessed' then
      raise exception using message = 'lifecycle_idempotency_conflict';
    end if;
    return query
    select
      rows.extracted_biomarker_id::uuid,
      rows.prior_record_status,
      rows.next_record_status,
      nullif(rows.active_revision_id, '')::uuid,
      rows.outcome_code,
      true
    from jsonb_to_recordset(operation_row.result) as rows(
      extracted_biomarker_id text,
      prior_record_status text,
      next_record_status text,
      active_revision_id text,
      outcome_code text
    );
    return;
  end if;

  insert into public.eh120_lifecycle_transition_operations (
    request_hash, operation, document_id, processing_attempt_id,
    actor_type, actor_id, reason_code, prior_record_status, next_record_status
  ) values (
    p_request_hash, 'supersede', p_document_id, p_processing_attempt_id,
    'system', null, 'document_reprocessed', 'active', 'superseded'
  ) returning * into operation_row;

  for source_row in
    select *
    from public.document_extracted_biomarkers
    where document_id = p_document_id
      and profile_id = p_profile_id
      and record_status = 'active'
      and is_current
      and processing_attempt_id is distinct from p_processing_attempt_id
    order by id
    for update
  loop
    select revision.id into active_revision_id
    from public.observation_normalization_revisions as revision
    where revision.extracted_biomarker_id = source_row.id
      and revision.is_active
    order by revision.created_at desc
    limit 1
    for update;

    select exists (
      select 1
      from public.observation_normalization_revisions as revision
      left join public.observation_normalization_revisions as prior
        on prior.id = revision.reversal_of_revision_id
      where revision.extracted_biomarker_id = source_row.id
        and revision.is_active
        and (
          revision.verification_status in ('user_verified', 'manually_corrected')
          or prior.verification_status in ('user_verified', 'manually_corrected')
        )
    ) into protected;

    if protected then
      result_row := jsonb_build_object(
        'extracted_biomarker_id', source_row.id,
        'prior_record_status', 'active',
        'next_record_status', 'active',
        'active_revision_id', active_revision_id,
        'outcome_code', 'skipped_protected_decision'
      );
      results := results || jsonb_build_array(result_row);
      continue;
    end if;

    perform set_config('easyhealth.lifecycle_transition', 'on', true);
    update public.document_extracted_biomarkers
    set record_status = 'superseded',
        is_current = false,
        superseded_at = coalesce(superseded_at, now()),
        lifecycle_reason_code = 'document_reprocessed',
        lifecycle_request_hash = p_request_hash,
        superseded_by_processing_attempt_id = p_processing_attempt_id
    where id = source_row.id;

    result_row := jsonb_build_object(
      'extracted_biomarker_id', source_row.id,
      'prior_record_status', 'active',
      'next_record_status', 'superseded',
      'active_revision_id', active_revision_id,
      'outcome_code', 'superseded'
    );
    results := results || jsonb_build_array(result_row);
  end loop;

  update public.eh120_lifecycle_transition_operations
  set result = results
  where request_hash = p_request_hash;

  return query
  select
    rows.extracted_biomarker_id::uuid,
    rows.prior_record_status,
    rows.next_record_status,
    nullif(rows.active_revision_id, '')::uuid,
    rows.outcome_code,
    false
  from jsonb_to_recordset(results) as rows(
    extracted_biomarker_id text,
    prior_record_status text,
    next_record_status text,
    active_revision_id text,
    outcome_code text
  );
end;
$$;

-- ── 6. EH-121 lifecycle event metadata and trigger capture ───────────────────

alter type public.observation_change_event_kind add value if not exists 'record_rejected';
alter type public.observation_change_event_kind add value if not exists 'record_superseded';
alter type public.observation_change_event_kind add value if not exists 'automatic_verification';

alter table public.observation_change_events
  add column if not exists prior_record_status text,
  add column if not exists next_record_status text,
  add column if not exists reason_code text,
  add column if not exists transition_request_hash text;

alter table public.observation_change_events
  drop constraint if exists observation_change_events_prior_record_status_check,
  drop constraint if exists observation_change_events_next_record_status_check,
  drop constraint if exists observation_change_events_reason_code_check,
  drop constraint if exists observation_change_events_transition_request_hash_check;

alter table public.observation_change_events
  add constraint observation_change_events_prior_record_status_check
    check (prior_record_status is null or prior_record_status in ('active', 'rejected', 'superseded')),
  add constraint observation_change_events_next_record_status_check
    check (next_record_status is null or next_record_status in ('active', 'rejected', 'superseded')),
  add constraint observation_change_events_reason_code_check
    check (
      reason_code is null
      or reason_code in (
        'incorrect_extraction', 'duplicate_source', 'wrong_document',
        'privacy_request', 'other', 'document_reprocessed',
        'catalog_reprocessed', 'verification_reversed',
        'protected_human_decision', 'retryable_failure',
        'automatic_quality_gate'
      )
    ),
  add constraint observation_change_events_transition_request_hash_check
    check (transition_request_hash is null or transition_request_hash ~ '^[0-9a-f]{64}$');


update public.observation_change_events
set next_record_status = 'superseded',
    reason_code = coalesce(reason_code, 'document_reprocessed')
where event_kind = 'extraction_superseded'
  and next_record_status is null;

create or replace function public.eh120_capture_lifecycle_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  operation_row public.eh120_lifecycle_transition_operations%rowtype;
  active_revision_id uuid;
  event_kind public.observation_change_event_kind;
begin
  if old.record_status is not distinct from new.record_status then
    return null;
  end if;

  select * into operation_row
  from public.eh120_lifecycle_transition_operations
  where request_hash = new.lifecycle_request_hash;

  select revision.id into active_revision_id
  from public.observation_normalization_revisions as revision
  where revision.extracted_biomarker_id = new.id
    and revision.is_active
  order by revision.created_at desc
  limit 1;

  event_kind := case new.record_status
    when 'rejected' then 'record_rejected'::public.observation_change_event_kind
    when 'superseded' then 'record_superseded'::public.observation_change_event_kind
    else 'verification_changed'::public.observation_change_event_kind
  end;

  insert into public.observation_change_events (
    event_kind, origin, profile_id, document_id, observation_id,
    extracted_biomarker_id, source_revision_id, actor_type, actor_id,
    prior_record_status, next_record_status, reason_code,
    transition_request_hash, occurred_at
  ) values (
    event_kind, 'capture', new.profile_id,
    new.document_id,
    (select observation.id from public.observations as observation
      where observation.source_extracted_biomarker_id = new.id limit 1),
    new.id, active_revision_id,
    coalesce(operation_row.actor_type, 'system'),
    case when operation_row.actor_type = 'user' then operation_row.actor_id else null end,
    old.record_status, new.record_status, new.lifecycle_reason_code,
    new.lifecycle_request_hash, coalesce(new.superseded_at, now())
  ) on conflict do nothing;

  return null;
end;
$$;

drop trigger if exists eh120_capture_lifecycle_transition
  on public.document_extracted_biomarkers;
create trigger eh120_capture_lifecycle_transition
after update of record_status on public.document_extracted_biomarkers
for each row execute function public.eh120_capture_lifecycle_transition();

-- A failed, requeued, or reclaimed attempt must never leave its uncompleted
-- laboratory rows in the active review projection. The rows remain retained
-- as historical evidence, but are terminally superseded with a stable,
-- non-PII retry reason. Completion is intentionally excluded: the completion
-- seam supersedes the previous source batch after the replacement is valid.
create or replace function public.eh120_hide_incomplete_attempt_sources()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_hash text;
begin
  if old.state is distinct from 'active'
    or new.state = 'completed' then
    return null;
  end if;

  request_hash := encode(
    extensions.digest(
      convert_to('eh120:retryable_failure:' || new.id::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  perform set_config('easyhealth.lifecycle_transition', 'on', true);

  update public.document_extracted_biomarkers
  set record_status = 'superseded',
      is_current = false,
      superseded_at = coalesce(superseded_at, now()),
      lifecycle_reason_code = 'retryable_failure',
      lifecycle_request_hash = request_hash,
      superseded_by_processing_attempt_id = null
  where processing_attempt_id = new.id
    and record_status = 'active'
    and is_current is true
    and not exists (
      select 1
      from public.observation_normalization_revisions as revision
      left join public.observation_normalization_revisions as prior
        on prior.id = revision.reversal_of_revision_id
      where revision.extracted_biomarker_id = document_extracted_biomarkers.id
        and revision.is_active
        and (
          revision.verification_status in ('user_verified', 'manually_corrected')
          or prior.verification_status in ('user_verified', 'manually_corrected')
        )
    );

  return null;
end;
$$;

revoke all on function public.eh120_hide_incomplete_attempt_sources()
  from public, anon, authenticated;
grant execute on function public.eh120_hide_incomplete_attempt_sources()
  to service_role;

drop trigger if exists eh120_hide_incomplete_attempt_sources
  on public.document_processing_attempts;
create trigger eh120_hide_incomplete_attempt_sources
after update of state on public.document_processing_attempts
for each row execute function public.eh120_hide_incomplete_attempt_sources();

comment on function public.eh120_hide_incomplete_attempt_sources() is
  'EH-120 hides laboratory rows from failed, requeued, or reclaimed processing attempts without deleting retained evidence.';


-- EH-121's legacy extraction event describes the same update. The explicit
-- lifecycle event above is authoritative for EH-120 transitions, so avoid two
-- events for one supersession while keeping the old event for pre-EH-120 rows.
create or replace function public.eh121_capture_extraction_supersession()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bound_observation_id uuid;
begin
  if old.is_current is not true or new.is_current is not false then
    return null;
  end if;
  if old.record_status is distinct from new.record_status then
    return null;
  end if;

  select id into bound_observation_id
  from public.observations
  where source_extracted_biomarker_id = new.id;

  insert into public.observation_change_events (
    event_kind, origin, profile_id, document_id, observation_id,
    extracted_biomarker_id, actor_type, occurred_at
  ) values (
    'extraction_superseded', 'capture', new.profile_id, new.document_id,
    bound_observation_id, new.id, 'system', coalesce(new.superseded_at, now())
  ) on conflict do nothing;
  return null;
end;
$$;

-- ── 7. Public surface and grants ────────────────────────────────────────────

revoke all on function public.eh120_record_lifecycle_preflight()
  from public, anon, authenticated;
grant execute on function public.eh120_record_lifecycle_preflight() to service_role;


-- Automatic revisions are only valid when produced by the EH-120 service
-- writer. The existing EH-104 trigger still validates the actor/status matrix.
create or replace function public.eh120_guard_automatic_verification_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification_status = 'auto_verified'
    and coalesce(current_setting('easyhealth.automatic_verification_writer', true), '') <> 'on' then
    raise exception using message = 'automatic_verification_writer_required';
  end if;
  return new;
end;
$$;
revoke all on function public.eh120_guard_automatic_verification_write()
  from public, anon, authenticated;

drop trigger if exists eh120_automatic_verification_writer_guard
  on public.observation_normalization_revisions;
create trigger eh120_automatic_verification_writer_guard
before insert or update of verification_status, verification_decided_at,
  verification_actor_type, verification_actor_id
on public.observation_normalization_revisions
for each row execute function public.eh120_guard_automatic_verification_write();
revoke all on function public.eh120_reject_document_extracted_biomarker(uuid, uuid, timestamptz, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.eh120_reject_document_extracted_biomarker(uuid, uuid, timestamptz, uuid, text, text)
  to service_role;
revoke all on function public.eh120_supersede_document_extracted_biomarkers(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.eh120_supersede_document_extracted_biomarkers(uuid, uuid, uuid, text)
  to service_role;

comment on table public.eh120_lifecycle_transition_operations is
  'EH-120 idempotency metadata for trusted rejection/supersession transitions. Identifiers, hashes, enums and safe reason codes only.';

notify pgrst, 'reload schema';

-- ── 6a. Service-only automatic verification writer ──────────────────────────

create or replace function public.eh120_write_automatic_verification_v2(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_request_hash text,
  p_expected_active_revision_id uuid,
  p_extraction_version text,
  p_quality_gate_approved boolean,
  p_reviewed_measurement_definition boolean,
  p_measurement_override jsonb default null
)
returns table (
  observation_id uuid,
  revision_id uuid,
  verification_status text,
  resolver_result text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.document_extracted_biomarkers%rowtype;
  target_observation public.observations%rowtype;
  target_revision public.observation_normalization_revisions%rowtype;
  active_revision public.observation_normalization_revisions%rowtype;
  promoted_revision public.observation_normalization_revisions%rowtype;
  target_result text;
  target_definition_key text;
  target_analyte_key text;
  target_mapping_confidence numeric;
  target_mapping_confidence_band text;
  target_resolver_evidence jsonb;
  target_trace jsonb;
  target_trace_schema_version text;
  request_was_reused boolean := false;
begin
  -- The function is service-granted and has no actor/status input. Keep a
  -- defensive JWT guard for direct SQL callers that bypass PostgREST grants.
  if coalesce(current_setting('request.jwt.claim.role', true), '') in ('anon', 'authenticated') then
    raise exception using message = 'automatic_verification_service_role_required';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_normalization_writer_request_hash';
  end if;
  if p_quality_gate_approved is not true then
    raise exception using message = 'automatic_quality_gate_not_approved';
  end if;
  if jsonb_typeof(p_observation) is distinct from 'object'
    or jsonb_typeof(p_resolution) is distinct from 'object' then
    raise exception using message = 'invalid_normalization_writer_payload';
  end if;

  target_result := nullif(btrim(p_resolution ->> 'resolver_result'), '');
  target_definition_key := nullif(btrim(p_resolution ->> 'measurement_definition_key'), '');
  target_analyte_key := nullif(btrim(p_resolution ->> 'analyte_key'), '');
  target_mapping_confidence := nullif(p_resolution ->> 'mapping_confidence', '')::numeric;
  target_mapping_confidence_band := nullif(btrim(p_resolution ->> 'mapping_confidence_band'), '');
  target_resolver_evidence := p_resolution -> 'resolver_evidence';
  target_trace := p_resolution -> 'resolver_decision_trace';
  target_trace_schema_version := nullif(btrim(p_resolution ->> 'resolver_trace_schema_version'), '');

  if target_result is distinct from 'resolved'
    or target_definition_key is null
    or target_analyte_key is null
    or target_mapping_confidence is null
    or target_mapping_confidence < 0
    or target_mapping_confidence > 1
    or target_mapping_confidence_band not in ('high', 'medium', 'low')
    or p_reviewed_measurement_definition is not true
    or p_measurement_override is not null
    or not public.eh115_validate_resolver_decision_trace(target_trace, target_trace_schema_version) then
    raise exception using message = 'automatic_verification_policy_rejected';
  end if;

  select *
  into source_row
  from public.document_extracted_biomarkers
  where id = p_extracted_biomarker_id
  for update;
  if source_row.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;
  if source_row.record_status <> 'active' or source_row.is_current is not true then
    raise exception using message = 'automatic_verification_source_not_current';
  end if;
  if (p_observation ->> 'profile_id')::uuid is distinct from source_row.profile_id
    or (p_observation ->> 'document_id')::uuid is distinct from source_row.document_id then
    raise exception using message = 'observation_source_owner_mismatch';
  end if;

  select *
  into active_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = source_row.id
    and is_active
  order by created_at desc
  limit 1
  for update;
  if active_revision.id is distinct from p_expected_active_revision_id then
    raise exception using message = 'stale_revision_snapshot';
  end if;
  if active_revision.measurement_override is not null then
    raise exception using message = 'automatic_verification_protected_decision';
  end if;
  if active_revision.verification_status in ('user_verified', 'manually_corrected')
    or exists (
      select 1
      from public.observation_normalization_revisions as prior
      where prior.id = active_revision.reversal_of_revision_id
        and prior.verification_status in ('user_verified', 'manually_corrected')
    ) then
    raise exception using message = 'automatic_verification_protected_decision';
  end if;

  select *
  into target_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = source_row.id
    and writer_request_hash = p_request_hash
  for update;
  if target_revision.id is not null then
    if target_revision.verification_status is distinct from 'auto_verified'
      or target_revision.verification_actor_type is distinct from 'system'
      or target_revision.verification_actor_id is not null then
      raise exception using message = 'automatic_verification_request_conflict';
    end if;
    request_was_reused := true;
  else
    insert into public.observations (
      profile_id, document_id, source_extracted_biomarker_id, name,
      value, value_kind, value_text, ordinal, unit, ref_low, ref_high,
      observed_at, specimen, modifier, raw_name, raw_value_text,
      raw_reference_text, raw_unit, source_page, source_text, bounding_box,
      confidence, reported_alt_value, reported_alt_unit, extraction_version,
      provenance_schema_version, catalog_manifest_version,
      catalog_manifest_digest, resolver_version, normalization_version,
      observation_kind
    )
    values (
      (p_observation ->> 'profile_id')::uuid,
      (p_observation ->> 'document_id')::uuid,
      source_row.id,
      coalesce(nullif(btrim(p_observation ->> 'name'), ''), 'Unnamed laboratory result'),
      nullif(p_observation ->> 'value', '')::numeric,
      coalesce(nullif(btrim(p_observation ->> 'value_kind'), ''), 'text'),
      nullif(p_observation ->> 'value_text', ''),
      nullif(p_observation ->> 'ordinal', '')::integer,
      coalesce(p_observation ->> 'unit', ''),
      nullif(p_observation ->> 'ref_low', '')::numeric,
      nullif(p_observation ->> 'ref_high', '')::numeric,
      (p_observation ->> 'observed_at')::date,
      coalesce(nullif(btrim(p_observation ->> 'specimen'), ''), 'unspecified'),
      coalesce(nullif(btrim(p_observation ->> 'modifier'), ''), 'none'),
      nullif(p_observation ->> 'raw_name', ''),
      nullif(p_observation ->> 'raw_value_text', ''),
      nullif(p_observation ->> 'raw_reference_text', ''),
      nullif(p_observation ->> 'raw_unit', ''),
      nullif(p_observation ->> 'source_page', '')::integer,
      nullif(p_observation ->> 'source_text', ''),
      p_observation -> 'bounding_box',
      nullif(p_observation ->> 'confidence', '')::numeric,
      nullif(p_observation ->> 'reported_alt_value', '')::numeric,
      nullif(p_observation ->> 'reported_alt_unit', ''),
      nullif(p_extraction_version, ''),
      coalesce(nullif(btrim(p_observation ->> 'provenance_schema_version'), ''), '1'),
      nullif(btrim(p_resolution ->> 'catalog_manifest_version'), ''),
      nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), ''),
      nullif(btrim(p_resolution ->> 'resolver_version'), ''),
      nullif(btrim(p_resolution ->> 'normalization_version'), ''),
      'lab'
    )
    on conflict (source_extracted_biomarker_id)
      where source_extracted_biomarker_id is not null
      do nothing
    returning * into target_observation;

    if target_observation.id is null then
      select * into target_observation
      from public.observations
      where source_extracted_biomarker_id = source_row.id;
    end if;
    if target_observation.id is null then
      raise exception using message = 'observation_write_failed';
    end if;

    perform set_config('easyhealth.automatic_verification_writer', 'on', true);

    insert into public.observation_normalization_revisions (
      extracted_biomarker_id, observation_id, input_evidence_hash,
      measurement_definition_key, analyte_key, resolver_result,
      mapping_confidence, mapping_confidence_band, resolver_evidence,
      catalog_manifest_version, catalog_manifest_digest, resolver_version,
      normalization_version, extraction_version, verification_status,
      verification_decided_at, verification_actor_type, verification_actor_id,
      mapping_change_classification, created_by, supersedes_revision_id,
      writer_request_hash, resolver_decision_trace,
      resolver_trace_schema_version, measurement_override
    )
    values (
      source_row.id, target_observation.id,
      nullif(btrim(p_resolution ->> 'input_evidence_hash'), ''),
      target_definition_key, target_analyte_key, target_result,
      target_mapping_confidence, target_mapping_confidence_band,
      target_resolver_evidence,
      nullif(btrim(p_resolution ->> 'catalog_manifest_version'), ''),
      nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), ''),
      nullif(btrim(p_resolution ->> 'resolver_version'), ''),
      nullif(btrim(p_resolution ->> 'normalization_version'), ''),
      nullif(p_extraction_version, ''), 'auto_verified', now(), 'system', null,
      'additive', null, active_revision.id, p_request_hash, target_trace,
      target_trace_schema_version, p_measurement_override
    )
    on conflict (extracted_biomarker_id, writer_request_hash)
      where writer_request_hash is not null
      do nothing
    returning * into target_revision;

    if target_revision.id is null then
      select * into target_revision
      from public.observation_normalization_revisions
      where extracted_biomarker_id = source_row.id
        and writer_request_hash = p_request_hash
      for update;
      request_was_reused := true;
    end if;
  end if;

  if target_observation.id is null then
    select * into target_observation
    from public.observations
    where source_extracted_biomarker_id = source_row.id;
  end if;
  if target_revision.id is null or target_observation.id is null then
    raise exception using message = 'automatic_verification_projection_missing';
  end if;

  if not request_was_reused then
    select *
    into promoted_revision
    from public.promote_observation_normalization_revision_v2(
      target_revision.id, target_observation.id, active_revision.id, null::uuid,
      p_observation
    );

    update public.document_extracted_biomarkers
    set status = 'accepted',
        analyte_key = target_analyte_key,
        measurement_definition_key = target_definition_key,
        resolver_result = target_result,
        resolution_status = target_result,
        mapping_confidence = target_mapping_confidence,
        mapping_confidence_band = target_mapping_confidence_band,
        resolver_evidence = target_resolver_evidence,
        catalog_manifest_version = nullif(btrim(p_resolution ->> 'catalog_manifest_version'), ''),
        catalog_manifest_digest = nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), ''),
        resolver_version = nullif(btrim(p_resolution ->> 'resolver_version'), ''),
        normalization_version = nullif(btrim(p_resolution ->> 'normalization_version'), ''),
        extraction_version = nullif(p_extraction_version, ''),
        verification_status = 'auto_verified'
    where id = source_row.id;
  else
    promoted_revision := target_revision;
  end if;

  return query select
    target_observation.id,
    promoted_revision.id,
    promoted_revision.verification_status,
    promoted_revision.resolver_result,
    request_was_reused;
end;
$$;

revoke all on function public.eh120_write_automatic_verification_v2(
  uuid, jsonb, jsonb, text, uuid, text, boolean, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.eh120_write_automatic_verification_v2(
  uuid, jsonb, jsonb, text, uuid, text, boolean, boolean, jsonb
) to service_role;

comment on function public.eh120_write_automatic_verification_v2(
  uuid, jsonb, jsonb, text, uuid, text, boolean, boolean, jsonb
) is
  'EH-120 service-only automatic verification writer. Actor and verification status are derived by the function, never accepted from callers.';

notify pgrst, 'reload schema';

-- EH-120 uses a distinct ledger event for system verification. Replacing the
-- EH-121 capture function keeps one event per promoted revision.
create or replace function public.eh121_capture_revision_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior public.observation_normalization_revisions%rowtype;
  extracted public.document_extracted_biomarkers%rowtype;
  resolved_actor_id uuid;
  resolved_actor_type text;
  event_kind public.observation_change_event_kind;
begin
  if not new.is_active then
    return null;
  end if;
  if TG_OP = 'UPDATE' and old.is_active then
    return null;
  end if;

  select * into extracted
  from public.document_extracted_biomarkers
  where id = new.extracted_biomarker_id;
  if not found then
    return null;
  end if;

  if new.supersedes_revision_id is not null then
    select * into prior
    from public.observation_normalization_revisions
    where id = new.supersedes_revision_id;
  end if;

  resolved_actor_id := coalesce(new.verification_actor_id, new.created_by, new.promoted_by);
  resolved_actor_type := case
    when new.verification_actor_type = 'user' and resolved_actor_id is not null then 'user'
    when new.verification_actor_type = 'system' then 'system'
    when resolved_actor_id is not null then 'user'
    else 'system'
  end;
  event_kind := case
    when new.verification_status = 'auto_verified'
      then 'automatic_verification'::public.observation_change_event_kind
    else public.eh121_classify_revision_event(
      new.reversal_of_revision_id,
      prior.id,
      prior.measurement_definition_key,
      prior.analyte_key,
      new.measurement_definition_key,
      new.analyte_key
    )
  end;

  insert into public.observation_change_events (
    event_kind, origin, profile_id, document_id, observation_id,
    extracted_biomarker_id, source_revision_id, source_prior_revision_id,
    actor_type, actor_id, correction_reason,
    prior_record_status, next_record_status, reason_code,
    transition_request_hash,
    prior_measurement_definition_key, prior_analyte_key,
    prior_resolver_result, prior_verification_status,
    prior_mapping_confidence_band, prior_input_evidence_hash,
    next_measurement_definition_key, next_analyte_key,
    next_resolver_result, next_verification_status,
    next_mapping_confidence_band, next_input_evidence_hash,
    next_mapping_change_classification, catalog_manifest_version,
    catalog_manifest_digest, resolver_version, normalization_version,
    extraction_version, occurred_at
  )
  values (
    event_kind, 'capture', extracted.profile_id, extracted.document_id,
    new.observation_id, new.extracted_biomarker_id, new.id, prior.id,
    resolved_actor_type,
    case when resolved_actor_type = 'user' then resolved_actor_id else null end,
    new.correction_reason,
    extracted.record_status, extracted.record_status,
    case when new.verification_status = 'auto_verified' then 'automatic_quality_gate' else null end,
    new.writer_request_hash,
    prior.measurement_definition_key, prior.analyte_key,
    prior.resolver_result, prior.verification_status,
    prior.mapping_confidence_band, public.eh121_evidence_hash(prior.input_evidence_hash),
    new.measurement_definition_key, new.analyte_key,
    new.resolver_result, new.verification_status,
    new.mapping_confidence_band, public.eh121_evidence_hash(new.input_evidence_hash),
    new.mapping_change_classification, new.catalog_manifest_version,
    new.catalog_manifest_digest, new.resolver_version, new.normalization_version,
    new.extraction_version, coalesce(new.promoted_at, new.created_at, now())
  )
  on conflict do nothing;
  return null;
end;
$$;

notify pgrst, 'reload schema';

-- Complete a laboratory attempt and supersede its prior source batch in the
-- same transaction. New rows carry the attempt id, so the lifecycle seam only
-- retires the previous batch after completion has validated the replacement.
create or replace function public.eh120_complete_document_processing_attempt(
  p_attempt_id uuid,
  p_document jsonb,
  p_lifecycle_request_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.document_processing_attempts%rowtype;
  document_row public.documents%rowtype;
begin
  if p_lifecycle_request_hash is null
    or p_lifecycle_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_lifecycle_request_hash';
  end if;

  select * into attempt_row
  from public.document_processing_attempts
  where id = p_attempt_id
  for update;
  if attempt_row.id is null then
    raise exception using message = 'processing_attempt_not_found';
  end if;

  select * into document_row
  from public.documents
  where id = attempt_row.document_id
  for update;
  if document_row.id is null then
    raise exception using message = 'document_not_found';
  end if;

  perform public.complete_document_processing_attempt(p_attempt_id, p_document);

  if document_row.document_type = 'lab_result' then
    perform public.eh120_supersede_document_extracted_biomarkers(
      document_row.id,
      document_row.profile_id,
      p_attempt_id,
      p_lifecycle_request_hash
    );
  end if;
end;
$$;

revoke all on function public.eh120_complete_document_processing_attempt(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.eh120_complete_document_processing_attempt(uuid, jsonb, text)
  to service_role;

comment on function public.eh120_complete_document_processing_attempt(uuid, jsonb, text) is
  'EH-120 transactional laboratory completion and source-batch supersession seam.';

notify pgrst, 'reload schema';
