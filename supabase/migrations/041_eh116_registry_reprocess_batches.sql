-- EH-116: safe Registry 2.0 observation reprocessing batches.
--
-- This migration adds an append-only, service-role-only audit store for
-- operator-triggered batch reprocessing. It does not add a second observation
-- or normalization revision writer: apply materialization goes through the
-- existing EH-106 write_observation_normalization_revision_v2 path from the
-- batch service, and the RPCs here only own the batch lifecycle, digest-drift
-- guard, and per-row outcome recording.

-- ── 1. Enum-like domains ─────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'registry_reprocess_batch_state') then
    create type public.registry_reprocess_batch_state as enum (
      'dry_run',
      'apply_in_progress',
      'applied',
      'applied_with_errors',
      'aborted'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'registry_reprocess_scope_kind') then
    create type public.registry_reprocess_scope_kind as enum (
      'document',
      'profile',
      'global'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'registry_reprocess_diff_classification') then
    create type public.registry_reprocess_diff_classification as enum (
      'unchanged',
      'improved_resolution',
      'regressed_resolution',
      'identity_changed',
      'manual_selection_lost',
      'skipped_manual_decision',
      'skipped_manual_correction',
      'needs_review',
      'writer_error'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'registry_reprocess_row_apply_state') then
    create type public.registry_reprocess_row_apply_state as enum (
      'pending',
      'skipped',
      'applied',
      'failed'
    );
  end if;
end;
$$;

-- ── 2. Batch header ──────────────────────────────────────────────────────────

create table if not exists public.registry_reprocess_batches (
  id uuid primary key default gen_random_uuid(),
  scope_kind public.registry_reprocess_scope_kind not null,
  scope_document_id uuid references public.documents(id) on delete restrict,
  scope_profile_id uuid references public.profiles(id) on delete restrict,
  resolver_result_filter text[] not null default array['resolved','partial','ambiguous','unmapped']::text[],
  include_manual_decisions boolean not null default false,
  manual_decision_reason text,
  batch_limit integer not null check (batch_limit > 0 and batch_limit <= 100000),
  max_documents integer check (max_documents is null or max_documents > 0),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_note text,
  catalog_manifest_version text not null,
  catalog_manifest_digest text not null,
  resolver_version text not null,
  normalization_version text not null,
  compatibility_policy_version text not null,
  state public.registry_reprocess_batch_state not null default 'dry_run',
  abort_reason text,
  candidates_total integer not null default 0,
  candidates_unchanged integer not null default 0,
  candidates_improved integer not null default 0,
  candidates_regressed integer not null default 0,
  candidates_identity_changed integer not null default 0,
  candidates_manual_selection_lost integer not null default 0,
  candidates_skipped_manual_decision integer not null default 0,
  candidates_skipped_manual_correction integer not null default 0,
  candidates_needs_review integer not null default 0,
  candidates_writer_error integer not null default 0,
  applied_revisions integer not null default 0,
  writer_errors integer not null default 0,
  requested_at timestamptz not null default now(),
  dry_run_at timestamptz not null default now(),
  applied_at timestamptz,
  aborted_at timestamptz,
  constraint registry_reprocess_batches_scope_check check (
    (scope_kind = 'document' and scope_document_id is not null and scope_profile_id is null)
    or (scope_kind = 'profile' and scope_profile_id is not null and scope_document_id is null)
    or (scope_kind = 'global' and scope_document_id is null and scope_profile_id is null)
  ),
  constraint registry_reprocess_batches_manual_reason_check check (
    include_manual_decisions = false
    or (manual_decision_reason is not null and length(btrim(manual_decision_reason)) > 0)
  ),
  constraint registry_reprocess_batches_resolver_result_filter_check check (
    array_length(resolver_result_filter, 1) is not null
    and array_length(resolver_result_filter, 1) between 1 and 4
    and resolver_result_filter <@ array['resolved','partial','ambiguous','unmapped']::text[]
  ),
  constraint registry_reprocess_batches_catalog_manifest_digest_check
    check (catalog_manifest_digest ~ '^[0-9a-f]{64}$')
);

create index if not exists registry_reprocess_batches_state_idx
  on public.registry_reprocess_batches (state, requested_at desc);
create index if not exists registry_reprocess_batches_actor_idx
  on public.registry_reprocess_batches (actor_id, requested_at desc);
create index if not exists registry_reprocess_batches_digest_idx
  on public.registry_reprocess_batches (catalog_manifest_digest);

alter table public.registry_reprocess_batches enable row level security;

drop policy if exists "service_all_registry_reprocess_batches"
  on public.registry_reprocess_batches;
create policy "service_all_registry_reprocess_batches"
  on public.registry_reprocess_batches
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.registry_reprocess_batches from public, anon, authenticated;
grant select, insert, update on public.registry_reprocess_batches to service_role;

comment on table public.registry_reprocess_batches is
  'EH-116 audit header for a Registry 2.0 observation reprocess batch. Append-only outside the service-only RPCs.';

-- ── 3. Batch rows ────────────────────────────────────────────────────────────

create table if not exists public.registry_reprocess_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.registry_reprocess_batches(id) on delete cascade,
  extracted_biomarker_id uuid not null references public.document_extracted_biomarkers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  prior_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  prior_resolver_result text,
  prior_measurement_definition_key text,
  prior_analyte_key text,
  prior_verification_status text,
  prior_mapping_confidence_band text,
  prior_input_evidence_hash text,
  next_resolver_result text not null,
  next_measurement_definition_key text,
  next_analyte_key text,
  next_mapping_confidence_band text,
  next_input_evidence_hash text not null,
  next_mapping_change_classification text not null,
  next_resolver_decision_trace jsonb not null,
  next_resolver_trace_schema_version text not null,
  diff_classification public.registry_reprocess_diff_classification not null,
  diff_reason_code text not null,
  apply_state public.registry_reprocess_row_apply_state not null default 'pending',
  applied_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  writer_error_code text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint registry_reprocess_batch_rows_batch_extracted_unique
    unique (batch_id, extracted_biomarker_id),
  constraint registry_reprocess_batch_rows_next_input_evidence_hash_check
    check (next_input_evidence_hash ~ '^[0-9a-f]{64}$'),
  constraint registry_reprocess_batch_rows_prior_input_evidence_hash_check
    check (prior_input_evidence_hash is null or prior_input_evidence_hash ~ '^[0-9a-f]{64}$'),
  constraint registry_reprocess_batch_rows_next_resolver_result_check
    check (next_resolver_result in ('resolved','partial','ambiguous','unmapped')),
  constraint registry_reprocess_batch_rows_prior_resolver_result_check
    check (prior_resolver_result is null or prior_resolver_result in ('resolved','partial','ambiguous','unmapped')),
  constraint registry_reprocess_batch_rows_prior_verification_status_check
    check (prior_verification_status is null
      or prior_verification_status in ('pending','auto_verified','user_verified','manually_corrected')),
  constraint registry_reprocess_batch_rows_apply_outcome_check
    check (
      (apply_state = 'applied' and applied_revision_id is not null and writer_error_code is null)
      or (apply_state = 'failed' and writer_error_code is not null)
      or (apply_state in ('pending','skipped'))
    )
);

create index if not exists registry_reprocess_batch_rows_batch_idx
  on public.registry_reprocess_batch_rows (batch_id, diff_classification, apply_state);
create index if not exists registry_reprocess_batch_rows_extracted_idx
  on public.registry_reprocess_batch_rows (extracted_biomarker_id, created_at desc);
create index if not exists registry_reprocess_batch_rows_profile_idx
  on public.registry_reprocess_batch_rows (profile_id, document_id);

alter table public.registry_reprocess_batch_rows enable row level security;

drop policy if exists "service_all_registry_reprocess_batch_rows"
  on public.registry_reprocess_batch_rows;
create policy "service_all_registry_reprocess_batch_rows"
  on public.registry_reprocess_batch_rows
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.registry_reprocess_batch_rows from public, anon, authenticated;
grant select, insert, update on public.registry_reprocess_batch_rows to service_role;

comment on table public.registry_reprocess_batch_rows is
  'EH-116 append-only per-row candidate diff for a reprocess batch. Rows are materialized into observation_normalization_revisions only on apply through the EH-106 writer.';

-- ── 4. Append-only trigger ───────────────────────────────────────────────────

create or replace function public.eh116_reject_direct_batch_row_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    -- ON DELETE CASCADE from the parent batch header is allowed. Direct DELETE
    -- is rejected via a session flag that only the service RPCs set inside
    -- their controlled paths (there is currently no such path — direct DELETE
    -- of a row is never allowed).
    if current_setting('easyhealth.eh116_allow_batch_row_delete', true) = 'on' then
      return old;
    end if;
    raise exception using message = 'registry_reprocess_batch_rows_append_only';
  end if;

  if TG_OP = 'UPDATE' then
    -- Only the apply-outcome columns may change, and only from state 'pending'.
    if old.apply_state <> 'pending' then
      raise exception using message = 'registry_reprocess_batch_row_outcome_locked';
    end if;

    if new.batch_id is distinct from old.batch_id
      or new.extracted_biomarker_id is distinct from old.extracted_biomarker_id
      or new.profile_id is distinct from old.profile_id
      or new.document_id is distinct from old.document_id
      or new.prior_revision_id is distinct from old.prior_revision_id
      or new.prior_resolver_result is distinct from old.prior_resolver_result
      or new.prior_measurement_definition_key is distinct from old.prior_measurement_definition_key
      or new.prior_analyte_key is distinct from old.prior_analyte_key
      or new.prior_verification_status is distinct from old.prior_verification_status
      or new.prior_mapping_confidence_band is distinct from old.prior_mapping_confidence_band
      or new.prior_input_evidence_hash is distinct from old.prior_input_evidence_hash
      or new.next_resolver_result is distinct from old.next_resolver_result
      or new.next_measurement_definition_key is distinct from old.next_measurement_definition_key
      or new.next_analyte_key is distinct from old.next_analyte_key
      or new.next_mapping_confidence_band is distinct from old.next_mapping_confidence_band
      or new.next_input_evidence_hash is distinct from old.next_input_evidence_hash
      or new.next_mapping_change_classification is distinct from old.next_mapping_change_classification
      or new.next_resolver_decision_trace is distinct from old.next_resolver_decision_trace
      or new.next_resolver_trace_schema_version is distinct from old.next_resolver_trace_schema_version
      or new.diff_classification is distinct from old.diff_classification
      or new.diff_reason_code is distinct from old.diff_reason_code
      or new.created_at is distinct from old.created_at then
      raise exception using message = 'registry_reprocess_batch_row_immutable_columns';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists eh116_registry_reprocess_batch_rows_append_only
  on public.registry_reprocess_batch_rows;

create trigger eh116_registry_reprocess_batch_rows_append_only
before update or delete on public.registry_reprocess_batch_rows
for each row
execute function public.eh116_reject_direct_batch_row_mutation();

comment on function public.eh116_reject_direct_batch_row_mutation() is
  'EH-116 append-only guard: batch rows may only be updated to record apply outcome and cannot be direct-deleted.';

-- ── 5. Service-only RPCs ─────────────────────────────────────────────────────

create or replace function public.registry_reprocess_open_batch(
  p_scope_kind text,
  p_scope_document_id uuid,
  p_scope_profile_id uuid,
  p_resolver_result_filter text[],
  p_include_manual_decisions boolean,
  p_manual_decision_reason text,
  p_batch_limit integer,
  p_max_documents integer,
  p_actor_id uuid,
  p_actor_note text,
  p_catalog_manifest_version text,
  p_catalog_manifest_digest text,
  p_resolver_version text,
  p_normalization_version text,
  p_compatibility_policy_version text
)
returns public.registry_reprocess_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  batch public.registry_reprocess_batches;
begin
  if p_scope_kind not in ('document','profile','global') then
    raise exception using message = 'invalid_scope_kind';
  end if;

  insert into public.registry_reprocess_batches (
    scope_kind,
    scope_document_id,
    scope_profile_id,
    resolver_result_filter,
    include_manual_decisions,
    manual_decision_reason,
    batch_limit,
    max_documents,
    actor_id,
    actor_note,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    compatibility_policy_version
  )
  values (
    p_scope_kind::public.registry_reprocess_scope_kind,
    p_scope_document_id,
    p_scope_profile_id,
    coalesce(p_resolver_result_filter, array['resolved','partial','ambiguous','unmapped']::text[]),
    coalesce(p_include_manual_decisions, false),
    p_manual_decision_reason,
    p_batch_limit,
    p_max_documents,
    p_actor_id,
    p_actor_note,
    p_catalog_manifest_version,
    p_catalog_manifest_digest,
    p_resolver_version,
    p_normalization_version,
    p_compatibility_policy_version
  )
  returning * into batch;

  return batch;
end;
$$;

comment on function public.registry_reprocess_open_batch(
  text, uuid, uuid, text[], boolean, text, integer, integer, uuid, text, text, text, text, text, text
) is
  'EH-116 service-only: open a new reprocess batch with a bound deployed release digest.';

create or replace function public.registry_reprocess_record_row(
  p_batch_id uuid,
  p_extracted_biomarker_id uuid,
  p_profile_id uuid,
  p_document_id uuid,
  p_prior_revision_id uuid,
  p_prior_resolver_result text,
  p_prior_measurement_definition_key text,
  p_prior_analyte_key text,
  p_prior_verification_status text,
  p_prior_mapping_confidence_band text,
  p_prior_input_evidence_hash text,
  p_next_resolver_result text,
  p_next_measurement_definition_key text,
  p_next_analyte_key text,
  p_next_mapping_confidence_band text,
  p_next_input_evidence_hash text,
  p_next_mapping_change_classification text,
  p_next_resolver_decision_trace jsonb,
  p_next_resolver_trace_schema_version text,
  p_diff_classification text,
  p_diff_reason_code text
)
returns public.registry_reprocess_batch_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  batch public.registry_reprocess_batches;
  row public.registry_reprocess_batch_rows;
begin
  select * into batch from public.registry_reprocess_batches where id = p_batch_id for update;
  if batch.id is null then
    raise exception using message = 'batch_not_found';
  end if;
  if batch.state <> 'dry_run' then
    raise exception using message = 'batch_not_open_for_row_recording';
  end if;

  insert into public.registry_reprocess_batch_rows (
    batch_id,
    extracted_biomarker_id,
    profile_id,
    document_id,
    prior_revision_id,
    prior_resolver_result,
    prior_measurement_definition_key,
    prior_analyte_key,
    prior_verification_status,
    prior_mapping_confidence_band,
    prior_input_evidence_hash,
    next_resolver_result,
    next_measurement_definition_key,
    next_analyte_key,
    next_mapping_confidence_band,
    next_input_evidence_hash,
    next_mapping_change_classification,
    next_resolver_decision_trace,
    next_resolver_trace_schema_version,
    diff_classification,
    diff_reason_code,
    apply_state
  )
  values (
    p_batch_id,
    p_extracted_biomarker_id,
    p_profile_id,
    p_document_id,
    p_prior_revision_id,
    p_prior_resolver_result,
    p_prior_measurement_definition_key,
    p_prior_analyte_key,
    p_prior_verification_status,
    p_prior_mapping_confidence_band,
    p_prior_input_evidence_hash,
    p_next_resolver_result,
    p_next_measurement_definition_key,
    p_next_analyte_key,
    p_next_mapping_confidence_band,
    p_next_input_evidence_hash,
    p_next_mapping_change_classification,
    p_next_resolver_decision_trace,
    p_next_resolver_trace_schema_version,
    p_diff_classification::public.registry_reprocess_diff_classification,
    p_diff_reason_code,
    case
      when p_diff_classification in ('unchanged','skipped_manual_decision','skipped_manual_correction','needs_review','regressed_resolution','writer_error')
        then 'skipped'::public.registry_reprocess_row_apply_state
      else 'pending'::public.registry_reprocess_row_apply_state
    end
  )
  returning * into row;

  update public.registry_reprocess_batches
  set candidates_total = candidates_total + 1,
      candidates_unchanged = candidates_unchanged + (case when p_diff_classification = 'unchanged' then 1 else 0 end),
      candidates_improved = candidates_improved + (case when p_diff_classification = 'improved_resolution' then 1 else 0 end),
      candidates_regressed = candidates_regressed + (case when p_diff_classification = 'regressed_resolution' then 1 else 0 end),
      candidates_identity_changed = candidates_identity_changed + (case when p_diff_classification = 'identity_changed' then 1 else 0 end),
      candidates_manual_selection_lost = candidates_manual_selection_lost + (case when p_diff_classification = 'manual_selection_lost' then 1 else 0 end),
      candidates_skipped_manual_decision = candidates_skipped_manual_decision + (case when p_diff_classification = 'skipped_manual_decision' then 1 else 0 end),
      candidates_skipped_manual_correction = candidates_skipped_manual_correction + (case when p_diff_classification = 'skipped_manual_correction' then 1 else 0 end),
      candidates_needs_review = candidates_needs_review + (case when p_diff_classification = 'needs_review' then 1 else 0 end),
      candidates_writer_error = candidates_writer_error + (case when p_diff_classification = 'writer_error' then 1 else 0 end)
  where id = p_batch_id;

  return row;
end;
$$;

comment on function public.registry_reprocess_record_row(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, text, text
) is
  'EH-116 service-only: append a candidate diff row to a batch in state dry_run.';

-- The previous signature returned SETOF rows and signalled digest drift with
-- RAISE. That was wrong: RAISE rolls back the very UPDATE that records the
-- abort, so a drifted batch stayed in `dry_run` with no audit record. The
-- function now returns jsonb and reports drift as data, so the abort commits.
drop function if exists public.registry_reprocess_apply_batch(uuid, text, uuid);

create function public.registry_reprocess_apply_batch(
  p_batch_id uuid,
  p_current_catalog_manifest_digest text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch public.registry_reprocess_batches;
  pending jsonb;
begin
  select * into batch from public.registry_reprocess_batches where id = p_batch_id for update;
  if batch.id is null then
    raise exception using message = 'batch_not_found';
  end if;

  if batch.state in ('applied', 'applied_with_errors', 'aborted') then
    -- Idempotent no-op: caller reads the recorded outcome from the header.
    return jsonb_build_object('status', batch.state::text, 'rows', '[]'::jsonb);
  end if;

  if batch.state not in ('dry_run', 'apply_in_progress') then
    raise exception using message = 'batch_not_open_for_apply';
  end if;

  if coalesce(btrim(p_current_catalog_manifest_digest), '') = '' then
    raise exception using message = 'invalid_current_catalog_manifest_digest';
  end if;

  -- Digest drift is returned, never raised: the abort must be durable.
  if batch.catalog_manifest_digest is distinct from p_current_catalog_manifest_digest then
    update public.registry_reprocess_batches
    set state = 'aborted',
        abort_reason = 'catalog_manifest_drift',
        aborted_at = now()
    where id = p_batch_id;
    return jsonb_build_object('status', 'catalog_manifest_drift', 'rows', '[]'::jsonb);
  end if;

  update public.registry_reprocess_batches
  set state = 'apply_in_progress'
  where id = p_batch_id
    and state = 'dry_run';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'row_id', r.id,
        'extracted_biomarker_id', r.extracted_biomarker_id,
        'diff_classification', r.diff_classification::text,
        'diff_reason_code', r.diff_reason_code
      )
      order by r.created_at asc, r.id asc
    ),
    '[]'::jsonb
  )
  into pending
  from public.registry_reprocess_batch_rows r
  where r.batch_id = p_batch_id
    and r.apply_state = 'pending';

  return jsonb_build_object('status', 'ok', 'rows', pending);
end;
$$;

comment on function public.registry_reprocess_apply_batch(uuid, text, uuid) is
  'EH-116 service-only: after a digest match, move the batch to apply_in_progress and return {status, rows} for materialization. Digest drift is persisted as an aborted batch and reported in status, never raised.';

create or replace function public.registry_reprocess_finish_row(
  p_row_id uuid,
  p_applied_revision_id uuid,
  p_writer_error_code text
)
returns public.registry_reprocess_batch_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.registry_reprocess_batch_rows;
begin
  select * into target from public.registry_reprocess_batch_rows where id = p_row_id for update;
  if target.id is null then
    raise exception using message = 'batch_row_not_found';
  end if;
  if target.apply_state <> 'pending' then
    raise exception using message = 'batch_row_outcome_locked';
  end if;

  if p_writer_error_code is not null then
    update public.registry_reprocess_batch_rows
    set apply_state = 'failed',
        writer_error_code = p_writer_error_code,
        applied_at = now()
    where id = p_row_id
    returning * into target;

    update public.registry_reprocess_batches
    set writer_errors = writer_errors + 1
    where id = target.batch_id;
  else
    if p_applied_revision_id is null then
      raise exception using message = 'missing_applied_revision_id';
    end if;

    update public.registry_reprocess_batch_rows
    set apply_state = 'applied',
        applied_revision_id = p_applied_revision_id,
        applied_at = now()
    where id = p_row_id
    returning * into target;

    update public.registry_reprocess_batches
    set applied_revisions = applied_revisions + 1
    where id = target.batch_id;
  end if;

  return target;
end;
$$;

comment on function public.registry_reprocess_finish_row(uuid, uuid, text) is
  'EH-116 service-only: record the writer outcome for one batch row.';

create or replace function public.registry_reprocess_finish_batch(
  p_batch_id uuid
)
returns public.registry_reprocess_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  batch public.registry_reprocess_batches;
begin
  select * into batch from public.registry_reprocess_batches where id = p_batch_id for update;
  if batch.id is null then
    raise exception using message = 'batch_not_found';
  end if;

  if batch.state in ('applied','applied_with_errors','aborted') then
    return batch;
  end if;

  if exists (
    select 1
    from public.registry_reprocess_batch_rows
    where batch_id = p_batch_id
      and apply_state = 'pending'
  ) then
    raise exception using message = 'batch_has_pending_rows';
  end if;

  update public.registry_reprocess_batches
  set state = case when writer_errors > 0 then 'applied_with_errors'::public.registry_reprocess_batch_state
                   else 'applied'::public.registry_reprocess_batch_state end,
      applied_at = now()
  where id = p_batch_id
  returning * into batch;

  return batch;
end;
$$;

comment on function public.registry_reprocess_finish_batch(uuid) is
  'EH-116 service-only: seal the batch after every row has an outcome.';

-- ── 6. Grants ────────────────────────────────────────────────────────────────

revoke all on function public.registry_reprocess_open_batch(
  text, uuid, uuid, text[], boolean, text, integer, integer, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.registry_reprocess_open_batch(
  text, uuid, uuid, text[], boolean, text, integer, integer, uuid, text, text, text, text, text, text
) to service_role;

revoke all on function public.registry_reprocess_record_row(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.registry_reprocess_record_row(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, text, text
) to service_role;

revoke all on function public.registry_reprocess_apply_batch(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.registry_reprocess_apply_batch(uuid, text, uuid)
  to service_role;

revoke all on function public.registry_reprocess_finish_row(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.registry_reprocess_finish_row(uuid, uuid, text)
  to service_role;

revoke all on function public.registry_reprocess_finish_batch(uuid)
  from public, anon, authenticated;
grant execute on function public.registry_reprocess_finish_batch(uuid)
  to service_role;
