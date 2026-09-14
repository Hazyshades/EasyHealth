-- EH-248 Change A: prepared Resolver evidence identity, reprocess decision facts,
-- and explicit historical restoration.
--
-- Legacy revisions keep their existing input_evidence_hash and a NULL identity
-- format version. Service writes with a request hash and a valid canonical
-- identity receive format version 1; this migration never rewrites history.

alter table public.observation_normalization_revisions
  add column if not exists input_identity_format_version text;

alter table public.observation_normalization_revisions
  alter column input_identity_format_version drop default;

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_input_identity_format_version_check;
alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_input_identity_format_version_check
  check (
    input_identity_format_version is null
    or input_identity_format_version = '1'
  );

alter table public.observation_normalization_revisions
  drop constraint if exists observation_normalization_revisions_input_evidence_hash_v1_check;
alter table public.observation_normalization_revisions
  add constraint observation_normalization_revisions_input_evidence_hash_v1_check
  check (
    input_identity_format_version is null
    or input_evidence_hash ~ '^[0-9a-f]{64}$'
  );

create or replace function public.eh248_validate_revision_input_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  restored_identity_format_version text;
begin
  -- Direct legacy fixtures and pre-EH-248 rows retain a NULL version. Service
  -- writers identify themselves with writer_request_hash and receive v1 when
  -- they supply a valid canonical hash.
  if new.input_identity_format_version is null then
    if new.reversal_of_revision_id is not null then
      select input_identity_format_version
      into restored_identity_format_version
      from public.observation_normalization_revisions
      where id = new.reversal_of_revision_id;
      new.input_identity_format_version := restored_identity_format_version;
      return new;
    end if;
    if new.writer_request_hash is null then
      return new;
    end if;
    if new.input_evidence_hash is null
      or new.input_evidence_hash !~ '^[0-9a-f]{64}$' then
      raise exception using message = 'invalid_input_evidence_hash';
    end if;
    new.input_identity_format_version := '1';
    return new;
  end if;
  if new.input_identity_format_version <> '1' then
    raise exception using message = 'invalid_input_identity_format_version';
  end if;
  if new.input_evidence_hash is null
    or new.input_evidence_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_input_evidence_hash';
  end if;
  return new;
end;
$$;

drop trigger if exists eh248_validate_revision_input_identity
  on public.observation_normalization_revisions;
create trigger eh248_validate_revision_input_identity
before insert on public.observation_normalization_revisions
for each row
execute function public.eh248_validate_revision_input_identity();

comment on column public.observation_normalization_revisions.input_identity_format_version is
  'EH-248 prepared-evidence identity format. NULL is retained for legacy revisions and direct fixtures; service writes with a canonical hash use v1.';

-- ── Reprocess facts ──────────────────────────────────────────────────────────
-- The existing EH-116 row is preserved. These columns make input, outcome and
-- release comparisons independently auditable, and keep create/activate
-- decisions explicit rather than deriving them from one classification string.

alter table public.registry_reprocess_batch_rows
  add column if not exists prior_input_identity_format_version text,
  add column if not exists next_input_identity_format_version text,
  add column if not exists input_change text,
  add column if not exists outcome_change text,
  add column if not exists release_change text,
  add column if not exists create_revision boolean,
  add column if not exists activate_revision boolean,
  add column if not exists reprocess_change_facts jsonb;

alter table public.registry_reprocess_batch_rows
  drop constraint if exists registry_reprocess_batch_rows_prior_input_identity_format_version_check;
alter table public.registry_reprocess_batch_rows
  add constraint registry_reprocess_batch_rows_prior_input_identity_format_version_check
  check (
    prior_input_identity_format_version is null
    or prior_input_identity_format_version = '1'
  );

alter table public.registry_reprocess_batch_rows
  drop constraint if exists registry_reprocess_batch_rows_next_input_identity_format_version_check;
alter table public.registry_reprocess_batch_rows
  add constraint registry_reprocess_batch_rows_next_input_identity_format_version_check
  check (next_input_identity_format_version is null or next_input_identity_format_version = '1');

alter table public.registry_reprocess_batch_rows
  drop constraint if exists registry_reprocess_batch_rows_input_change_check;
alter table public.registry_reprocess_batch_rows
  add constraint registry_reprocess_batch_rows_input_change_check
  check (input_change is null or input_change in ('changed', 'unchanged', 'unavailable'));

alter table public.registry_reprocess_batch_rows
  drop constraint if exists registry_reprocess_batch_rows_outcome_change_check;
alter table public.registry_reprocess_batch_rows
  add constraint registry_reprocess_batch_rows_outcome_change_check
  check (outcome_change is null or outcome_change in ('changed', 'unchanged'));

alter table public.registry_reprocess_batch_rows
  drop constraint if exists registry_reprocess_batch_rows_release_change_check;
alter table public.registry_reprocess_batch_rows
  add constraint registry_reprocess_batch_rows_release_change_check
  check (release_change is null or release_change in ('changed', 'unchanged', 'unavailable'));

alter table public.registry_reprocess_batch_rows
  drop constraint if exists registry_reprocess_batch_rows_reprocess_change_facts_check;
alter table public.registry_reprocess_batch_rows
  add constraint registry_reprocess_batch_rows_reprocess_change_facts_check
  check (reprocess_change_facts is null or jsonb_typeof(reprocess_change_facts) = 'object');

create index if not exists registry_reprocess_batch_rows_change_facts_idx
  on public.registry_reprocess_batch_rows (batch_id, input_change, outcome_change, release_change);

create or replace function public.eh248_reject_reprocess_fact_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.prior_input_identity_format_version is distinct from old.prior_input_identity_format_version
    or new.next_input_identity_format_version is distinct from old.next_input_identity_format_version
    or new.input_change is distinct from old.input_change
    or new.outcome_change is distinct from old.outcome_change
    or new.release_change is distinct from old.release_change
    or new.create_revision is distinct from old.create_revision
    or new.activate_revision is distinct from old.activate_revision
    or new.reprocess_change_facts is distinct from old.reprocess_change_facts then
    raise exception using message = 'registry_reprocess_batch_row_immutable_columns';
  end if;
  return new;
end;
$$;

drop trigger if exists eh248_reprocess_fact_immutability
  on public.registry_reprocess_batch_rows;
create trigger eh248_reprocess_fact_immutability
before update on public.registry_reprocess_batch_rows
for each row
execute function public.eh248_reject_reprocess_fact_mutation();

-- New application callers use this v2 recorder. The EH-116 recorder remains
-- available for historical SQL fixtures and writes NULL facts rather than
-- inventing comparisons for rows recorded before EH-248.
create function public.registry_reprocess_record_row_v2(
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
  p_prior_input_identity_format_version text,
  p_next_resolver_result text,
  p_next_measurement_definition_key text,
  p_next_analyte_key text,
  p_next_mapping_confidence_band text,
  p_next_input_evidence_hash text,
  p_next_input_identity_format_version text,
  p_next_mapping_change_classification text,
  p_next_resolver_decision_trace jsonb,
  p_next_resolver_trace_schema_version text,
  p_diff_classification text,
  p_diff_reason_code text,
  p_reprocess_facts jsonb
)
returns public.registry_reprocess_batch_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  batch public.registry_reprocess_batches;
  row public.registry_reprocess_batch_rows;
  input_change_value text;
  outcome_change_value text;
  release_change_value text;
  create_revision_value boolean;
  activate_revision_value boolean;
begin
  select * into batch
  from public.registry_reprocess_batches
  where id = p_batch_id
  for update;
  if batch.id is null then
    raise exception using message = 'batch_not_found';
  end if;
  if batch.state <> 'dry_run' then
    raise exception using message = 'batch_not_open_for_row_recording';
  end if;

  if jsonb_typeof(p_reprocess_facts) is distinct from 'object' then
    raise exception using message = 'invalid_reprocess_change_facts';
  end if;
  input_change_value := nullif(btrim(p_reprocess_facts ->> 'inputChange'), '');
  outcome_change_value := nullif(btrim(p_reprocess_facts ->> 'outcomeChange'), '');
  release_change_value := nullif(btrim(p_reprocess_facts ->> 'releaseChange'), '');
  if jsonb_typeof(p_reprocess_facts -> 'createRevision') is distinct from 'boolean'
    or jsonb_typeof(p_reprocess_facts -> 'activateRevision') is distinct from 'boolean' then
    raise exception using message = 'invalid_reprocess_change_facts';
  end if;
  create_revision_value := (p_reprocess_facts ->> 'createRevision')::boolean;
  activate_revision_value := (p_reprocess_facts ->> 'activateRevision')::boolean;

  if input_change_value is null
    or input_change_value not in ('changed', 'unchanged', 'unavailable')
    or outcome_change_value is null
    or outcome_change_value not in ('changed', 'unchanged')
    or release_change_value is null
    or release_change_value not in ('changed', 'unchanged', 'unavailable')
    or p_next_input_identity_format_version is distinct from '1'
    or (activate_revision_value and not create_revision_value)
    or (
      activate_revision_value
      and not (
        p_diff_classification in ('improved_resolution', 'identity_changed', 'manual_selection_lost')
        or (
          p_diff_classification = 'unchanged'
          and input_change_value = 'unchanged'
          and outcome_change_value = 'unchanged'
          and release_change_value = 'changed'
        )
      )
    ) then
    raise exception using message = 'invalid_reprocess_change_facts';
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
    prior_input_identity_format_version,
    next_resolver_result,
    next_measurement_definition_key,
    next_analyte_key,
    next_mapping_confidence_band,
    next_input_evidence_hash,
    next_input_identity_format_version,
    next_mapping_change_classification,
    next_resolver_decision_trace,
    next_resolver_trace_schema_version,
    diff_classification,
    diff_reason_code,
    input_change,
    outcome_change,
    release_change,
    create_revision,
    activate_revision,
    reprocess_change_facts,
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
    p_prior_input_identity_format_version,
    p_next_resolver_result,
    p_next_measurement_definition_key,
    p_next_analyte_key,
    p_next_mapping_confidence_band,
    p_next_input_evidence_hash,
    p_next_input_identity_format_version,
    p_next_mapping_change_classification,
    p_next_resolver_decision_trace,
    p_next_resolver_trace_schema_version,
    p_diff_classification::public.registry_reprocess_diff_classification,
    p_diff_reason_code,
    input_change_value,
    outcome_change_value,
    release_change_value,
    create_revision_value,
    activate_revision_value,
    p_reprocess_facts,
    case when activate_revision_value
      then 'pending'::public.registry_reprocess_row_apply_state
      else 'skipped'::public.registry_reprocess_row_apply_state
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

revoke all on function public.registry_reprocess_record_row_v2(
  uuid, uuid, uuid, uuid, uuid,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  jsonb, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.registry_reprocess_record_row_v2(
  uuid, uuid, uuid, uuid, uuid,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  jsonb, text, text, text, jsonb
) to service_role;

comment on function public.registry_reprocess_record_row_v2(
  uuid, uuid, uuid, uuid, uuid,
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text,
  jsonb, text, text, text, jsonb
) is
  'EH-248 service-only reprocess recorder: independently records input, outcome and release facts plus explicit create/activate decisions.';

-- ── Explicit historical restoration ──────────────────────────────────────────
-- This path copies the selected historical decision and uses the existing
-- atomic promotion primitive. It never invokes the current Resolver, admission
-- policy, or panel matcher.

create function public.restore_observation_normalization_revision_v1(
  p_extracted_biomarker_id uuid,
  p_target_revision_id uuid,
  p_expected_active_revision_id uuid,
  p_actor_id uuid,
  p_correction_reason text,
  p_request_hash text,
  p_observation_payload jsonb
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
  extracted public.document_extracted_biomarkers;
  target public.observation_normalization_revisions;
  active_revision public.observation_normalization_revisions;
  successor public.observation_normalization_revisions;
  promoted public.observation_normalization_revisions;
  target_observation public.observations;
  existing_successor public.observation_normalization_revisions;
begin
  if p_actor_id is null then
    raise exception using message = 'normalization_writer_actor_required';
  end if;
  if coalesce(btrim(p_correction_reason), '') = '' then
    raise exception using message = 'historical_restore_requires_reason';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_normalization_writer_request_hash';
  end if;
  if jsonb_typeof(p_observation_payload) is distinct from 'object' then
    raise exception using message = 'invalid_normalization_writer_payload';
  end if;

  select * into target
  from public.observation_normalization_revisions
  where id = p_target_revision_id;
  if target.id is null
    or target.extracted_biomarker_id is distinct from p_extracted_biomarker_id then
    raise exception using message = 'historical_restore_revision_source_mismatch';
  end if;

  select * into extracted
  from public.document_extracted_biomarkers
  where id = p_extracted_biomarker_id
  for update;
  if extracted.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;

  select * into existing_successor
  from public.observation_normalization_revisions
  where extracted_biomarker_id = extracted.id
    and writer_request_hash = p_request_hash
  for update;
  if existing_successor.id is not null then
    if existing_successor.reversal_of_revision_id is distinct from target.id then
      raise exception using message = 'historical_restore_request_conflict';
    end if;
    return query select
      existing_successor.observation_id,
      existing_successor.id,
      existing_successor.verification_status,
      existing_successor.resolver_result,
      true;
    return;
  end if;

  select * into active_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = extracted.id
    and is_active
  for update;
  if active_revision.id is distinct from p_expected_active_revision_id then
    raise exception using message = 'stale_revision_conflict';
  end if;
  if target.is_active then
    raise exception using message = 'historical_restore_target_active';
  end if;
  if target.input_evidence_hash is null
    or target.input_evidence_hash !~ '^[0-9a-f]{64}$'
    or target.resolver_result is null
    or target.mapping_confidence is null
    or target.mapping_confidence_band is null
    or target.resolver_evidence is null
    or target.resolver_decision_trace is null
    or target.catalog_manifest_version is null
    or target.catalog_manifest_digest is null
    or target.resolver_version is null
    or target.normalization_version is null then
    raise exception using message = 'historical_restore_missing_decision';
  end if;

  select * into target_observation
  from public.observations
  where source_extracted_biomarker_id = extracted.id
  order by created_at asc
  limit 1
  for update;
  if target_observation.id is null then
    raise exception using message = 'observation_not_found';
  end if;
  if (p_observation_payload ->> 'profile_id')::uuid is distinct from extracted.profile_id
    or (p_observation_payload ->> 'document_id')::uuid is distinct from extracted.document_id then
    raise exception using message = 'observation_source_owner_mismatch';
  end if;
  if target.observation_id is not null
    and target.observation_id is distinct from target_observation.id then
    raise exception using message = 'revision_observation_binding_conflict';
  end if;

  insert into public.observation_normalization_revisions (
    extracted_biomarker_id,
    input_evidence_hash,
    input_identity_format_version,
    measurement_definition_key,
    analyte_key,
    resolver_result,
    mapping_confidence,
    mapping_confidence_band,
    resolver_evidence,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    extraction_version,
    verification_status,
    verification_decided_at,
    verification_actor_type,
    verification_actor_id,
    mapping_change_classification,
    created_by,
    correction_reason,
    reversal_of_revision_id,
    supersedes_revision_id,
    writer_request_hash,
    resolver_decision_trace,
    resolver_trace_schema_version,
    measurement_override
  ) values (
    extracted.id,
    target.input_evidence_hash,
    target.input_identity_format_version,
    target.measurement_definition_key,
    target.analyte_key,
    target.resolver_result,
    target.mapping_confidence,
    target.mapping_confidence_band,
    target.resolver_evidence,
    target.catalog_manifest_version,
    target.catalog_manifest_digest,
    target.resolver_version,
    target.normalization_version,
    target.extraction_version,
    target.verification_status,
    case when target.verification_status = 'pending' then null else now() end,
    case
      when target.verification_status = 'pending' then null
      when target.verification_status = 'auto_verified' then 'system'
      else 'user'
    end,
    case
      when target.verification_status in ('pending', 'auto_verified') then null
      else p_actor_id
    end,
    target.mapping_change_classification,
    p_actor_id,
    p_correction_reason,
    target.id,
    active_revision.id,
    p_request_hash,
    target.resolver_decision_trace,
    target.resolver_trace_schema_version,
    target.measurement_override
  )
  returning * into successor;

  select * into promoted
  from public.promote_observation_normalization_revision_v2(
    successor.id,
    target_observation.id,
    active_revision.id,
    p_actor_id,
    p_observation_payload
  );

  update public.document_extracted_biomarkers
  set status = case when target.verification_status = 'pending' then 'needs_review' else 'accepted' end,
      analyte_key = target.analyte_key,
      measurement_definition_key = target.measurement_definition_key,
      resolver_result = target.resolver_result,
      resolution_status = target.resolver_result,
      mapping_confidence = target.mapping_confidence,
      mapping_confidence_band = target.mapping_confidence_band,
      resolver_evidence = target.resolver_evidence,
      catalog_manifest_version = target.catalog_manifest_version,
      catalog_manifest_digest = target.catalog_manifest_digest,
      resolver_version = target.resolver_version,
      normalization_version = target.normalization_version,
      verification_status = target.verification_status
  where id = extracted.id;

  return query select
    promoted.observation_id,
    promoted.id,
    promoted.verification_status,
    promoted.resolver_result,
    false;
end;
$$;

revoke all on function public.restore_observation_normalization_revision_v1(
  uuid, uuid, uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.restore_observation_normalization_revision_v1(
  uuid, uuid, uuid, uuid, text, text, jsonb
) to service_role;

comment on function public.restore_observation_normalization_revision_v1(
  uuid, uuid, uuid, uuid, text, text, jsonb
) is
  'EH-248 service-only historical restore: copy a selected revision, preserve its stored decision, and promote through the atomic projection boundary without current Resolver admission.';

-- EH-122's verification undo keeps its existing pending transition, but the
-- successor now copies every saved Change A decision field. It remains a
-- dedicated historical operation and never evaluates current evidence.
create or replace function public.eh122_reverse_observation_normalization_verification(
  p_batch_revision_id uuid,
  p_actor_id uuid,
  p_correction_reason text,
  p_request_hash text
)
returns table (
  observation_id uuid,
  revision_id uuid,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prior public.observation_normalization_revisions;
  successor public.observation_normalization_revisions;
  promoted public.observation_normalization_revisions;
  extracted public.document_extracted_biomarkers;
begin
  if p_actor_id is null then
    raise exception using message = 'normalization_writer_actor_required';
  end if;
  if coalesce(btrim(p_correction_reason), '') = '' then
    raise exception using message = 'verification_reversal_requires_reason';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_normalization_writer_request_hash';
  end if;

  select * into prior
  from public.observation_normalization_revisions
  where id = p_batch_revision_id
  for update;
  if prior.id is null then
    raise exception using message = 'batch_verification_revision_not_found';
  end if;
  if not prior.is_active or prior.observation_id is null then
    raise exception using message = 'batch_verification_revision_not_active';
  end if;
  if prior.verification_status <> 'user_verified' then
    raise exception using message = 'batch_verification_revision_not_reversible';
  end if;
  if prior.input_evidence_hash is null
    or prior.input_evidence_hash !~ '^[0-9a-f]{64}$'
    or prior.resolver_evidence is null
    or prior.resolver_decision_trace is null
    or prior.catalog_manifest_version is null
    or prior.catalog_manifest_digest is null
    or prior.resolver_version is null
    or prior.normalization_version is null then
    raise exception using message = 'batch_verification_revision_not_reversible';
  end if;

  select * into successor
  from public.observation_normalization_revisions
  where extracted_biomarker_id = prior.extracted_biomarker_id
    and writer_request_hash = p_request_hash;
  if successor.id is not null then
    if successor.reversal_of_revision_id is distinct from prior.id then
      raise exception using message = 'verification_reversal_request_conflict';
    end if;
    return query select successor.observation_id, successor.id, true;
    return;
  end if;

  select * into extracted
  from public.document_extracted_biomarkers
  where id = prior.extracted_biomarker_id
  for update;
  if extracted.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;

  insert into public.observation_normalization_revisions (
    extracted_biomarker_id,
    input_evidence_hash,
    input_identity_format_version,
    measurement_definition_key,
    analyte_key,
    resolver_result,
    mapping_confidence,
    mapping_confidence_band,
    resolver_evidence,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    extraction_version,
    verification_status,
    verification_decided_at,
    verification_actor_type,
    verification_actor_id,
    mapping_change_classification,
    created_by,
    correction_reason,
    reversal_of_revision_id,
    supersedes_revision_id,
    writer_request_hash,
    resolver_decision_trace,
    resolver_trace_schema_version,
    measurement_override
  ) values (
    prior.extracted_biomarker_id,
    prior.input_evidence_hash,
    prior.input_identity_format_version,
    prior.measurement_definition_key,
    prior.analyte_key,
    prior.resolver_result,
    prior.mapping_confidence,
    prior.mapping_confidence_band,
    prior.resolver_evidence,
    prior.catalog_manifest_version,
    prior.catalog_manifest_digest,
    prior.resolver_version,
    prior.normalization_version,
    prior.extraction_version,
    'pending',
    null,
    null,
    null,
    prior.mapping_change_classification,
    p_actor_id,
    p_correction_reason,
    prior.id,
    prior.id,
    p_request_hash,
    prior.resolver_decision_trace,
    prior.resolver_trace_schema_version,
    prior.measurement_override
  )
  on conflict (extracted_biomarker_id, writer_request_hash)
    where writer_request_hash is not null
    do nothing
  returning * into successor;

  if successor.id is null then
    select * into successor
    from public.observation_normalization_revisions
    where extracted_biomarker_id = prior.extracted_biomarker_id
      and writer_request_hash = p_request_hash;
    if successor.reversal_of_revision_id is distinct from prior.id then
      raise exception using message = 'verification_reversal_request_conflict';
    end if;
    return query select successor.observation_id, successor.id, true;
    return;
  end if;

  select * into promoted
  from public.promote_observation_normalization_revision_v2(
    successor.id, prior.observation_id, prior.id, p_actor_id, null::jsonb
  );

  update public.document_extracted_biomarkers
  set status = 'needs_review', verification_status = 'pending'
  where id = extracted.id;

  return query select promoted.observation_id, promoted.id, false;
end;
$$;

comment on function public.eh122_reverse_observation_normalization_verification(
  uuid, uuid, text, text
) is
  'EH-122/248 service-only batch undo: append a pending reversal while copying the saved resolution, trace, identity, and release fields without current Resolver evaluation.';

-- ── Change-history identity propagation ───────────────────────────────────────

alter table public.observation_change_events
  add column if not exists prior_input_identity_format_version text,
  add column if not exists next_input_identity_format_version text,
  add column if not exists input_change text,
  add column if not exists outcome_change text,
  add column if not exists release_change text,
  add column if not exists create_revision boolean,
  add column if not exists activate_revision boolean,
  add column if not exists reprocess_change_facts jsonb;

alter table public.observation_change_events
  drop constraint if exists observation_change_events_prior_input_identity_format_version_check,
  drop constraint if exists observation_change_events_next_input_identity_format_version_check,
  drop constraint if exists observation_change_events_input_change_check,
  drop constraint if exists observation_change_events_outcome_change_check,
  drop constraint if exists observation_change_events_release_change_check,
  drop constraint if exists observation_change_events_reprocess_change_facts_check;
alter table public.observation_change_events
  add constraint observation_change_events_prior_input_identity_format_version_check
    check (prior_input_identity_format_version is null or prior_input_identity_format_version = '1'),
  add constraint observation_change_events_next_input_identity_format_version_check
    check (next_input_identity_format_version is null or next_input_identity_format_version = '1'),
  add constraint observation_change_events_input_change_check
    check (input_change is null or input_change in ('changed', 'unchanged', 'unavailable')),
  add constraint observation_change_events_outcome_change_check
    check (outcome_change is null or outcome_change in ('changed', 'unchanged')),
  add constraint observation_change_events_release_change_check
    check (release_change is null or release_change in ('changed', 'unchanged', 'unavailable')),
  add constraint observation_change_events_reprocess_change_facts_check
    check (reprocess_change_facts is null or jsonb_typeof(reprocess_change_facts) = 'object');

comment on column public.observation_change_events.prior_input_identity_format_version is
  'EH-248 identity format of the stored prior revision; NULL remains explicit for legacy rows.';
comment on column public.observation_change_events.next_input_identity_format_version is
  'EH-248 identity format of the next revision or applied revision.';
comment on column public.observation_change_events.reprocess_change_facts is
  'EH-248 immutable input, outcome, release, create and activate facts for an applied reprocess row.';

/**
 * Existing EH-121 capture functions intentionally remain unchanged. This
 * before-insert enrichment copies the version/fact fields from their source
 * revision or reprocess row, including old backfill and automatic-verification
 * paths, without allowing an application caller to invent audit facts.
 */
create or replace function public.eh248_enrich_observation_change_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_revision public.observation_normalization_revisions%rowtype;
  next_revision public.observation_normalization_revisions%rowtype;
  reprocess_row public.registry_reprocess_batch_rows%rowtype;
begin
  if new.source_revision_id is not null then
    select * into next_revision
    from public.observation_normalization_revisions
    where id = new.source_revision_id;
    if next_revision.id is not null then
      new.next_input_identity_format_version := next_revision.input_identity_format_version;
    end if;
    if new.source_prior_revision_id is not null then
      select * into prior_revision
      from public.observation_normalization_revisions
      where id = new.source_prior_revision_id;
      if prior_revision.id is not null then
        new.prior_input_identity_format_version := prior_revision.input_identity_format_version;
      end if;
    end if;
  elsif new.source_reprocess_row_id is not null then
    select * into reprocess_row
    from public.registry_reprocess_batch_rows
    where id = new.source_reprocess_row_id;
    if reprocess_row.id is not null then
      new.prior_input_identity_format_version := reprocess_row.prior_input_identity_format_version;
      new.next_input_identity_format_version := reprocess_row.next_input_identity_format_version;
      new.input_change := reprocess_row.input_change;
      new.outcome_change := reprocess_row.outcome_change;
      new.release_change := reprocess_row.release_change;
      new.create_revision := reprocess_row.create_revision;
      new.activate_revision := reprocess_row.activate_revision;
      new.reprocess_change_facts := reprocess_row.reprocess_change_facts;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists eh248_enrich_observation_change_event
  on public.observation_change_events;
create trigger eh248_enrich_observation_change_event
before insert on public.observation_change_events
for each row
execute function public.eh248_enrich_observation_change_event();

notify pgrst, 'reload schema';
