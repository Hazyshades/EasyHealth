begin;

select plan(25);

select ok(
  has_table_privilege('service_role', 'public.document_pages', 'select'),
  'service_role can read staged document pages'
);
select ok(
  has_table_privilege('service_role', 'public.ai_invocations', 'insert'),
  'service_role can write OCR-safe invocation telemetry'
);
select ok(
  not has_table_privilege('anon', 'public.document_pages', 'select'),
  'anon cannot read document pages'
);
select ok(
  not has_table_privilege('anon', 'public.ai_invocations', 'select'),
  'anon cannot read invocation telemetry'
);
select ok(
  has_table_privilege('service_role', 'public.ai_provider_model_checks', 'select'),
  'service_role can read Mistral model readiness evidence'
);
select ok(
  has_table_privilege('service_role', 'public.ai_provider_model_checks', 'insert'),
  'service_role can write Mistral model readiness evidence'
);
select ok(
  not has_table_privilege('anon', 'public.ai_provider_model_checks', 'select'),
  'anon cannot read Mistral model readiness evidence'
);
select ok(
  not has_table_privilege('service_role', 'public.ai_provider_model_checks', 'update'),
  'readiness evidence does not grant service-role updates'
);
select ok(
  not has_table_privilege('service_role', 'public.ai_provider_model_checks', 'delete'),
  'readiness evidence does not grant service-role deletes'
);

insert into public.ai_provider_model_checks (
  provider,
  region,
  requested_model,
  model_present,
  success,
  error_code,
  latency_ms,
  worker_instance_id,
  adapter_version,
  checked_at
)
values (
  'mistral',
  'eu',
  'mistral-ocr-latest',
  true,
  true,
  null,
  123,
  'eh163-test-worker',
  'eh163-1',
  '2026-08-19T00:00:00Z'
);
select is(
  (select requested_model from public.ai_provider_model_checks limit 1),
  'mistral-ocr-latest',
  'readiness evidence stores the requested model without a raw catalog'
);
select throws_ok(
  $$
    update public.ai_provider_model_checks
    set success = false
    where requested_model = 'mistral-ocr-latest';
  $$,
  'P0001',
  'ai_provider_model_checks_append_only',
  'readiness evidence rejects updates'
);
select throws_ok(
  $$
    delete from public.ai_provider_model_checks
    where requested_model = 'mistral-ocr-latest';
  $$,
  'P0001',
  'ai_provider_model_checks_append_only',
  'readiness evidence rejects deletes'
);

insert into public.profiles (id, email)
values ('16300000-0000-0000-0000-000000000001', 'eh163-publication@example.test');

insert into public.documents (
  id, profile_id, storage_path, original_filename, status, document_type,
  page_count, processing_status, write_generation
)
values (
  '16300000-0000-0000-0000-000000000010',
  '16300000-0000-0000-0000-000000000001',
  'eh163/original.pdf',
  'original.pdf',
  'processing',
  'lab_result',
  2,
  'processing',
  0
);

insert into public.document_processing_jobs (
  id, document_id, profile_id, job_type, status, attempts, max_attempts
)
values (
  '16300000-0000-0000-0000-000000000020',
  '16300000-0000-0000-0000-000000000010',
  '16300000-0000-0000-0000-000000000001',
  'extract',
  'processing',
  1,
  3
);

insert into public.document_processing_attempts (
  id, job_id, document_id, profile_id, attempt_number,
  captured_write_generation, state
)
values (
  '16300000-0000-0000-0000-000000000030',
  '16300000-0000-0000-0000-000000000020',
  '16300000-0000-0000-0000-000000000010',
  '16300000-0000-0000-0000-000000000001',
  1,
  0,
  'active'
);

insert into public.document_pages (
  id, document_id, profile_id, page_number, width, height,
  preview_storage_path, processing_attempt_id, is_current
)
values
  (
    '16300000-0000-0000-0000-000000000041',
    '16300000-0000-0000-0000-000000000010',
    '16300000-0000-0000-0000-000000000001',
    1,
    1000,
    1400,
    'eh163/old/page-1.webp',
    null,
    true
  ),
  (
    '16300000-0000-0000-0000-000000000042',
    '16300000-0000-0000-0000-000000000010',
    '16300000-0000-0000-0000-000000000001',
    2,
    1000,
    1400,
    'eh163/old/page-2.webp',
    null,
    true
  ),
  (
    '16300000-0000-0000-0000-000000000043',
    '16300000-0000-0000-0000-000000000010',
    '16300000-0000-0000-0000-000000000001',
    1,
    1000,
    1400,
    'eh163/attempt/page-1.webp',
    '16300000-0000-0000-0000-000000000030',
    false
  ),
  (
    '16300000-0000-0000-0000-000000000044',
    '16300000-0000-0000-0000-000000000010',
    '16300000-0000-0000-0000-000000000001',
    2,
    1000,
    1400,
    'eh163/attempt/page-2.webp',
    '16300000-0000-0000-0000-000000000030',
    false
  );

insert into public.document_extracted_clinical_notes (
  id, document_id, profile_id, status, processing_attempt_id, is_published
)
values
  (
    '16300000-0000-0000-0000-000000000051',
    '16300000-0000-0000-0000-000000000010',
    '16300000-0000-0000-0000-000000000001',
    'accepted',
    null,
    true
  ),
  (
    '16300000-0000-0000-0000-000000000052',
    '16300000-0000-0000-0000-000000000010',
    '16300000-0000-0000-0000-000000000001',
    'accepted',
    '16300000-0000-0000-0000-000000000030',
    false
  );

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, processing_attempt_id,
  record_status, is_current, is_published, source_text_origin,
  ocr_provider, ocr_model, ocr_adapter_version, ocr_artifact_schema_version,
  ocr_source_sha256
)
values (
  '16300000-0000-0000-0000-000000000061',
  '16300000-0000-0000-0000-000000000010',
  '16300000-0000-0000-0000-000000000001',
  'Glucose',
  '16300000-0000-0000-0000-000000000030',
  'active',
  true,
  false,
  'mistral_ocr',
  'mistral',
  'mistral-ocr-latest',
  'eh163-1',
  2,
  repeat('a', 64)
);

update public.document_processing_attempts
set state = 'completed', terminal_at = now()
where id = '16300000-0000-0000-0000-000000000030';

select is(
  (select count(*)::integer from public.document_pages where document_id = '16300000-0000-0000-0000-000000000010' and is_current),
  2,
  'successful completion exposes exactly the staged page set'
);
select is(
  (select count(*)::integer from public.document_pages where document_id = '16300000-0000-0000-0000-000000000010' and processing_attempt_id = '16300000-0000-0000-0000-000000000030' and is_current),
  2,
  'successful completion promotes staged pages'
);
select is(
  (select count(*)::integer from public.document_pages where document_id = '16300000-0000-0000-0000-000000000010' and processing_attempt_id is null and is_current),
  0,
  'successful completion retires the previous page set'
);
select is(
  (select preview_storage_path from public.document_pages where id = '16300000-0000-0000-0000-000000000043'),
  'eh163/attempt/page-1.webp',
  'published page keeps immutable attempt storage path'
);
select is(
  (select is_published from public.document_extracted_biomarkers where id = '16300000-0000-0000-0000-000000000061'),
  true,
  'successful completion publishes staged laboratory evidence'
);
select is(
  (select is_published from public.document_extracted_clinical_notes where id = '16300000-0000-0000-0000-000000000051'),
  false,
  'successful completion retires prior typed evidence'
);
select is(
  (select is_published from public.document_extracted_clinical_notes where id = '16300000-0000-0000-0000-000000000052'),
  true,
  'successful completion publishes staged typed evidence'
);

insert into public.documents (
  id, profile_id, storage_path, original_filename, status, document_type,
  page_count, processing_status, write_generation
)
values (
  '16300000-0000-0000-0000-000000000110',
  '16300000-0000-0000-0000-000000000001',
  'eh163/failure.pdf',
  'failure.pdf',
  'processing',
  'lab_result',
  1,
  'processing',
  0
);
insert into public.document_processing_jobs (
  id, document_id, profile_id, job_type, status, attempts, max_attempts
)
values (
  '16300000-0000-0000-0000-000000000120',
  '16300000-0000-0000-0000-000000000110',
  '16300000-0000-0000-0000-000000000001',
  'extract',
  'processing',
  1,
  3
);
insert into public.document_processing_attempts (
  id, job_id, document_id, profile_id, attempt_number,
  captured_write_generation, state
)
values (
  '16300000-0000-0000-0000-000000000130',
  '16300000-0000-0000-0000-000000000120',
  '16300000-0000-0000-0000-000000000110',
  '16300000-0000-0000-0000-000000000001',
  1,
  0,
  'active'
);
insert into public.document_pages (
  id, document_id, profile_id, page_number, preview_storage_path,
  processing_attempt_id, is_current
)
values
  (
    '16300000-0000-0000-0000-000000000141',
    '16300000-0000-0000-0000-000000000110',
    '16300000-0000-0000-0000-000000000001',
    1,
    'eh163/failure/old-page.webp',
    null,
    true
  ),
  (
    '16300000-0000-0000-0000-000000000142',
    '16300000-0000-0000-0000-000000000110',
    '16300000-0000-0000-0000-000000000001',
    1,
    'eh163/failure/staged-page.webp',
    '16300000-0000-0000-0000-000000000130',
    false
  );
insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, processing_attempt_id,
  record_status, is_current, is_published
)
values (
  '16300000-0000-0000-0000-000000000151',
  '16300000-0000-0000-0000-000000000110',
  '16300000-0000-0000-0000-000000000001',
  'Hemoglobin',
  '16300000-0000-0000-0000-000000000130',
  'active',
  true,
  false
);

update public.document_processing_attempts
set state = 'failed', terminal_at = now(), terminal_reason = 'ocr_timeout'
where id = '16300000-0000-0000-0000-000000000130';

select is(
  (select is_current from public.document_pages where id = '16300000-0000-0000-0000-000000000141'),
  true,
  'failed completion keeps prior pages current'
);
select is(
  (select is_current from public.document_pages where id = '16300000-0000-0000-0000-000000000142'),
  false,
  'failed completion keeps staged pages non-current'
);
select is(
  (select is_published from public.document_extracted_biomarkers where id = '16300000-0000-0000-0000-000000000151'),
  false,
  'failed completion keeps staged laboratory evidence hidden'
);

insert into public.documents (
  id, profile_id, storage_path, original_filename, status, document_type,
  page_count, processing_status, write_generation
)
values (
  '16300000-0000-0000-0000-000000000210',
  '16300000-0000-0000-0000-000000000001',
  'eh163/partial.pdf',
  'partial.pdf',
  'processing',
  'lab_result',
  2,
  'processing',
  0
);
insert into public.document_processing_jobs (
  id, document_id, profile_id, job_type, status, attempts, max_attempts
)
values (
  '16300000-0000-0000-0000-000000000220',
  '16300000-0000-0000-0000-000000000210',
  '16300000-0000-0000-0000-000000000001',
  'extract',
  'processing',
  1,
  3
);
insert into public.document_processing_attempts (
  id, job_id, document_id, profile_id, attempt_number,
  captured_write_generation, state
)
values (
  '16300000-0000-0000-0000-000000000230',
  '16300000-0000-0000-0000-000000000220',
  '16300000-0000-0000-0000-000000000210',
  '16300000-0000-0000-0000-000000000001',
  1,
  0,
  'active'
);
insert into public.document_pages (
  id, document_id, profile_id, page_number, preview_storage_path,
  processing_attempt_id, is_current
)
values (
  '16300000-0000-0000-0000-000000000241',
  '16300000-0000-0000-0000-000000000210',
  '16300000-0000-0000-0000-000000000001',
  1,
  'eh163/partial/old-page.webp',
  null,
  true
), (
  '16300000-0000-0000-0000-000000000242',
  '16300000-0000-0000-0000-000000000210',
  '16300000-0000-0000-0000-000000000001',
  1,
  'eh163/partial/staged-page.webp',
  '16300000-0000-0000-0000-000000000230',
  false
);

select throws_ok(
  $$
    update public.document_processing_attempts
    set state = 'completed', terminal_at = now()
    where id = '16300000-0000-0000-0000-000000000230';
  $$,
  'P0001',
  'eh163_page_set_incomplete',
  'partial staged page set cannot be published'
);
select is(
  (select state from public.document_processing_attempts where id = '16300000-0000-0000-0000-000000000230'),
  'active',
  'failed publication rolls the attempt transition back to active'
);
select is(
  (select is_current from public.document_pages where id = '16300000-0000-0000-0000-000000000241'),
  true,
  'partial publication leaves the prior page current'
);

select * from finish();
rollback;
