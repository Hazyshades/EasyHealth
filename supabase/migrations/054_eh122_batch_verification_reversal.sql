-- EH-122: append-only reversal of a batch-created verification decision.
--
-- The successor revision preserves the original resolution evidence while
-- changing only the verification decision back to pending. Existing revisions
-- and EH-121 ledger events remain immutable.

create function public.eh122_reverse_observation_normalization_verification(
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

  if not prior.is_active or prior.observation_id is null then
    raise exception using message = 'batch_verification_revision_not_active';
  end if;
  if prior.verification_status <> 'user_verified' then
    raise exception using message = 'batch_verification_revision_not_reversible';
  end if;

  select * into extracted
  from public.document_extracted_biomarkers
  where id = prior.extracted_biomarker_id
  for update;
  if extracted.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;

  insert into public.observation_normalization_revisions (
    extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
    analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
    resolver_evidence, catalog_manifest_version, catalog_manifest_digest,
    resolver_version, normalization_version, extraction_version,
    verification_status, verification_decided_at, verification_actor_type,
    verification_actor_id, mapping_change_classification, created_by,
    correction_reason, reversal_of_revision_id, supersedes_revision_id,
    writer_request_hash, measurement_override
  ) values (
    prior.extracted_biomarker_id, prior.input_evidence_hash,
    prior.measurement_definition_key, prior.analyte_key, prior.resolver_result,
    prior.mapping_confidence, prior.mapping_confidence_band, prior.resolver_evidence,
    prior.catalog_manifest_version, prior.catalog_manifest_digest,
    prior.resolver_version, prior.normalization_version, prior.extraction_version,
    'pending', null, null, null, prior.mapping_change_classification, p_actor_id,
    p_correction_reason, prior.id, prior.id, p_request_hash,
    prior.measurement_override
  ) on conflict (extracted_biomarker_id, writer_request_hash)
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

-- Keep all pre-EH-122 write paths byte-for-byte behind their existing function
-- identity. Only `verification_reversal` is added at the canonical entrypoint.
alter function public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean
) rename to write_observation_normalization_revision_v2_pre_eh122;

create function public.write_observation_normalization_revision_v2_legacy(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_write_kind text,
  p_actor_id uuid,
  p_request_hash text,
  p_measurement_override jsonb default null,
  p_expected_active_revision_id uuid default null,
  p_mapping_change_classification text default 'additive',
  p_correction_reason text default null,
  p_reversal_of_revision_id uuid default null,
  p_supersedes_revision_id uuid default null,
  p_extraction_version text default null,
  p_reviewed_measurement_definition boolean default false
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
  reversed record;
  successor public.observation_normalization_revisions;
begin
  if p_write_kind <> 'verification_reversal' then
    return query
    select *
    from public.write_observation_normalization_revision_v2_pre_eh122(
      p_extracted_biomarker_id, p_observation, p_resolution, p_write_kind,
      p_actor_id, p_request_hash, p_measurement_override,
      p_expected_active_revision_id, p_mapping_change_classification,
      p_correction_reason, p_reversal_of_revision_id, p_supersedes_revision_id,
      p_extraction_version, p_reviewed_measurement_definition
    );
    return;
  end if;

  if p_reversal_of_revision_id is null
    or p_expected_active_revision_id is distinct from p_reversal_of_revision_id
    or p_supersedes_revision_id is distinct from p_reversal_of_revision_id then
    raise exception using message = 'invalid_verification_reversal_source';
  end if;

  select * into reversed
  from public.eh122_reverse_observation_normalization_verification(
    p_reversal_of_revision_id, p_actor_id, p_correction_reason, p_request_hash
  );
  select * into successor
  from public.observation_normalization_revisions
  where id = reversed.revision_id
    and extracted_biomarker_id = p_extracted_biomarker_id;
  if successor.id is null then
    raise exception using message = 'reversal_revision_source_mismatch';
  end if;

  return query select
    reversed.observation_id,
    reversed.revision_id,
    successor.verification_status,
    successor.resolver_result,
    reversed.was_reused;
end;
$$;

create function public.reverse_observation_normalization_verification_v2(
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
language sql
security definer
set search_path = public
as $$
  select *
  from public.eh122_reverse_observation_normalization_verification(
    p_batch_revision_id, p_actor_id, p_correction_reason, p_request_hash
  );
$$;

revoke all on function public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean
) to service_role;

revoke all on function public.reverse_observation_normalization_verification_v2(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.reverse_observation_normalization_verification_v2(uuid, uuid, text, text)
  to service_role;

comment on function public.reverse_observation_normalization_verification_v2(uuid, uuid, text, text) is
  'EH-122 append-only verification reversal: copies an active user-verified revision to a pending successor and promotes it through the canonical CAS primitive.';