-- #111: widen the EH-115 decision-trace allowlist with specimen_from_reviewed_panel.
-- Additive only: traces persisted before this policy existed keep validating.

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
          'specimen_compatible', 'specimen_from_reviewed_panel', 'specimen_conflict', 'specimen_unsupported', 'modifier_compatible',
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
