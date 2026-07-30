-- EH-115: immutable, privacy-safe resolver decision traces.

alter table public.observation_normalization_revisions
  add column if not exists resolver_decision_trace jsonb,
  add column if not exists resolver_trace_schema_version text;

comment on column public.observation_normalization_revisions.resolver_decision_trace is
  'EH-115 canonical, privacy-safe explanation of the resolver decision; never contains raw source content.';
comment on column public.observation_normalization_revisions.resolver_trace_schema_version is
  'Version of the EH-115 resolver decision trace schema.';

create or replace function public.eh115_is_canonical_text_array(p_values jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  canonical jsonb;
begin
  if jsonb_typeof(p_values) is distinct from 'array'
    or exists (
      select 1
      from jsonb_array_elements(p_values) as entry(value)
      where jsonb_typeof(entry.value) is distinct from 'string'
    ) then
    return false;
  end if;

  select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
  into canonical
  from (
    select distinct jsonb_array_elements_text(p_values) as value
  ) as values;

  return p_values = canonical;
end;
$$;

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
begin
  if p_schema_version is distinct from '1'
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

  for candidate in select value from jsonb_array_elements(p_trace -> 'candidates') loop
    if jsonb_typeof(candidate) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(candidate)) <> 7
      or exists (
        select 1
        from jsonb_object_keys(candidate) as key
        where key not in ('candidateKey', 'maturity', 'score', 'accepted', 'rejected', 'missingAxes', 'conflicts')
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
          'candidate_not_selected'
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

create or replace function public.eh115_enforce_resolver_decision_trace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.resolver_decision_trace is not null
    and (
      new.resolver_decision_trace is distinct from old.resolver_decision_trace
      or new.resolver_trace_schema_version is distinct from old.resolver_trace_schema_version
    ) then
    raise exception using message = 'resolver_decision_trace_immutable';
  end if;

  if new.resolver_decision_trace is not null
    and not public.eh115_validate_resolver_decision_trace(
      new.resolver_decision_trace,
      new.resolver_trace_schema_version
    ) then
    raise exception using message = 'invalid_resolver_decision_trace';
  end if;

  return new;
end;
$$;

drop trigger if exists observation_normalization_revision_trace_guard
  on public.observation_normalization_revisions;
create trigger observation_normalization_revision_trace_guard
  before insert or update on public.observation_normalization_revisions
  for each row
  execute function public.eh115_enforce_resolver_decision_trace();

alter function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) rename to write_observation_normalization_revision_v2_legacy;

create function public.write_observation_normalization_revision_v2(
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

revoke all on function public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) to service_role;