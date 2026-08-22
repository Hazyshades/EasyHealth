begin;

select plan(17);

-- ── function and canonical payload contract ──
select ok(
  to_regprocedure('public.eh118_is_source_region(jsonb)') is not null,
  'EH-162 source region contract function exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.eh118_is_source_region(jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can evaluate the EH-162 source region contract'
);

select ok(
  public.eh118_is_source_region(
    '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.05}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
  ),
  'canonical exact region is accepted'
);

select ok(
  public.eh118_is_source_region(
    '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.05}],"match":{"strategy":"fuzzy","score":0.7,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
  ),
  'canonical fuzzy evidence remains persistable for page-only fallback'
);

select ok(
  public.eh118_is_source_region(
    '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[],"match":{"strategy":"ambiguous","score":0.4,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
  ),
  'canonical ambiguous evidence may persist without rectangles'
);

select ok(
  public.eh118_is_source_region(
    '{"schema_version":1,"space":"normalized","page":2,"x":0.1,"y":0.2,"w":0.3,"h":0.05,"origin":"ocr_exact"}'::jsonb
  ),
  'legacy EH-118 geometry remains readable'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.05}],"match":{"strategy":"guess","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
  ),
  'unknown match strategy is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.05}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
    - 'match'
  ),
  'a canonical payload without match metadata is rejected'
);

select ok(
  not public.eh118_is_source_region(
    '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":120,"h":18}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
  ),
  'pixel-sized canonical rectangles are rejected'
);

-- ── disposable synthetic fixtures ──
insert into public.profiles (id, email)
values ('62000000-0000-0000-0000-000000000001', 'eh162-owner@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status, document_type, page_count)
values (
  '62000000-0000-0000-0000-000000000010',
  '62000000-0000-0000-0000-000000000001',
  'eh162/report.pdf',
  'eh162-report.pdf',
  'processing',
  'lab_result',
  3
);

select lives_ok(
  $$
    insert into public.document_extracted_biomarkers
      (id, document_id, profile_id, biomarker_name, value_numeric, unit, source_page, source_text, bounding_box)
    values (
      '62000000-0000-0000-0000-000000000020',
      '62000000-0000-0000-0000-000000000010',
      '62000000-0000-0000-0000-000000000001',
      'Glucose', 5.4, 'mmol/L', 2, 'Glucose 5.4 mmol/L',
      '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.02}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
    )
  $$,
  'a canonical exact region can be stored on an extracted row'
);

select lives_ok(
  $$
    insert into public.document_extracted_biomarkers
      (id, document_id, profile_id, biomarker_name, value_numeric, unit, source_page, source_text)
    values (
      '62000000-0000-0000-0000-000000000021',
      '62000000-0000-0000-0000-000000000010',
      '62000000-0000-0000-0000-000000000001',
      'Sodium', 140, 'mmol/L', 3, 'Sodium 140 mmol/L'
    )
  $$,
  'page-only extracted provenance remains valid'
);

select throws_ok(
  $$
    insert into public.document_extracted_biomarkers
      (id, document_id, profile_id, biomarker_name, value_numeric, unit, source_page, source_text, bounding_box)
    values (
      '62000000-0000-0000-0000-000000000022',
      '62000000-0000-0000-0000-000000000010',
      '62000000-0000-0000-0000-000000000001',
      'Ferritin', 45, 'ng/mL', 2, 'Ferritin 45 ng/mL',
      '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":3,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.02}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
    )
  $$,
  '23514',
  null,
  'a canonical region measured on another page is rejected'
);

select lives_ok(
  $$
    insert into public.observations
      (id, profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page, source_text, bounding_box)
    values (
      '62000000-0000-0000-0000-000000000030',
      '62000000-0000-0000-0000-000000000001',
      '62000000-0000-0000-0000-000000000010',
      'Glucose', 5.4, 'mmol/L', '2026-08-15', 'lab', 'numeric',
      '62000000-0000-0000-0000-000000000020', 2, 'Glucose 5.4 mmol/L',
      '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.02}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
    )
  $$,
  'an accepted observation stores canonical exact provenance'
);

select throws_ok(
  $$
    insert into public.observations
      (id, profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page, source_text, bounding_box)
    values (
      '62000000-0000-0000-0000-000000000031',
      '62000000-0000-0000-0000-000000000001',
      '62000000-0000-0000-0000-000000000010',
      'Ferritin', 45, 'ng/mL', '2026-08-15', 'lab', 'numeric',
      '62000000-0000-0000-0000-000000000021', 2, 'Ferritin 45 ng/mL',
      '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":1,"rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.02}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
    )
  $$,
  '23514',
  null,
  'an observation region must belong to the recorded page'
);

select throws_ok(
  $$
    insert into public.observations
      (id, profile_id, document_id, name, value, unit, observed_at, observation_kind, value_kind,
       source_extracted_biomarker_id, source_page)
    values (
      '62000000-0000-0000-0000-000000000032',
      '62000000-0000-0000-0000-000000000001',
      '62000000-0000-0000-0000-000000000010',
      'Ferritin', 45, 'ng/mL', '2026-08-15', 'lab', 'numeric',
      '62000000-0000-0000-0000-000000000021', null
    )
  $$,
  '23514',
  null,
  'a document-sourced observation must link to a source page'
);

select lives_ok(
  $$
    insert into public.observations
      (id, profile_id, name, value, unit, observed_at, observation_kind, value_kind, source_page)
    values (
      '62000000-0000-0000-0000-000000000033',
      '62000000-0000-0000-0000-000000000001',
      'Manual weight', 70, 'kg', '2026-08-15', 'lab', 'numeric', null
    )
  $$,
  'an observation without a document source is not forced to carry a page'
);

select throws_ok(
  $$
    update public.observations
      set bounding_box = '{"schema_version":1,"coordinate_space":"normalized","origin":"top-left","page":2,"rects":[{"x":0.5,"y":0.5,"w":0.1,"h":0.01}],"match":{"strategy":"exact","score":1,"engine":"pdf-text-bbox","resolver_version":"1"}}'::jsonb
      where id = '62000000-0000-0000-0000-000000000030'
  $$,
  'P0001',
  'Observation provenance is write-once; raw, source, and version fields cannot be mutated after creation.',
  'a stored canonical region cannot be overwritten later'
);

select * from finish();

rollback;
