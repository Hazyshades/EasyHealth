begin;

select no_plan();

-- ── schema, grants, and guards ────────────────────────────────────────────────
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_extracted_biomarkers'
      and column_name in (
        'record_status', 'lifecycle_reason_code', 'lifecycle_request_hash',
        'superseded_by_processing_attempt_id', 'processing_attempt_id'
      )
    group by table_schema, table_name
    having count(*) = 5
  ),
  'EH-120 adds all source lifecycle columns'
);

select ok(
  to_regprocedure('public.eh120_reject_document_extracted_biomarker(uuid,uuid,timestamptz,uuid,text,text)') is not null,
  'owner rejection transition procedure exists'
);
select ok(
  to_regprocedure('public.eh120_supersede_document_extracted_biomarkers(uuid,uuid,uuid,text)') is not null,
  'service supersession transition procedure exists'
);
select ok(
  to_regprocedure('public.eh120_write_automatic_verification_v2(uuid,jsonb,jsonb,text,uuid,text,boolean,boolean,jsonb)') is not null,
  'automatic verification writer procedure exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh120_reject_document_extracted_biomarker(uuid,uuid,timestamptz,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute owner rejection'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh120_reject_document_extracted_biomarker(uuid,uuid,timestamptz,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute owner rejection'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh120_supersede_document_extracted_biomarkers(uuid,uuid,uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute supersession'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.eh120_supersede_document_extracted_biomarkers(uuid,uuid,uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute supersession'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh120_write_automatic_verification_v2(uuid,jsonb,jsonb,text,uuid,text,boolean,boolean,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can execute automatic verification writer'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh120_write_automatic_verification_v2(uuid,jsonb,jsonb,text,uuid,text,boolean,boolean,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute automatic verification writer'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.document_extracted_biomarkers'::regclass
      and tgname = 'eh120_source_lifecycle_write_guard'
      and not tgisinternal
  ),
  'direct source lifecycle guard is attached'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.observation_normalization_revisions'::regclass
      and tgname = 'eh120_automatic_verification_writer_guard'
      and not tgisinternal
  ),
  'automatic verification writer guard is attached'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.document_extracted_biomarkers'::regclass
      and tgname = 'eh120_capture_lifecycle_transition'
      and not tgisinternal
  ),
  'lifecycle event capture trigger is attached'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.document_extracted_biomarkers'::regclass
      and conname = 'document_extracted_biomarkers_record_lineage_check'
  ),
  'source lineage constraint is present'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.observation_change_events'::regclass
      and conname = 'observation_change_events_reason_code_check'
  ),
  'ledger reason-code constraint is present'
);

-- ── deterministic synthetic fixtures ─────────────────────────────────────────
insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000001001', 'eh120-owner@example.test'),
  ('00000000-0000-0000-0000-000000001002', 'eh120-foreign@example.test');

insert into public.documents (id, profile_id, storage_path, original_filename, status)
values
  ('00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000001001', 'eh120/reject.pdf', 'reject.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000001001', 'eh120/supersede.pdf', 'supersede.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000001012', '00000000-0000-0000-0000-000000001001', 'eh120/foreign.pdf', 'foreign.pdf', 'completed'),
  ('00000000-0000-0000-0000-000000001013', '00000000-0000-0000-0000-000000001002', 'eh120/auto.pdf', 'auto.pdf', 'completed');

insert into public.document_processing_jobs (
  id, document_id, profile_id, job_type, status, attempts, max_attempts, started_at, finished_at
)
values
  ('00000000-0000-0000-0000-000000001020', '00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000001001', 'document', 'completed', 1, 3, now(), now()),
  ('00000000-0000-0000-0000-000000001021', '00000000-0000-0000-0000-000000001012', '00000000-0000-0000-0000-000000001001', 'document', 'completed', 1, 3, now(), now());

insert into public.document_processing_attempts (
  id, job_id, document_id, profile_id, attempt_number, captured_write_generation,
  state, terminal_at
)
values
  ('00000000-0000-0000-0000-000000001030', '00000000-0000-0000-0000-000000001020', '00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000001001', 1, 0, 'completed', now()),
  ('00000000-0000-0000-0000-000000001031', '00000000-0000-0000-0000-000000001021', '00000000-0000-0000-0000-000000001012', '00000000-0000-0000-0000-000000001001', 1, 0, 'completed', now());

insert into public.document_extracted_biomarkers (
  id, document_id, profile_id, biomarker_name, status, resolver_result, resolution_status, created_at
)
values
  ('00000000-0000-0000-0000-000000001100', '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000001001', 'Reject source', 'needs_review', 'resolved', 'resolved', '2026-08-13 10:00:00+00'),
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000001001', 'Invalid reason source', 'needs_review', 'partial', 'partial', '2026-08-13 10:01:00+00'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000001001', 'Stale source', 'needs_review', 'partial', 'partial', '2026-08-13 10:02:00+00'),
  ('00000000-0000-0000-0000-000000001110', '00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000001001', 'Supersede source', 'needs_review', 'resolved', 'resolved', '2026-08-13 10:03:00+00'),
  ('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000001011', '00000000-0000-0000-0000-000000001001', 'Protected source', 'accepted', 'resolved', 'resolved', '2026-08-13 10:04:00+00'),
  ('00000000-0000-0000-0000-000000001120', '00000000-0000-0000-0000-000000001012', '00000000-0000-0000-0000-000000001002', 'Foreign source', 'needs_review', 'resolved', 'resolved', '2026-08-13 10:05:00+00'),
  ('00000000-0000-0000-0000-000000001130', '00000000-0000-0000-0000-000000001013', '00000000-0000-0000-0000-000000001002', 'Automatic source', 'needs_review', 'resolved', 'resolved', '2026-08-13 10:06:00+00');

insert into public.observations (
  id, profile_id, document_id, source_extracted_biomarker_id,
  name, value, unit, observed_at, observation_kind, source_page
)
values
  ('00000000-0000-0000-0000-000000001200', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000001100', 'Reject source observation', 1, 'mg/dL', '2026-08-13', 'lab', 1);

insert into public.observation_normalization_revisions (
  id, extracted_biomarker_id, observation_id, input_evidence_hash,
  measurement_definition_key, analyte_key, resolver_result, mapping_confidence,
  mapping_confidence_band, catalog_manifest_version, catalog_manifest_digest,
  resolver_version, normalization_version, verification_status,
  verification_decided_at, verification_actor_type, verification_actor_id,
  is_active
)
values
  ('00000000-0000-0000-0000-000000001210', '00000000-0000-0000-0000-000000001100', '00000000-0000-0000-0000-000000001200', repeat('a', 64), 'glucose_serum_fasting', 'glucose', 'resolved', 0.98, 'high', 'eh120', 'eh120', 'eh120', 'eh120', 'pending', null, null, null, true),
  ('00000000-0000-0000-0000-000000001211', '00000000-0000-0000-0000-000000001111', null, repeat('b', 64), 'glucose_serum_fasting', 'glucose', 'resolved', 0.98, 'high', 'eh120', 'eh120', 'eh120', 'eh120', 'user_verified', now(), 'user', '00000000-0000-0000-0000-000000001001', true);

select is(
  (select count(*)::bigint from public.eh120_record_lifecycle_preflight()),
  0::bigint,
  'valid synthetic lifecycle fixtures pass preflight'
);

-- ── direct-write denial ───────────────────────────────────────────────────────
select throws_ok(
  $$
    update public.document_extracted_biomarkers
    set record_status = 'rejected', lifecycle_reason_code = 'other'
    where id = '00000000-0000-0000-0000-000000001101'
  $$,
  'P0001',
  'eh120_lifecycle_transition_required',
  'ordinary source status updates require the trusted transition seam'
);
select throws_ok(
  $$
    update public.document_extracted_biomarkers
    set is_current = false, superseded_at = now(), record_status = 'superseded', lifecycle_reason_code = 'document_reprocessed'
    where id = '00000000-0000-0000-0000-000000001101'
  $$,
  'P0001',
  'eh120_lifecycle_transition_required',
  'ordinary source lineage updates require the trusted transition seam'
);

-- ── owner rejection: reason, ownership, CAS, terminal state, idempotency ────
select lives_ok(
  $$
    select * from public.eh120_reject_document_extracted_biomarker(
      '00000000-0000-0000-0000-000000001100',
      '00000000-0000-0000-0000-000000001001',
      '2026-08-13 10:00:00+00',
      '00000000-0000-0000-0000-000000001210',
      'incorrect_extraction',
      repeat('c', 64)
    )
  $$,
  'owner rejection commits through the service procedure'
);
select is(
  (select record_status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001100'),
  'rejected'::text,
  'owner rejection changes only the lifecycle axis'
);
select is(
  (select verification_status from public.observation_normalization_revisions where id = '00000000-0000-0000-0000-000000001210'),
  'pending'::text,
  'owner rejection preserves the active revision decision'
);
select throws_ok(
  $$
    update public.document_extracted_biomarkers
    set status = 'accepted', verification_status = 'user_verified'
    where id = '00000000-0000-0000-0000-000000001100'
  $$,
  'P0001',
  'terminal_record',
  'rejected sources cannot receive a new verification decision'
);
select is(
  (select count(*)::bigint from public.observation_change_events where extracted_biomarker_id = '00000000-0000-0000-0000-000000001100' and event_kind = 'record_rejected'),
  1::bigint,
  'owner rejection captures exactly one lifecycle event'
);
select is(
  (select was_reused from public.eh120_reject_document_extracted_biomarker(
    '00000000-0000-0000-0000-000000001100',
    '00000000-0000-0000-0000-000000001001',
    '2026-08-13 10:00:00+00',
    '00000000-0000-0000-0000-000000001210',
    'incorrect_extraction',
    repeat('c', 64)
  )),
  true,
  'same rejection request reuses its committed result'
);
select is(
  (select count(*)::bigint from public.observation_change_events where extracted_biomarker_id = '00000000-0000-0000-0000-000000001100' and event_kind = 'record_rejected'),
  1::bigint,
  'rejection retry does not duplicate the lifecycle event'
);
select throws_ok(
  $$
    select * from public.eh120_reject_document_extracted_biomarker(
      '00000000-0000-0000-0000-000000001100',
      '00000000-0000-0000-0000-000000001001',
      '2026-08-13 10:00:00+00',
      '00000000-0000-0000-0000-000000001210',
      'other',
      repeat('c', 64)
    )
  $$,
  'P0001',
  'lifecycle_idempotency_conflict',
  'a reused request hash cannot bind to a different rejection'
);
select throws_ok(
  $$
    select * from public.eh120_reject_document_extracted_biomarker(
      '00000000-0000-0000-0000-000000001101',
      '00000000-0000-0000-0000-000000001001',
      '2026-08-13 10:01:00+00',
      null,
      'unsupported_reason',
      repeat('d', 64)
    )
  $$,
  'P0001',
  'invalid_lifecycle_reason_code',
  'unsupported rejection reasons are rejected before mutation'
);
select is(
  (select record_status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001101'),
  'active'::text,
  'invalid rejection reason leaves source active'
);
select throws_ok(
  $$
    select * from public.eh120_reject_document_extracted_biomarker(
      '00000000-0000-0000-0000-000000001100',
      '00000000-0000-0000-0000-000000001001',
      '2026-08-13 10:00:00+00',
      '00000000-0000-0000-0000-000000001210',
      'other',
      repeat('e', 64)
    )
  $$,
  'P0001',
  'terminal_record',
  'rejected source rows are terminal'
);
select throws_ok(
  $$
    select * from public.eh120_reject_document_extracted_biomarker(
      '00000000-0000-0000-0000-000000001102',
      '00000000-0000-0000-0000-000000001001',
      '2026-08-13 10:59:00+00',
      null,
      'other',
      repeat('f', 64)
    )
  $$,
  'P0001',
  'stale_source_snapshot',
  'stale source snapshots fail before mutation'
);
select throws_ok(
  $$
    select * from public.eh120_reject_document_extracted_biomarker(
      '00000000-0000-0000-0000-000000001120',
      '00000000-0000-0000-0000-000000001001',
      '2026-08-13 10:05:00+00',
      null,
      'other',
      repeat('1', 64)
    )
  $$,
  'P0001',
  'foreign_owner',
  'foreign profile cannot reject a source'
);

-- ── service supersession: source batch, protected human decision, retry ──────
select lives_ok(
  $$
    select * from public.eh120_supersede_document_extracted_biomarkers(
      '00000000-0000-0000-0000-000000001011',
      '00000000-0000-0000-0000-000000001001',
      '00000000-0000-0000-0000-000000001030',
      repeat('2', 64)
    )
  $$,
  'completed service attempt supersedes eligible active source rows'
);
select is(
  (select record_status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001110'),
  'superseded'::text,
  'reprocessing moves the old source to superseded'
);
select is(
  (select is_current from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001110'),
  false,
  'superseded source is no longer current'
);
select is(
  (select lifecycle_reason_code from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001110'),
  'document_reprocessed'::text,
  'supersession records a stable reason code'
);
select is(
  (select superseded_by_processing_attempt_id from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001110'),
  '00000000-0000-0000-0000-000000001030'::uuid,
  'supersession records the replacement processing attempt'
);
select is(
  (select record_status from public.document_extracted_biomarkers where id = '00000000-0000-0000-0000-000000001111'),
  'active'::text,
  'active human decisions are protected from supersession'
);
select is(
  (select count(*)::bigint from public.observation_change_events where extracted_biomarker_id = '00000000-0000-0000-0000-000000001110' and event_kind = 'record_superseded'),
  1::bigint,
  'supersession captures exactly one lifecycle event'
);
select is(
  (select count(*)::bigint from public.eh120_supersede_document_extracted_biomarkers(
    '00000000-0000-0000-0000-000000001011',
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000001030',
    repeat('2', 64)
  )),
  2::bigint,
  'same supersession request reuses every recorded row'
);
select is(
  (select count(*)::bigint from public.observation_change_events where extracted_biomarker_id = '00000000-0000-0000-0000-000000001110' and event_kind = 'record_superseded'),
  1::bigint,
  'supersession retry does not duplicate the lifecycle event'
);

-- ── automatic actor/status guard ─────────────────────────────────────────────
select throws_ok(
  $$
    insert into public.observation_normalization_revisions (
      id, extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
      analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
      catalog_manifest_version, catalog_manifest_digest, resolver_version,
      normalization_version, verification_status, verification_decided_at,
      verification_actor_type, verification_actor_id
    ) values (
      '00000000-0000-0000-0000-000000001310',
      '00000000-0000-0000-0000-000000001130',
      repeat('3', 64), 'glucose_serum_fasting', 'glucose', 'resolved', 0.99, 'high',
      'eh120', 'eh120', 'eh120', 'eh120', 'auto_verified', now(), 'system', null
    )
  $$,
  'P0001',
  'automatic_verification_writer_required',
  'direct auto_verified inserts require the automatic writer context'
);
select set_config('easyhealth.automatic_verification_writer', 'on', true);
select lives_ok(
  $$
    insert into public.observation_normalization_revisions (
      id, extracted_biomarker_id, input_evidence_hash, measurement_definition_key,
      analyte_key, resolver_result, mapping_confidence, mapping_confidence_band,
      catalog_manifest_version, catalog_manifest_digest, resolver_version,
      normalization_version, verification_status, verification_decided_at,
      verification_actor_type, verification_actor_id
    ) values (
      '00000000-0000-0000-0000-000000001310',
      '00000000-0000-0000-0000-000000001130',
      repeat('3', 64), 'glucose_serum_fasting', 'glucose', 'resolved', 0.99, 'high',
      'eh120', 'eh120', 'eh120', 'eh120', 'auto_verified', now(), 'system', null
    )
  $$,
  'automatic writer context permits system auto_verified metadata'
);
select set_config('easyhealth.automatic_verification_writer', '', true);
select is(
  (select verification_actor_type from public.observation_normalization_revisions where id = '00000000-0000-0000-0000-000000001310'),
  'system'::text,
  'automatic revision stores the system actor type'
);
select is(
  (select verification_actor_id from public.observation_normalization_revisions where id = '00000000-0000-0000-0000-000000001310'),
  null::uuid,
  'automatic revision stores no user actor id'
);

-- ── append-only audit and final preflight ─────────────────────────────────────
select throws_ok(
  $$
    update public.observation_change_events
    set reason_code = 'other'
    where extracted_biomarker_id = '00000000-0000-0000-0000-000000001100'
      and event_kind = 'record_rejected'
  $$,
  'P0001',
  'observation_change_events_append_only',
  'lifecycle events cannot be rewritten'
);
select throws_ok(
  $$
    delete from public.observation_normalization_revisions
    where id = '00000000-0000-0000-0000-000000001210'
  $$,
  'P0001',
  'normalization_revision_delete_forbidden',
  'normalization revisions remain append-only'
);
select is(
  (select count(*)::bigint from public.eh120_record_lifecycle_preflight()),
  0::bigint,
  'all synthetic source rows remain lifecycle-valid after transitions'
);

select * from finish();
rollback;
