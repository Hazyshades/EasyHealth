begin;

select plan(26);

-- ── contract function exists and is usable by the writer role ──
select ok(
  to_regprocedure('public.eh118_is_source_region(jsonb)') is not null,
  'source region contract function exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.eh118_is_source_region(jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can evaluate the source region contract'
);

-- ── contract semantics ──
select ok(
  public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":2,"x":0.1,"y":0.2,"w":0.3,"h":0.05,"origin":"ocr_exact"}'::jsonb
  ),
  'a normalized region with a 1-based page is accepted'
);

select ok(
  not public.eh118_is_source_region('null'::jsonb),
  'JSON null is not a region'
);

select ok(
  not public.eh118_is_source_region('[]'::jsonb),
  'an array is not a region'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":2,"space":"normalized","page":1,"x":0.1,"y":0.1,"w":0.1,"h":0.1,"origin":"ocr_exact"}'::jsonb
  ),
  'an unknown schema version is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"pixel","page":1,"x":0.1,"y":0.1,"w":0.1,"h":0.1,"origin":"ocr_exact"}'::jsonb
  ),
  'a non-normalized coordinate space is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":1,"x":0.1,"y":0.1,"w":0.1,"h":0.1,"origin":"guess"}'::jsonb
  ),
  'an unknown region origin is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":0,"x":0.1,"y":0.1,"w":0.1,"h":0.1,"origin":"ocr_exact"}'::jsonb
  ),
  'page zero is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":"1","x":0.1,"y":0.1,"w":0.1,"h":0.1,"origin":"ocr_exact"}'::jsonb
  ),
  'a string page is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":1,"x":120,"y":340,"w":220,"h":18,"origin":"model"}'::jsonb
  ),
  'a pixel-space rectangle is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":1,"x":0.9,"y":0.1,"w":0.5,"h":0.1,"origin":"ocr_exact"}'::jsonb
  ),
  'a rectangle overflowing the page is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":1,"x":0.1,"y":0.1,"w":0,"h":0.1,"origin":"ocr_exact"}'::jsonb
  ),
  'a zero-width rectangle is rejected'
);

-- ── fixtures ──
insert into public.profiles (id, email)
values ('20000000-0000-0000-0000-000000000001', 'eh118-owner@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type, page_count)
values (
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000001',
  'eh118/report.pdf',
  'report.pdf',
  'processing',
  'lab_result',
  3
);

-- ── extracted rows carry the same contract ──
select lives_ok(
  $$
    insert into public.document_extracted_biomarkers
      (id, document_id, profile_id, biomarker_name, value_numeric, unit, source_page, source_text, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000020',
      '20000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000001',
      'Glucose', 5.4, 'mmol/L', 2, 'Glucose 5.4 mmol/L',
      '{"schema_version":1,"space":"normalized","page":2,"x":0.1,"y":0.2,"w":0.3,"h":0.02,"origin":"ocr_exact"}'::jsonb
    )
  $$,
  'an extracted row accepts a contract-valid region on its own page'
);

select lives_ok(
  $$
    insert into public.document_extracted_biomarkers
      (id, document_id, profile_id, biomarker_name, value_numeric, unit, source_page, source_text, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000001',
      'Sodium', 140, 'mmol/L', 3, 'Sodium 140 mmol/L', null
    )
  $$,
  'page-only provenance is a valid extracted row'
);

select throws_ok(
  $$
    insert into public.document_extracted_biomarkers
      (document_id, profile_id, biomarker_name, value_numeric, unit, source_page, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000001',
      'Ferritin', 45, 'ng/mL', 2,
      '{"x":10,"y":20,"w":30,"h":40}'::jsonb
    )
  $$,
  '23514',
  null,
  'a free-form model rectangle is rejected on extracted rows'
);

select throws_ok(
  $$
    insert into public.document_extracted_biomarkers
      (document_id, profile_id, biomarker_name, value_numeric, unit, source_page, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000001',
      'Ferritin', 45, 'ng/mL', 2,
      '{"schema_version":1,"space":"normalized","page":3,"x":0.1,"y":0.2,"w":0.3,"h":0.02,"origin":"ocr_exact"}'::jsonb
    )
  $$,
  '23514',
  null,
  'a region measured on another page cannot be attached to this row'
);

select throws_ok(
  $$
    insert into public.document_extracted_biomarkers
      (document_id, profile_id, biomarker_name, value_numeric, unit, source_page)
    values (
      '20000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000001',
      'Ferritin', 45, 'ng/mL', 0
    )
  $$,
  '23514',
  null,
  'a zero page index is rejected on extracted rows'
);

-- ── observations ──
select lives_ok(
  $$
    insert into public.observations
      (id, profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page, source_text, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000030',
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000010',
      'Glucose', 5.4, 'mmol/L', '2026-07-20', 'lab', 'numeric',
      '20000000-0000-0000-0000-000000000020', 2, 'Glucose 5.4 mmol/L',
      '{"schema_version":1,"space":"normalized","page":2,"x":0.1,"y":0.2,"w":0.3,"h":0.02,"origin":"ocr_exact"}'::jsonb
    )
  $$,
  'an accepted observation stores page and region provenance'
);

select lives_ok(
  $$
    insert into public.observations
      (id, profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000031',
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000010',
      'Sodium', 140, 'mmol/L', '2026-07-20', 'lab', 'numeric',
      '20000000-0000-0000-0000-000000000021', 3, null
    )
  $$,
  'an observation without a region still links to its source page'
);

select throws_ok(
  $$
    insert into public.observations
      (profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page)
    values (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000010',
      'Ferritin', 45, 'ng/mL', '2026-07-20', 'lab', 'numeric',
      '20000000-0000-0000-0000-000000000021', null
    )
  $$,
  '23514',
  null,
  'a document-sourced observation must link to a source page'
);

select throws_ok(
  $$
    insert into public.observations
      (profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page, bounding_box)
    values (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000010',
      'Ferritin', 45, 'ng/mL', '2026-07-20', 'lab', 'numeric',
      '20000000-0000-0000-0000-000000000021', 2,
      '{"schema_version":1,"space":"normalized","page":1,"x":0.1,"y":0.2,"w":0.3,"h":0.02,"origin":"ocr_exact"}'::jsonb
    )
  $$,
  '23514',
  null,
  'an observation region must belong to the recorded source page'
);

select lives_ok(
  $$
    insert into public.observations
      (profile_id, name, value, unit, observed_at, observation_kind, value_kind, source_page)
    values (
      '20000000-0000-0000-0000-000000000001',
      'Manual weight', 70, 'kg', '2026-07-20', 'lab', 'numeric', null
    )
  $$,
  'an observation with no document source is not forced to carry a page'
);

-- ── provenance stays write-once ──
select throws_ok(
  $$
    update public.observations
      set bounding_box = '{"schema_version":1,"space":"normalized","page":2,"x":0.5,"y":0.5,"w":0.1,"h":0.01,"origin":"model"}'::jsonb
      where id = '20000000-0000-0000-0000-000000000030'
  $$,
  'P0001',
  'Observation provenance is write-once; raw, source, and version fields cannot be mutated after creation.',
  'a stored region cannot be overwritten later'
);

select lives_ok(
  $$
    update public.observations
      set bounding_box = '{"schema_version":1,"space":"normalized","page":3,"x":0.5,"y":0.5,"w":0.1,"h":0.01,"origin":"ocr_fuzzy"}'::jsonb
      where id = '20000000-0000-0000-0000-000000000031'
  $$,
  'a first region may still be written onto page-only provenance'
);

select is(
  (
    select bounding_box ->> 'origin'
    from public.observations
    where id = '20000000-0000-0000-0000-000000000031'
  ),
  'ocr_fuzzy',
  'the first region write is persisted'
);

select * from finish();

rollback;
