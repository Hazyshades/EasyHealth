-- Versioned persisted resolver decision trace: schema 2 adds alias evidence.
--
-- Schema 1 is preserved byte-for-byte. Every trace already stored against a
-- patient revision was written under it, is immutable, and must keep validating
-- with no backfill and no rewrite. This migration only:
--
--   1. widens `eh115_validate_resolver_decision_trace` to accept '1' or '2',
--      keeping the '1' branch identical to migration 042;
--   2. adds the schema-2 candidate allowlist (7 base keys + 5 alias keys);
--   3. adds `eh122_trace_matches_resolver_evidence`, which forbids the trace and
--      `resolver_evidence` from carrying divergent alias facts;
--   4. re-creates the `write_observation_normalization_revision_v2` wrapper so
--      the cross-check runs before any row is written.
--
-- Widening an allowlist is additive: nothing that validated before stops
-- validating now.

create or replace function public.eh115_validate_resolver_decision_trace(
  p_trace jsonb,
  p_schema_version text
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  candidate jsonb;
  evidence jsonb;
  expected_conflicts jsonb;
  expected_missing_axes jsonb;
  expected_trace_conflicts jsonb;
  expected_candidate_keys integer;
begin
  if p_schema_version not in ('1', '2')
    or jsonb_typeof(p_trace) is distinct from 'object'
    or p_trace ->> 'schemaVersion' is distinct from p_schema_version
    or (select count(*) from jsonb_object_keys(p_trace)) <> 11
    or exists (
      select 1
      from jsonb_object_keys(p_trace) as key
      where key not in (
        'schemaVersion', 'outcome', 'decisionKind', 'inputEvidenceHash',
        'catalogManifestVersion', 'catalogManifestDigest', 'resolverVersion',
        'winningCandidateKey', 'candidates', 'missingAxes', 'conflicts'
      )
    )
    or p_trace ->> 'outcome' not in ('resolved', 'ambiguous', 'partial', 'unmapped')
    or p_trace ->> 'decisionKind' not in (
      'single_reviewed_candidate', 'multiple_reviewed_candidates',
      'recognized_incomplete', 'no_matching_candidate', 'manual_selection'
    )
    or coalesce(p_trace ->> 'inputEvidenceHash', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_trace ->> 'catalogManifestVersion', '') !~ '^[A-Za-z0-9._:-]{1,128}$'
    or coalesce(p_trace ->> 'catalogManifestDigest', '') !~ '^[A-Za-z0-9._:-]{1,128}$'
    or coalesce(p_trace ->> 'resolverVersion', '') !~ '^[A-Za-z0-9._:-]{1,128}$'
    or jsonb_typeof(p_trace -> 'candidates') is distinct from 'array'
    or jsonb_typeof(p_trace -> 'missingAxes') is distinct from 'array'
    or jsonb_typeof(p_trace -> 'conflicts') is distinct from 'array'
    or not public.eh115_is_canonical_text_array(p_trace -> 'missingAxes')
    or not public.eh115_is_canonical_text_array(p_trace -> 'conflicts') then
    return false;
  end if;

  if (p_trace ->> 'outcome' = 'resolved' and p_trace ->> 'decisionKind' not in ('single_reviewed_candidate', 'manual_selection'))
    or (p_trace ->> 'outcome' = 'ambiguous' and p_trace ->> 'decisionKind' <> 'multiple_reviewed_candidates')
    or (p_trace ->> 'outcome' = 'partial' and p_trace ->> 'decisionKind' <> 'recognized_incomplete')
    or (p_trace ->> 'outcome' = 'unmapped' and p_trace ->> 'decisionKind' <> 'no_matching_candidate')
    or (p_trace ->> 'outcome' = 'resolved' and jsonb_typeof(p_trace -> 'winningCandidateKey') is distinct from 'string')
    or (p_trace ->> 'outcome' <> 'resolved' and p_trace -> 'winningCandidateKey' is distinct from 'null'::jsonb)
    or (jsonb_typeof(p_trace -> 'winningCandidateKey') = 'string' and coalesce(p_trace ->> 'winningCandidateKey', '') !~ '^[a-z0-9]+(_[a-z0-9]+)*$') then
    return false;
  end if;

  expected_candidate_keys := case when p_schema_version = '2' then 12 else 7 end;

  for candidate in select value from jsonb_array_elements(p_trace -> 'candidates') loop
    if jsonb_typeof(candidate) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(candidate)) <> expected_candidate_keys
      or exists (
        select 1
        from jsonb_object_keys(candidate) as key
        where key not in ('candidateKey', 'maturity', 'score', 'accepted', 'rejected', 'missingAxes', 'conflicts')
          and not (
            p_schema_version = '2'
            and key in ('aliasKey', 'aliasMatchType', 'aliasLocale', 'aliasLaboratory', 'aliasFoldFallback')
          )
      )
      or coalesce(candidate ->> 'candidateKey', '') !~ '^[a-z0-9]+(_[a-z0-9]+)*$'
      or candidate ->> 'maturity' not in ('provisional', 'reviewed', 'retired')
      or jsonb_typeof(candidate -> 'score') not in ('number', 'null')
      or jsonb_typeof(candidate -> 'accepted') is distinct from 'array'
      or jsonb_typeof(candidate -> 'rejected') is distinct from 'array'
      or not public.eh115_is_canonical_text_array(candidate -> 'missingAxes')
      or exists (
        select 1
        from jsonb_array_elements_text(candidate -> 'missingAxes') as axis
        where axis not in ('unit', 'specimen', 'modifier', 'timing', 'method', 'value_kind')
      )
      or not public.eh115_is_canonical_text_array(candidate -> 'conflicts') then
      return false;
    end if;

    if p_schema_version = '2' then
      if coalesce(candidate ->> 'aliasKey', '') !~ '^[A-Za-z0-9._:-]{1,200}$'
        or candidate ->> 'aliasMatchType' not in ('exact', 'normalized', 'ocr_variant', 'bounded_fuzzy', 'token_set')
        or candidate ->> 'aliasLocale' not in ('en', 'ru', 'es')
        or jsonb_typeof(candidate -> 'aliasLaboratory') not in ('string', 'null')
        or (
          jsonb_typeof(candidate -> 'aliasLaboratory') = 'string'
          and coalesce(candidate ->> 'aliasLaboratory', '') !~ '^[A-Za-z0-9._:-]{1,200}$'
        )
        or jsonb_typeof(candidate -> 'aliasFoldFallback') is distinct from 'boolean' then
        return false;
      end if;
    end if;

    for evidence in
      select value from jsonb_array_elements(candidate -> 'accepted')
      union all
      select value from jsonb_array_elements(candidate -> 'rejected')
    loop
      if jsonb_typeof(evidence) is distinct from 'object'
        or (select count(*) from jsonb_object_keys(evidence)) <> 2
        or exists (
          select 1 from jsonb_object_keys(evidence) as key where key not in ('code', 'strength')
        )
        or evidence ->> 'code' not in (
          'definition_key_match', 'alias_exact_match', 'alias_normalized_match', 'alias_ocr_variant_match',
          'alias_bounded_fuzzy_match', 'proposed_key_match', 'unit_compatible', 'unit_not_required',
          'unit_dimension_conflict', 'unit_not_accepted', 'unit_unsupported', 'unit_missing',
          'specimen_compatible', 'specimen_conflict', 'specimen_unsupported', 'modifier_compatible',
          'modifier_conflict', 'section_support', 'neighbour_support', 'reference_shape_support',
          'specimen_missing', 'modifier_missing', 'manual_selection', 'value_kind_compatible',
          'value_kind_conflict', 'value_kind_missing', 'timing_compatible', 'timing_conflict',
          'timing_missing', 'method_compatible', 'method_conflict', 'method_missing',
          'candidate_not_selected', 'alias_token_set_match'
        )
        or evidence ->> 'strength' not in ('hard', 'strong', 'weak') then
        return false;
      end if;
    end loop;

    select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
    into expected_conflicts
    from (
      select distinct rejected_entry.value ->> 'code' as value
      from jsonb_array_elements(candidate -> 'rejected') as rejected_entry(value)
      where rejected_entry.value ->> 'strength' = 'hard'
    ) as values;
    if candidate -> 'conflicts' is distinct from expected_conflicts then
      return false;
    end if;
  end loop;

  if not public.eh115_is_canonical_text_array(
    coalesce((
      select jsonb_agg(candidate_entry.value -> 'candidateKey')
      from jsonb_array_elements(p_trace -> 'candidates') as candidate_entry(value)
    ), '[]'::jsonb)
  ) then
    return false;
  end if;

  if p_trace ->> 'winningCandidateKey' is not null and not exists (
    select 1
    from jsonb_array_elements(p_trace -> 'candidates') as candidate_entry(value)
    where candidate_entry.value ->> 'candidateKey' = p_trace ->> 'winningCandidateKey'
  ) then
    return false;
  end if;

  select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
  into expected_missing_axes
  from (
    select distinct axis as value
    from jsonb_array_elements(p_trace -> 'candidates') as candidate_entry(value),
      jsonb_array_elements_text(candidate_entry.value -> 'missingAxes') as axis
  ) as values;
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
  into expected_trace_conflicts
  from (
    select distinct conflict as value
    from jsonb_array_elements(p_trace -> 'candidates') as candidate_entry(value),
      jsonb_array_elements_text(candidate_entry.value -> 'conflicts') as conflict
  ) as values;

  return p_trace -> 'missingAxes' = expected_missing_axes
    and p_trace -> 'conflicts' = expected_trace_conflicts;
end;
$$;

-- Single source of truth for alias evidence is the schema-2 decision trace.
-- `resolver_evidence` keeps the operational v2 ResolverDecisionTrace its
-- existing readers consume; the two may not disagree about which alias admitted
-- a candidate.
create or replace function public.eh122_trace_matches_resolver_evidence(
  p_trace jsonb,
  p_resolver_evidence jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  candidate jsonb;
  evidence_candidate jsonb;
begin
  if p_trace ->> 'schemaVersion' is distinct from '2' then
    return true;
  end if;

  -- Legacy array-shaped resolver_evidence predates candidate objects and is
  -- never produced together with a schema-2 trace.
  if jsonb_typeof(p_resolver_evidence) is distinct from 'object'
    or jsonb_typeof(p_resolver_evidence -> 'candidates') is distinct from 'array' then
    return false;
  end if;

  if (select count(*) from jsonb_array_elements(p_trace -> 'candidates'))
    <> (select count(*) from jsonb_array_elements(p_resolver_evidence -> 'candidates')) then
    return false;
  end if;

  for candidate in select value from jsonb_array_elements(p_trace -> 'candidates') loop
    select value
    into evidence_candidate
    from jsonb_array_elements(p_resolver_evidence -> 'candidates') as entry(value)
    where entry.value ->> 'candidateKey' = candidate ->> 'candidateKey'
    limit 1;

    if evidence_candidate is null
      or evidence_candidate -> 'matchedAlias' ->> 'key' is distinct from candidate ->> 'aliasKey'
      or evidence_candidate -> 'matchedAlias' ->> 'matchType' is distinct from candidate ->> 'aliasMatchType'
      or coalesce(evidence_candidate -> 'matchedAlias' ->> 'locale', 'en') is distinct from candidate ->> 'aliasLocale'
      or coalesce(evidence_candidate -> 'matchedAlias' ->> 'laboratory', '') is distinct from coalesce(candidate ->> 'aliasLaboratory', '')
      or coalesce((evidence_candidate -> 'matchedAlias' ->> 'foldFallback')::boolean, false)
         is distinct from (candidate ->> 'aliasFoldFallback')::boolean then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.write_observation_normalization_revision_v2(
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
  write_result record;
  trace jsonb;
  trace_schema_version text;
begin
  trace := p_resolution -> 'resolver_decision_trace';
  trace_schema_version := nullif(btrim(p_resolution ->> 'resolver_trace_schema_version'), '');

  if not public.eh115_validate_resolver_decision_trace(trace, trace_schema_version) then
    raise exception using message = 'invalid_resolver_decision_trace';
  end if;

  if trace ->> 'outcome' is distinct from nullif(btrim(p_resolution ->> 'resolver_result'), '')
    or trace ->> 'inputEvidenceHash' is distinct from nullif(btrim(p_resolution ->> 'input_evidence_hash'), '')
    or trace ->> 'catalogManifestVersion' is distinct from nullif(btrim(p_resolution ->> 'catalog_manifest_version'), '')
    or trace ->> 'catalogManifestDigest' is distinct from nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), '')
    or trace ->> 'resolverVersion' is distinct from nullif(btrim(p_resolution ->> 'resolver_version'), '') then
    raise exception using message = 'resolver_decision_trace_resolution_mismatch';
  end if;

  if not public.eh122_trace_matches_resolver_evidence(
    trace,
    p_resolution -> 'resolver_evidence'
  ) then
    raise exception using message = 'resolver_trace_evidence_divergence';
  end if;

  select *
  into write_result
  from public.write_observation_normalization_revision_v2_legacy(
    p_extracted_biomarker_id,
    p_observation,
    p_resolution,
    p_write_kind,
    p_actor_id,
    p_request_hash,
    p_expected_active_revision_id,
    p_mapping_change_classification,
    p_correction_reason,
    p_reversal_of_revision_id,
    p_supersedes_revision_id,
    p_extraction_version,
    p_reviewed_measurement_definition
  );

  update public.observation_normalization_revisions
  set resolver_decision_trace = trace,
      resolver_trace_schema_version = trace_schema_version
  where id = write_result.revision_id
    and extracted_biomarker_id = p_extracted_biomarker_id;

  if not found then
    raise exception using message = 'resolver_decision_trace_revision_not_found';
  end if;

  return query
  select
    write_result.observation_id,
    write_result.revision_id,
    write_result.verification_status,
    write_result.resolver_result,
    write_result.was_reused;
end;
$$;

revoke all on function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) to service_role;

comment on function public.eh122_trace_matches_resolver_evidence(jsonb, jsonb) is
  'Schema-2 alias evidence in resolver_decision_trace must agree with resolver_evidence; the trace is the source of truth.';

notify pgrst, 'reload schema';
