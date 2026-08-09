-- #120: gate the two semantic identity links at their own thresholds.
--
-- Acceptance returned 207 with every recognized-but-incomplete row rejected as
-- `incomplete_normalization_cannot_have_concrete_identity`. The guard required
-- BOTH `measurement_definition_key` and `analyte_key` to be null unless the
-- outcome was `resolved`, but Registry 2.0 has two identity tiers with
-- different thresholds and every other layer implements them that way:
--
--   * `context-aware-measurement-resolution` gates only the definition key
--     ("Only `resolved` SHALL expose a non-null measurement definition key").
--   * `observation-identity` tells consumers they may accept analyte-level
--     partial data.
--   * `measurement-resolution.ts` emits an analyte on convergence regardless of
--     outcome, and `observation-identity.ts` deliberately forwards it ungated
--     while gating the definition key.
--
-- The guard was the only layer reading it as one tier, and nothing caught the
-- disagreement because acceptance had never committed a row before #117.
--
-- Behaviour was inverted with respect to knowledge: an `unmapped` row has no
-- candidates, therefore no analyte, therefore committed cleanly, while a
-- `partial` row that knew exactly which analyte it measured was refused.
--
-- Same target as #117: EH-115 (migration 039) renamed the EH-106 function to
-- `_legacy` and put a trace-validating wrapper in front of it under the
-- original name. The guard lives in the delegate, so that is what is recreated
-- here; replacing the wrapper would revert EH-115.
--
-- Covered by supabase/tests/writer_rpc_seam.sql (both directions: an incomplete
-- payload with an analyte key commits, one with a definition key still fails)
-- and QA-Db_tests/eh111_clinical_compatibility.sql.

create or replace function public.write_observation_normalization_revision_v2_legacy(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_write_kind text,
  p_actor_id uuid,
  p_request_hash text,
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
  target_observation public.observations;
  target_revision public.observation_normalization_revisions;
  promoted_revision public.observation_normalization_revisions;
  target_verification_status text;
  target_resolver_result text;
  target_definition_key text;
  target_analyte_key text;
  target_mapping_confidence numeric;
  target_mapping_confidence_band text;
  target_resolver_evidence jsonb;
  target_catalog_manifest_version text;
  target_catalog_manifest_digest text;
  target_resolver_version text;
  target_normalization_version text;
  target_normalized_unit text;
  target_unit_dimension text;
  target_input_evidence_hash text;
  target_expected_active_revision_id uuid;
  target_supersedes_revision_id uuid;
  revision_was_reused boolean := false;
begin
  if p_write_kind not in ('acceptance', 'correction') then
    raise exception using message = 'invalid_normalization_write_kind';
  end if;

  if p_actor_id is null then
    raise exception using message = 'normalization_writer_actor_required';
  end if;

  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_normalization_writer_request_hash';
  end if;

  if jsonb_typeof(p_observation) is distinct from 'object'
    or jsonb_typeof(p_resolution) is distinct from 'object' then
    raise exception using message = 'invalid_normalization_writer_payload';
  end if;

  target_resolver_result := nullif(btrim(p_resolution ->> 'resolver_result'), '');
  target_definition_key := nullif(btrim(p_resolution ->> 'measurement_definition_key'), '');
  target_analyte_key := nullif(btrim(p_resolution ->> 'analyte_key'), '');
  target_mapping_confidence := nullif(p_resolution ->> 'mapping_confidence', '')::numeric;
  target_mapping_confidence_band := nullif(btrim(p_resolution ->> 'mapping_confidence_band'), '');
  target_resolver_evidence := coalesce(p_resolution -> 'resolver_evidence', '[]'::jsonb);
  target_catalog_manifest_version := nullif(btrim(p_resolution ->> 'catalog_manifest_version'), '');
  target_catalog_manifest_digest := nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), '');
  target_resolver_version := nullif(btrim(p_resolution ->> 'resolver_version'), '');
  target_normalization_version := nullif(btrim(p_resolution ->> 'normalization_version'), '');
  target_normalized_unit := nullif(btrim(p_resolution ->> 'normalized_unit'), '');
  target_unit_dimension := nullif(btrim(p_resolution ->> 'unit_dimension'), '');
  target_input_evidence_hash := nullif(btrim(p_resolution ->> 'input_evidence_hash'), '');

  if target_resolver_result is null
    or target_resolver_result not in ('resolved', 'partial', 'ambiguous', 'unmapped')
    or target_mapping_confidence is null
    or target_mapping_confidence < 0
    or target_mapping_confidence > 1
    or target_mapping_confidence_band is null
    or target_mapping_confidence_band not in ('high', 'medium', 'low')
    or target_input_evidence_hash is null
    or target_catalog_manifest_version is null
    or target_catalog_manifest_digest is null
    or target_resolver_version is null
    or target_normalization_version is null
    -- #117: `resolver_evidence` carries the v2 decision trace, an OBJECT with
    -- `candidates`. This demanded an array, inherited from migration 021 when
    -- the column really did hold a flat evidence list, so every acceptance the
    -- TypeScript writer attempted was rejected. The read path traverses
    -- `.outcome` and `.selectedCandidateKey`, so the object is the correct
    -- shape; the legacy array stays acceptable for rows written before it.
    or jsonb_typeof(target_resolver_evidence) not in ('array', 'object')
    or (
      jsonb_typeof(target_resolver_evidence) = 'object'
      and jsonb_typeof(target_resolver_evidence -> 'candidates') is distinct from 'array'
    ) then
    raise exception using message = 'invalid_normalization_resolution_payload';
  end if;

  if target_resolver_result = 'resolved' then
    if target_definition_key is null or target_analyte_key is null then
      raise exception using message = 'resolved_normalization_requires_concrete_identity';
    end if;
    if p_reviewed_measurement_definition is not true then
      raise exception using message = 'unreviewed_measurement_definition';
    end if;
  -- #120: the two identity links are not one rule. `measurement_definition_key`
  -- is the concrete claim and still requires `resolved`. `analyte_key` is the
  -- weaker tier: the resolver emits it whenever its viable candidates converge
  -- on a single analyte, which is the normal state of a row whose specimen axis
  -- was never printed. Gating both at the same threshold rejected every such
  -- row, so a document could only be accepted in the part the resolver
  -- understood least. The resolved branch above is unchanged, so the concrete
  -- identity invariant is untouched.
  elsif target_definition_key is not null then
    raise exception using message = 'incomplete_normalization_cannot_have_concrete_identity';
  end if;

  if p_write_kind = 'correction' and target_resolver_result <> 'resolved' then
    raise exception using message = 'correction_requires_reviewed_concrete_definition';
  end if;

  target_verification_status := case
    when p_write_kind = 'correction' then 'manually_corrected'
    when target_resolver_result = 'resolved' then 'user_verified'
    else 'pending'
  end;

  if p_reversal_of_revision_id is not null and not exists (
    select 1
    from public.observation_normalization_revisions
    where id = p_reversal_of_revision_id
      and extracted_biomarker_id = p_extracted_biomarker_id
  ) then
    raise exception using message = 'reversal_revision_source_mismatch';
  end if;

  if p_supersedes_revision_id is not null and not exists (
    select 1
    from public.observation_normalization_revisions
    where id = p_supersedes_revision_id
      and extracted_biomarker_id = p_extracted_biomarker_id
  ) then
    raise exception using message = 'superseded_revision_source_mismatch';
  end if;

  -- The initial insert is deliberately source-only. The v2 primitive below is
  -- the only code path that writes the active normalization projection.
  insert into public.observations (
    profile_id,
    document_id,
    source_extracted_biomarker_id,
    name,
    value,
    value_kind,
    value_text,
    ordinal,
    unit,
    ref_low,
    ref_high,
    observed_at,
    specimen,
    modifier,
    raw_name,
    raw_value_text,
    raw_reference_text,
    raw_unit,
    source_page,
    source_text,
    bounding_box,
    confidence,
    reported_alt_value,
    reported_alt_unit,
    extraction_version,
    provenance_schema_version,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    observation_kind
  )
  values (
    (p_observation ->> 'profile_id')::uuid,
    (p_observation ->> 'document_id')::uuid,
    p_extracted_biomarker_id,
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
    nullif(p_observation ->> 'extraction_version', ''),
    coalesce(nullif(btrim(p_observation ->> 'provenance_schema_version'), ''), '1'),
    target_catalog_manifest_version,
    target_catalog_manifest_digest,
    target_resolver_version,
    target_normalization_version,
    'lab'
  )
  on conflict (source_extracted_biomarker_id)
    where source_extracted_biomarker_id is not null
    do nothing
  returning * into target_observation;

  if target_observation.id is null then
    select *
    into target_observation
    from public.observations
    where source_extracted_biomarker_id = p_extracted_biomarker_id;
  end if;

  if target_observation.id is null then
    raise exception using message = 'observation_write_failed';
  end if;

  select *
  into target_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = p_extracted_biomarker_id
    and writer_request_hash = p_request_hash;

  if target_revision.id is not null then
    revision_was_reused := true;
    target_expected_active_revision_id := target_revision.supersedes_revision_id;
  else
    target_supersedes_revision_id := coalesce(
      p_supersedes_revision_id,
      p_expected_active_revision_id
    );

    insert into public.observation_normalization_revisions (
      extracted_biomarker_id,
      input_evidence_hash,
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
      writer_request_hash
    )
    values (
      p_extracted_biomarker_id,
      target_input_evidence_hash,
      target_definition_key,
      target_analyte_key,
      target_resolver_result,
      target_mapping_confidence,
      target_mapping_confidence_band,
      target_resolver_evidence,
      target_catalog_manifest_version,
      target_catalog_manifest_digest,
      target_resolver_version,
      target_normalization_version,
      p_extraction_version,
      target_verification_status,
      case when target_verification_status = 'pending' then null else now() end,
      case when target_verification_status = 'pending' then null else 'user' end,
      case when target_verification_status = 'pending' then null else p_actor_id end,
      p_mapping_change_classification,
      p_actor_id,
      p_correction_reason,
      p_reversal_of_revision_id,
      target_supersedes_revision_id,
      p_request_hash
    )
    on conflict (extracted_biomarker_id, writer_request_hash)
      where writer_request_hash is not null
      do nothing
    returning * into target_revision;

    if target_revision.id is null then
      select *
      into target_revision
      from public.observation_normalization_revisions
      where extracted_biomarker_id = p_extracted_biomarker_id
        and writer_request_hash = p_request_hash;
      revision_was_reused := true;
      target_expected_active_revision_id := target_revision.supersedes_revision_id;
    else
      target_expected_active_revision_id := target_supersedes_revision_id;
    end if;
  end if;

  -- Do not lock, validate ownership, synchronize projections, or handle CAS
  -- here. Those remain the v2 primitive's exact responsibility and errors.
  select *
  into promoted_revision
  from public.promote_observation_normalization_revision_v2(
    target_revision.id,
    target_observation.id,
    target_expected_active_revision_id,
    p_actor_id
  );

  update public.document_extracted_biomarkers
  set status = 'accepted',
      analyte_key = target_analyte_key,
      measurement_definition_key = target_definition_key,
      resolver_result = target_resolver_result,
      resolution_status = target_resolver_result,
      mapping_confidence = target_mapping_confidence,
      mapping_confidence_band = target_mapping_confidence_band,
      resolver_evidence = target_resolver_evidence,
      normalized_unit = target_normalized_unit,
      unit_dimension = target_unit_dimension,
      catalog_manifest_version = target_catalog_manifest_version,
      catalog_manifest_digest = target_catalog_manifest_digest,
      resolver_version = target_resolver_version,
      normalization_version = target_normalization_version,
      extraction_version = p_extraction_version,
      verification_status = target_verification_status
  where id = p_extracted_biomarker_id;

  return query
  select
    target_observation.id,
    promoted_revision.id,
    promoted_revision.verification_status,
    promoted_revision.resolver_result,
    revision_was_reused;
end;
$$;
