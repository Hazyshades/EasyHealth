-- EH-148 versioned Doctor Visit Brief persistence and server-only evidence mappings.
-- New structured reports are written only through the validated RPC below.

alter table public.reports
  add column if not exists requested_scope_kind text,
  add column if not exists validation_status text,
  add column if not exists validation_version text,
  add column if not exists validation_issue_codes text[] not null default '{}';

alter table public.reports
  drop constraint if exists reports_requested_scope_kind_check,
  drop constraint if exists reports_validation_status_check,
  drop constraint if exists reports_validation_envelope_check,
  drop constraint if exists reports_validation_issue_codes_check;

alter table public.reports
  add constraint reports_requested_scope_kind_check
    check (
      requested_scope_kind is null
      or requested_scope_kind in ('all_eligible', 'explicit')
    ),
  add constraint reports_validation_status_check
    check (
      validation_status is null
      or validation_status in ('valid', 'limited')
    ),
  add constraint reports_validation_envelope_check
    check (
      validation_status is null
      or (
        validation_version is not null
        and length(btrim(validation_version)) > 0
        and validation_issue_codes is not null
      )
    ),
  add constraint reports_validation_issue_codes_check
    check (
      validation_issue_codes <@ array[
        'SCHEMA_INVALID',
        'SOURCE_NOT_FOUND',
        'SOURCE_UNAVAILABLE',
        'TEMPLATE_INVALID',
        'EMPTY_FACTUAL_CLAIM',
        'UNSAFE_CONTENT',
        'SCOPE_CONFLICT',
        'VALIDATION_ENVELOPE_INVALID'
      ]::text[]
    );

create table if not exists public.report_evidence_sources (
  report_id uuid not null references public.reports(id) on delete cascade,
  source_id text not null check (source_id ~ '^src_[0-9a-f]{32}$'),
  source_kind text not null check (
    source_kind in (
      'observation',
      'finding',
      'clinical_note',
      'prescription',
      'referral',
      'document_summary'
    )
  ),
  source_row_id uuid not null,
  document_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (report_id, source_id)
);

create index if not exists report_evidence_sources_document_idx
  on public.report_evidence_sources (document_id, report_id);

alter table public.report_evidence_sources enable row level security;
revoke all on public.report_evidence_sources from public, anon, authenticated, service_role;
grant select on public.report_evidence_sources to service_role;

-- The previous writer accepted legacy free-form content without an evidence
-- mapping or immutable validation envelope. Remove that callable overload so
-- there is one creation boundary for new structured reports.
drop function if exists public.create_validated_report(
  uuid,
  text,
  text,
  text,
  uuid[],
  uuid[],
  jsonb,
  boolean,
  jsonb,
  text
);

create or replace function public.create_validated_report(
  p_profile_id uuid,
  p_title text,
  p_report_type text,
  p_detail_level text,
  p_requested_scope_kind text,
  p_requested_document_ids uuid[],
  p_actual_source_document_ids uuid[],
  p_source_write_generations jsonb,
  p_abnormal_only boolean,
  p_content jsonb,
  p_summary_preview text,
  p_validation_status text,
  p_validation_version text,
  p_validation_issue_codes text[],
  p_evidence_sources jsonb
)
returns setof public.reports
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_report public.reports%rowtype;
  v_mapping record;
  v_content_claim jsonb;
  v_content_item jsonb;
  v_content_section jsonb;
  v_content_source jsonb;
  v_claim_id text;
  v_section_id text;
  v_reference_count integer;
  v_mapping_count integer;
  v_content_source_count integer;
begin
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception using message = 'report_title_required';
  end if;
  if p_report_type not in (
    'general_practice',
    'cardiology',
    'endocrinology',
    'gastroenterology',
    'hematology',
    'nephrology',
    'neurology',
    'pulmonology'
  ) then
    raise exception using message = 'report_type_invalid';
  end if;
  if p_detail_level not in ('compact', 'standard', 'detailed', 'full') then
    raise exception using message = 'report_detail_level_invalid';
  end if;
  if p_requested_scope_kind not in ('all_eligible', 'explicit') then
    raise exception using message = 'report_requested_scope_invalid';
  end if;
  if p_requested_scope_kind = 'all_eligible'
    and p_requested_document_ids is not null then
    raise exception using message = 'report_requested_scope_invalid';
  end if;
  if p_requested_scope_kind = 'explicit'
    and (p_requested_document_ids is null or array_length(p_requested_document_ids, 1) is null) then
    raise exception using message = 'report_requested_scope_invalid';
  end if;
  if p_actual_source_document_ids is null
    or array_length(p_actual_source_document_ids, 1) is null then
    raise exception using message = 'report_source_scope_required';
  end if;
  if cardinality(p_actual_source_document_ids) <> (
    select count(distinct source_document_id)
    from unnest(p_actual_source_document_ids) as source_ids(source_document_id)
  ) then
    raise exception using message = 'report_source_scope_duplicated';
  end if;
  if p_requested_scope_kind = 'explicit' and (
    cardinality(p_requested_document_ids) <> cardinality(p_actual_source_document_ids)
    or exists (
      select 1
      from unnest(p_actual_source_document_ids) as actual_ids(document_id)
      where not (actual_ids.document_id = any(p_requested_document_ids))
    )
  ) then
    raise exception using message = 'report_requested_scope_conflict';
  end if;
  if p_content is null or jsonb_typeof(p_content) is distinct from 'object' then
    raise exception using message = 'report_content_invalid';
  end if;
  if p_content->'requested_scope' is null
    or jsonb_typeof(p_content->'requested_scope') is distinct from 'object'
    or p_content->'requested_scope'->>'kind' is distinct from p_requested_scope_kind then
    raise exception using message = 'report_requested_scope_mismatch';
  end if;
  if p_requested_scope_kind = 'all_eligible'
    and jsonb_typeof(p_content->'requested_scope'->'document_ids') is distinct from 'null' then
    raise exception using message = 'report_requested_scope_mismatch';
  end if;
  if p_requested_scope_kind = 'explicit' then
    if jsonb_typeof(p_content->'requested_scope'->'document_ids') is distinct from 'array' then
      raise exception using message = 'report_requested_scope_mismatch';
    end if;
    if jsonb_array_length(p_content->'requested_scope'->'document_ids') <> cardinality(p_requested_document_ids)
      or (
        select count(distinct value::uuid)
        from jsonb_array_elements_text(p_content->'requested_scope'->'document_ids') as ids(value)
      ) <> cardinality(p_requested_document_ids)
      or exists (
        select 1
        from jsonb_array_elements_text(p_content->'requested_scope'->'document_ids') as ids(value)
        where not (value::uuid = any(p_requested_document_ids))
      ) then
      raise exception using message = 'report_requested_scope_mismatch';
    end if;
  end if;
  if p_content->'source_document_ids' is null
    or jsonb_typeof(p_content->'source_document_ids') is distinct from 'array' then
    raise exception using message = 'report_source_scope_mismatch';
  end if;
  if jsonb_array_length(p_content->'source_document_ids') <> cardinality(p_actual_source_document_ids)
    or (
      select count(distinct value::uuid)
      from jsonb_array_elements_text(p_content->'source_document_ids') as ids(value)
    ) <> cardinality(p_actual_source_document_ids)
    or exists (
      select 1
      from jsonb_array_elements_text(p_content->'source_document_ids') as ids(value)
      where not (value::uuid = any(p_actual_source_document_ids))
    ) then
    raise exception using message = 'report_source_scope_mismatch';
  end if;
  if p_content->>'schema_version' is distinct from 'eh148.v1'
    or p_content->>'report_kind' is distinct from 'doctor_visit_brief' then
    raise exception using message = 'report_contract_version_invalid';
  end if;
  if p_summary_preview is null then
    raise exception using message = 'report_summary_required';
  end if;
  if p_validation_status not in ('valid', 'limited')
    or p_validation_version is null
    or length(btrim(p_validation_version)) = 0
    or p_validation_issue_codes is null then
    raise exception using message = 'report_validation_envelope_invalid';
  end if;
  if exists (
    select 1
    from unnest(p_validation_issue_codes) as issue(code)
    where issue.code not in (
      'SCHEMA_INVALID',
      'SOURCE_NOT_FOUND',
      'SOURCE_UNAVAILABLE',
      'TEMPLATE_INVALID',
      'EMPTY_FACTUAL_CLAIM',
      'UNSAFE_CONTENT',
      'SCOPE_CONFLICT',
      'VALIDATION_ENVELOPE_INVALID'
    )
  ) then
    raise exception using message = 'report_validation_issue_code_invalid';
  end if;
  if (p_content->'validation'->>'status') is distinct from p_validation_status
    or (p_content->'validation'->>'version') is distinct from p_validation_version
    or (p_content->'validation'->'issue_codes') is distinct from to_jsonb(p_validation_issue_codes) then
    raise exception using message = 'report_validation_envelope_mismatch';
  end if;
  if p_evidence_sources is null
    or jsonb_typeof(p_evidence_sources) is distinct from 'array' then
    raise exception using message = 'report_evidence_mapping_required';
  end if;
  if p_content->'sources' is null
    or jsonb_typeof(p_content->'sources') is distinct from 'array' then
    raise exception using message = 'report_sources_required';
  end if;
  if jsonb_array_length(p_content->'sources') = 0 then
    raise exception using message = 'report_sources_required';
  end if;
  if p_content->'sections' is null
    or jsonb_typeof(p_content->'sections') is distinct from 'array'
    or jsonb_array_length(p_content->'sections') <> 6 then
    raise exception using message = 'report_sections_invalid';
  end if;
  if (
    select string_agg(section.value->>'id', ',' order by section.ordinality)
    from jsonb_array_elements(p_content->'sections')
      with ordinality as section(value, ordinality)
  ) is distinct from
    'document_summary,latest_measurements,changes,clinician_questions,limitations,source_ledger' then
    raise exception using message = 'report_sections_invalid';
  end if;
  if p_content->'claims' is null
    or jsonb_typeof(p_content->'claims') is distinct from 'array' then
    raise exception using message = 'report_claims_invalid';
  end if;
  if p_content->'limitations' is null
    or jsonb_typeof(p_content->'limitations') is distinct from 'array' then
    raise exception using message = 'report_limitations_invalid';
  end if;
  if exists (
    select value->>'id'
    from jsonb_array_elements(p_content->'claims') as claim(value)
    group by value->>'id'
    having count(*) <> 1
  ) then
    raise exception using message = 'report_claims_duplicated';
  end if;
  if exists (
    select value->>'source_id'
    from jsonb_array_elements(p_content->'sources') as source(value)
    group by value->>'source_id'
    having count(*) <> 1
  ) then
    raise exception using message = 'report_sources_duplicated';
  end if;
  if exists (
    select value->>'id'
    from jsonb_array_elements(p_content->'limitations') as limitation(value)
    group by value->>'id'
    having count(*) <> 1
  ) then
    raise exception using message = 'report_limitations_duplicated';
  end if;

  for v_content_section in
    select value
    from jsonb_array_elements(p_content->'sections') as section(value)
  loop
    v_section_id := v_content_section->>'id';
    if v_content_section->'items' is null
      or jsonb_typeof(v_content_section->'items') is distinct from 'array' then
      raise exception using message = 'report_section_items_invalid';
    end if;
    if jsonb_array_length(v_content_section->'items') = 0
      and not (v_content_section ? 'empty_state') then
      raise exception using message = 'report_empty_state_required';
    end if;
    if jsonb_array_length(v_content_section->'items') > 0
      and (v_content_section ? 'empty_state') then
      raise exception using message = 'report_empty_state_invalid';
    end if;
    for v_content_item in
      select value
      from jsonb_array_elements(v_content_section->'items') as item(value)
    loop
      if v_content_item->>'type' = 'claim_ref' then
        if v_content_item->>'claim_id' is null then
          raise exception using message = 'report_claim_reference_invalid';
        end if;
        select value
        into v_content_claim
        from jsonb_array_elements(p_content->'claims') as claim(value)
        where claim.value->>'id' = v_content_item->>'claim_id'
        limit 1;
        if v_content_claim is null
          or v_content_claim->>'section' is distinct from v_section_id then
          raise exception using message = 'report_claim_reference_invalid';
        end if;
      elsif v_content_item->>'type' = 'limitation_ref' then
        if v_section_id is distinct from 'limitations'
          or not exists (
            select 1
            from jsonb_array_elements(p_content->'limitations') as limitation(value)
            where limitation.value->>'id' = v_content_item->>'limitation_id'
          ) then
          raise exception using message = 'report_limitation_reference_invalid';
        end if;
      elsif v_content_item->>'type' = 'source_ref' then
        if v_section_id is distinct from 'source_ledger'
          or not exists (
            select 1
            from jsonb_array_elements(p_content->'sources') as source(value)
            where source.value->>'source_id' = v_content_item->>'source_id'
          ) then
          raise exception using message = 'report_source_reference_invalid';
        end if;
      else
        raise exception using message = 'report_section_item_invalid';
      end if;
    end loop;
  end loop;

  for v_content_claim in
    select value
    from jsonb_array_elements(p_content->'claims') as claim(value)
  loop
    v_claim_id := v_content_claim->>'id';
    if v_claim_id is null
      or (
        v_content_claim->>'status' is distinct from 'supported'
        and v_content_claim->>'status' is distinct from 'limited'
      ) then
      raise exception using message = 'report_claim_invalid';
    end if;
    select count(*) into v_reference_count
    from jsonb_array_elements(p_content->'sections') as section(value)
    cross join lateral jsonb_array_elements(section.value->'items') as item(value)
    where item.value->>'type' = 'claim_ref'
      and item.value->>'claim_id' = v_claim_id;
    if v_reference_count <> 1 then
      raise exception using message = 'report_claim_reference_cardinality_invalid';
    end if;

    if v_content_claim->>'kind' = 'clinician_question' then
      if v_content_claim->>'section' is distinct from 'clinician_questions'
        or (
          v_content_claim->>'origin' is distinct from 'generated'
          and v_content_claim->>'origin' is distinct from 'user_selected'
        )
        or v_content_claim->>'factual' is distinct from 'false'
        or jsonb_typeof(v_content_claim->'citations') is distinct from 'array'
        or jsonb_array_length(v_content_claim->'citations') <> 0
        or nullif(btrim(v_content_claim->>'question_text'), '') is null then
        raise exception using message = 'report_question_claim_invalid';
      end if;
    elsif v_content_claim->>'kind' in ('source_fact', 'numeric_observation') then
      if v_content_claim->>'section' is null
        or v_content_claim->>'section' not in (
          'document_summary',
          'latest_measurements',
          'changes'
        )
        or v_content_claim->>'origin' is distinct from 'generated'
        or v_content_claim->>'factual' is distinct from 'true'
        or nullif(btrim(v_content_claim->>'text'), '') is null
        or jsonb_typeof(v_content_claim->'citations') is distinct from 'array'
        or jsonb_array_length(v_content_claim->'citations') = 0
        or v_content_claim->'template_params' is null then
        raise exception using message = 'report_factual_claim_invalid';
      end if;
      if v_content_claim->>'template_id' is null
        or v_content_claim->>'template_id' not in (
          'source_fact_snapshot',
          'numeric_observation_snapshot'
        )
        or v_content_claim->'template_params'->>'source_id' is null then
        raise exception using message = 'report_template_invalid';
      end if;
      if not exists (
        select 1
        from jsonb_array_elements(v_content_claim->'citations') as citation(value)
        where citation.value->>'source_id' =
          v_content_claim->'template_params'->>'source_id'
      ) then
        raise exception using message = 'report_template_source_not_cited';
      end if;
      if v_content_claim->>'kind' = 'numeric_observation'
        and not exists (
          select 1
          from jsonb_array_elements(p_content->'sources') as source(value)
          where source.value->>'source_id' =
              v_content_claim->'template_params'->>'source_id'
            and source.value->>'kind' = 'observation'
        ) then
        raise exception using message = 'report_numeric_source_invalid';
      end if;
      if exists (
        select citation.value->>'source_id'
        from jsonb_array_elements(v_content_claim->'citations') as citation(value)
        group by citation.value->>'source_id'
        having count(*) <> 1
      ) then
        raise exception using message = 'report_citations_duplicated';
      end if;
      for v_content_item in
        select value
        from jsonb_array_elements(v_content_claim->'citations') as citation(value)
      loop
        if v_content_item->>'source_id' is null
          or v_content_item->>'document_id' is null then
          raise exception using message = 'report_citation_invalid';
        end if;
        select value
        into v_content_source
        from jsonb_array_elements(p_content->'sources') as source(value)
        where source.value->>'source_id' = v_content_item->>'source_id'
        limit 1;
        if v_content_source is null
          or v_content_source->>'document_id' is distinct from
            v_content_item->>'document_id' then
          raise exception using message = 'report_citation_invalid';
        end if;
      end loop;
    else
      raise exception using message = 'report_claim_kind_invalid';
    end if;
  end loop;

  for v_content_source in
    select value
    from jsonb_array_elements(p_content->'sources') as source(value)
  loop
    if v_content_source->>'source_id' is null
      or v_content_source->>'source_id' !~ '^src_[0-9a-f]{32}$'
      or v_content_source->>'kind' is null
      or v_content_source->>'kind' not in (
        'observation',
        'finding',
        'clinical_note',
        'prescription',
        'referral',
        'document_summary'
      )
      or v_content_source->>'document_id' is null
      or not ((v_content_source->>'document_id')::uuid = any(p_actual_source_document_ids))
      or v_content_source->'snapshot'->>'kind' is distinct from v_content_source->>'kind' then
      raise exception using message = 'report_source_invalid';
    end if;
    select count(*) into v_reference_count
    from jsonb_array_elements(p_content->'sections') as section(value)
    cross join lateral jsonb_array_elements(section.value->'items') as item(value)
    where item.value->>'type' = 'source_ref'
      and item.value->>'source_id' = v_content_source->>'source_id';
    if v_reference_count <> 1 then
      raise exception using message = 'report_source_reference_cardinality_invalid';
    end if;
  end loop;

  for v_content_item in
    select value
    from jsonb_array_elements(p_content->'limitations') as limitation(value)
  loop
    if v_content_item->>'id' is null
      or v_content_item->>'code' is null
      or v_content_item->>'code' !~ '^[A-Z0-9_]+$'
      or nullif(btrim(v_content_item->>'message'), '') is null then
      raise exception using message = 'report_limitation_invalid';
    end if;
    select count(*) into v_reference_count
    from jsonb_array_elements(p_content->'sections') as section(value)
    cross join lateral jsonb_array_elements(section.value->'items') as item(value)
    where item.value->>'type' = 'limitation_ref'
      and item.value->>'limitation_id' = v_content_item->>'id';
    if v_reference_count <> 1 then
      raise exception using message = 'report_limitation_reference_cardinality_invalid';
    end if;
  end loop;

  perform public.eh104_lock_validate_source_documents(
    p_profile_id,
    p_actual_source_document_ids,
    p_source_write_generations
  );

  select count(*) into v_mapping_count
  from jsonb_to_recordset(p_evidence_sources) as mappings(
    source_id text,
    source_kind text,
    source_row_id uuid,
    document_id uuid
  );
  select count(*) into v_content_source_count
  from jsonb_array_elements(p_content->'sources');
  if v_mapping_count <> v_content_source_count then
    raise exception using message = 'report_evidence_mapping_incomplete';
  end if;

  if exists (
    select mappings.source_id
    from jsonb_to_recordset(p_evidence_sources) as mappings(
      source_id text,
      source_kind text,
      source_row_id uuid,
      document_id uuid
    )
    group by mappings.source_id
    having count(*) <> 1
  ) then
    raise exception using message = 'report_evidence_mapping_duplicated';
  end if;

  for v_mapping in
    select *
    from jsonb_to_recordset(p_evidence_sources) as mappings(
      source_id text,
      source_kind text,
      source_row_id uuid,
      document_id uuid
    )
  loop
    if v_mapping.source_id is null
      or v_mapping.source_id !~ '^src_[0-9a-f]{32}$'
      or v_mapping.source_kind not in (
        'observation',
        'finding',
        'clinical_note',
        'prescription',
        'referral',
        'document_summary'
      )
      or v_mapping.source_row_id is null
      or v_mapping.document_id is null
      or not (v_mapping.document_id = any(p_actual_source_document_ids)) then
      raise exception using message = 'report_evidence_mapping_invalid';
    end if;

    select source.value
    into v_content_source
    from jsonb_array_elements(p_content->'sources') as source(value)
    where source.value->>'source_id' = v_mapping.source_id;
    if v_content_source is null
      or v_content_source->>'kind' is distinct from v_mapping.source_kind
      or v_content_source->>'document_id' is distinct from v_mapping.document_id::text then
      raise exception using message = 'report_evidence_mapping_mismatch';
    end if;
    if v_mapping.source_kind = 'document_summary' then
      if not exists (
        select 1
        from public.documents
        where id = v_mapping.source_row_id
          and id = v_mapping.document_id
          and profile_id = p_profile_id
          and lifecycle_state = 'active'
          and upload_state = 'complete'
      ) then
        raise exception using message = 'report_evidence_mapping_source_invalid';
      end if;
    elsif v_mapping.source_kind = 'observation' then
      if not exists (
        select 1
        from public.observations
        where id = v_mapping.source_row_id
          and document_id = v_mapping.document_id
          and profile_id = p_profile_id
      ) then
        raise exception using message = 'report_evidence_mapping_source_invalid';
      end if;
    elsif v_mapping.source_kind = 'finding' then
      if not exists (
        select 1
        from public.document_extracted_findings
        where id = v_mapping.source_row_id
          and document_id = v_mapping.document_id
          and profile_id = p_profile_id
          and status in ('accepted', 'auto_accepted')
      ) then
        raise exception using message = 'report_evidence_mapping_source_invalid';
      end if;
    elsif v_mapping.source_kind = 'clinical_note' then
      if not exists (
        select 1
        from public.document_extracted_clinical_notes
        where id = v_mapping.source_row_id
          and document_id = v_mapping.document_id
          and profile_id = p_profile_id
          and status in ('accepted', 'auto_accepted')
          and is_published
      ) then
        raise exception using message = 'report_evidence_mapping_source_invalid';
      end if;
    elsif v_mapping.source_kind = 'prescription' then
      if not exists (
        select 1
        from public.document_extracted_prescriptions
        where id = v_mapping.source_row_id
          and document_id = v_mapping.document_id
          and profile_id = p_profile_id
          and status in ('accepted', 'auto_accepted')
          and is_published
      ) then
        raise exception using message = 'report_evidence_mapping_source_invalid';
      end if;
    elsif v_mapping.source_kind = 'referral' then
      if not exists (
        select 1
        from public.document_extracted_referrals
        where id = v_mapping.source_row_id
          and document_id = v_mapping.document_id
          and profile_id = p_profile_id
          and status in ('accepted', 'auto_accepted')
          and is_published
      ) then
        raise exception using message = 'report_evidence_mapping_source_invalid';
      end if;
    end if;
  end loop;

  insert into public.reports (
    profile_id,
    title,
    report_type,
    detail_level,
    document_ids,
    requested_scope_kind,
    requested_document_ids,
    actual_source_document_ids,
    source_scope_known,
    source_write_generations,
    abnormal_only,
    content,
    summary_preview,
    validation_status,
    validation_version,
    validation_issue_codes,
    invalidated_at,
    invalidation_reason,
    invalidated_by_deletion_operation_id
  )
  values (
    p_profile_id,
    left(p_title, 500),
    p_report_type,
    p_detail_level,
    p_actual_source_document_ids,
    p_requested_scope_kind,
    p_requested_document_ids,
    p_actual_source_document_ids,
    true,
    p_source_write_generations,
    coalesce(p_abnormal_only, false),
    p_content,
    p_summary_preview,
    p_validation_status,
    p_validation_version,
    p_validation_issue_codes,
    null,
    null,
    null
  )
  returning * into v_report;

  insert into public.report_evidence_sources (
    report_id,
    source_id,
    source_kind,
    source_row_id,
    document_id
  )
  select
    v_report.id,
    mappings.source_id,
    mappings.source_kind,
    mappings.source_row_id,
    mappings.document_id
  from jsonb_to_recordset(p_evidence_sources) as mappings(
    source_id text,
    source_kind text,
    source_row_id uuid,
    document_id uuid
  );

  return next v_report;
end;
$$;

create or replace function public.read_report_snapshot(
  p_profile_id uuid,
  p_report_id uuid
)
returns table (
  status text,
  report jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_document public.documents%rowtype;
  v_document_id uuid;
  v_document_ids uuid[];
  v_actual_source_document_ids uuid[];
  v_lock_document_ids uuid[];
  v_document_unavailable boolean := false;
begin
  select actual_source_document_ids, document_ids
  into v_actual_source_document_ids, v_document_ids
  from public.reports
  where id = p_report_id
    and profile_id = p_profile_id;

  if not found then
    return query select 'not_found'::text, null::jsonb;
    return;
  end if;

  v_lock_document_ids := coalesce(
    nullif(v_actual_source_document_ids, '{}'::uuid[]),
    v_document_ids
  );

  if v_lock_document_ids is null
    or cardinality(v_lock_document_ids) = 0 then
    for v_document_id in
      select id
      from public.documents
      where profile_id = p_profile_id
      order by id
    loop
      select *
      into v_document
      from public.documents
      where id = v_document_id
        and profile_id = p_profile_id
      for update;
    end loop;
  else
    for v_document_id in
      select ids.document_id
      from unnest(v_lock_document_ids) as ids(document_id)
      order by ids.document_id
    loop
      v_document := null;
      select *
      into v_document
      from public.documents
      where id = v_document_id
        and profile_id = p_profile_id
      for update;
      if v_document.id is null
        or v_document.lifecycle_state is distinct from 'active'
        or v_document.upload_state is distinct from 'complete' then
        v_document_unavailable := true;
      end if;
    end loop;
  end if;

  select *
  into v_report
  from public.reports
  where id = p_report_id
    and profile_id = p_profile_id
  for update;

  if not found then
    return query select 'not_found'::text, null::jsonb;
    return;
  end if;
  if v_report.invalidated_at is not null then
    return query select 'invalidated'::text, null::jsonb;
    return;
  end if;
  if v_document_unavailable then
    return query select 'document_unavailable'::text, null::jsonb;
    return;
  end if;

  return query select 'available'::text, to_jsonb(v_report);
end;
$$;

revoke all on function public.read_report_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_report_snapshot(uuid, uuid)
  to service_role;

revoke all on function public.create_validated_report(
  uuid,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[],
  jsonb,
  boolean,
  jsonb,
  text,
  text,
  text,
  text[],
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_validated_report(
  uuid,
  text,
  text,
  text,
  text,
  uuid[],
  uuid[],
  jsonb,
  boolean,
  jsonb,
  text,
  text,
  text,
  text[],
  jsonb
) to service_role;

notify pgrst, 'reload schema';
