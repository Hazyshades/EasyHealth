begin;

select plan(7);

select has_function(
  'public',
  'write_observation_normalization_revision_v2',
  array['uuid', 'jsonb', 'jsonb', 'text', 'uuid', 'text', 'uuid', 'text', 'text', 'uuid', 'uuid', 'text', 'boolean'],
  'EH-114 persists resolved and non-concrete glucose identities through the v2 writer'
);

create function public.eh114_observation_payload(
  p_profile_id uuid,
  p_document_id uuid,
  p_name text,
  p_value numeric,
  p_value_kind text,
  p_unit text,
  p_specimen text,
  p_modifier text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'profile_id', p_profile_id,
    'document_id', p_document_id,
    'name', p_name,
    'value', p_value,
    'value_kind', p_value_kind,
    'value_text', coalesce(p_value::text, 'Positive'),
    'unit', p_unit,
    'observed_at', '2026-07-30',
    'specimen', p_specimen,
    'modifier', p_modifier,
    'raw_name', p_name,
    'raw_value_text', coalesce(p_value::text, 'Positive'),
    'raw_unit', p_unit,
    'provenance_schema_version', '1'
  );
$$;

create function public.eh114_resolution_payload(
  p_result text,
  p_measurement_definition_key text,
  p_analyte_key text,
  p_normalized_unit text,
  p_unit_dimension text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'input_evidence_hash', 'eh114-test-evidence',
    'measurement_definition_key', p_measurement_definition_key,
    'analyte_key', p_analyte_key,
    'resolver_result', p_result,
    'mapping_confidence', case when p_result = 'resolved' then 0.95 else 0.7 end,
    'mapping_confidence_band', case when p_result = 'resolved' then 'high' else 'medium' end,
    'resolver_evidence', '[]'::jsonb,
    'normalized_unit', p_normalized_unit,
    'unit_dimension', p_unit_dimension,
    'catalog_manifest_version', '2026-07-30.0',
    'catalog_manifest_digest', 'eh114-test-digest',
    'resolver_version', '6',
    'normalization_version', '4'
  );
$$;

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000011401', 'eh114-owner@example.test'),
  ('00000000-0000-0000-0000-000000011402', 'eh114-reviewer@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values
  ('00000000-0000-0000-0000-000000011411', '00000000-0000-0000-0000-000000011401', 'eh114/glucose.pdf', 'glucose.pdf', 'completed');

insert into public.document_extracted_biomarkers (id, document_id, profile_id, biomarker_name, status)
values
  ('00000000-0000-0000-0000-000000011421', '00000000-0000-0000-0000-000000011411', '00000000-0000-0000-0000-000000011401', 'Post-prandial glucose', 'needs_review'),
  ('00000000-0000-0000-0000-000000011422', '00000000-0000-0000-0000-000000011411', '00000000-0000-0000-0000-000000011401', 'Urine glucose', 'needs_review'),
  ('00000000-0000-0000-0000-000000011423', '00000000-0000-0000-0000-000000011411', '00000000-0000-0000-0000-000000011401', 'Fasting glucose without timing', 'needs_review');

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000011421',
      public.eh114_observation_payload(
        '00000000-0000-0000-0000-000000011401',
        '00000000-0000-0000-0000-000000011411',
        'Post-prandial glucose', 6.9, 'numeric', 'mmol/L', 'plasma', 'post_prandial'
      ),
      public.eh114_resolution_payload('resolved', 'post_prandial_glucose_plasma', 'glucose', 'mmol/l', 'molar_concentration'),
      'acceptance', '00000000-0000-0000-0000-000000011402', repeat('1', 64),
      null, 'additive', null, null, null, 'eh114-test', true
    )
  $$,
  'post-prandial plasma glucose persists as its reviewed identity'
);

select ok(
  exists (
    select 1
    from public.observations
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000011421'
      and measurement_definition_key = 'post_prandial_glucose_plasma'
      and analyte_key = 'glucose'
      and resolution_status = 'resolved'
      and specimen = 'plasma'
      and modifier = 'post_prandial'
  ),
  'post-prandial persistence keeps the concrete identity and source context'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000011422',
      public.eh114_observation_payload(
        '00000000-0000-0000-0000-000000011401',
        '00000000-0000-0000-0000-000000011411',
        'Urine glucose', null, 'qualitative', null, 'urine', 'none'
      ),
      public.eh114_resolution_payload('resolved', 'glucose_urine_dipstick', 'glucose', null, null),
      'acceptance', '00000000-0000-0000-0000-000000011402', repeat('2', 64),
      null, 'additive', null, null, null, 'eh114-test', true
    )
  $$,
  'qualitative urine dipstick glucose persists without a numeric unit'
);

select ok(
  exists (
    select 1
    from public.observations
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000011422'
      and measurement_definition_key = 'glucose_urine_dipstick'
      and value_kind = 'qualitative'
      and unit is null
      and specimen = 'urine'
  ),
  'urine dipstick persistence remains qualitative and unitless'
);

select lives_ok(
  $$
    select public.write_observation_normalization_revision_v2(
      '00000000-0000-0000-0000-000000011423',
      public.eh114_observation_payload(
        '00000000-0000-0000-0000-000000011401',
        '00000000-0000-0000-0000-000000011411',
        'Fasting glucose', 4.7, 'numeric', 'mmol/L', 'plasma', 'none'
      ),
      public.eh114_resolution_payload('partial', null, null, 'mmol/l', 'molar_concentration'),
      'acceptance', '00000000-0000-0000-0000-000000011402', repeat('3', 64),
      null, 'additive', null, null, null, 'eh114-test', false
    )
  $$,
  'missing timing persists only the raw fasting glucose evidence'
);

select ok(
  exists (
    select 1
    from public.observations
    where source_extracted_biomarker_id = '00000000-0000-0000-0000-000000011423'
      and resolution_status = 'partial'
      and measurement_definition_key is null
      and analyte_key is null
      and verification_status = 'pending'
  ),
  'missing timing never persists a fabricated fasting or post-prandial identity'
);

select * from finish();
rollback;
