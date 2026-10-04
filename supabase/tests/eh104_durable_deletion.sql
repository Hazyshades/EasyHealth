-- EH-104: durable document deletion schema, tombstone, retention, and writer fences.
begin;
select plan(60);

select has_table(
  'public',
  'document_deletion_operations',
  'durable deletion operations table exists'
);
select has_table(
  'public',
  'document_storage_write_intents',
  'storage write intents table exists'
);
select has_table(
  'public',
  'document_storage_upload_tickets',
  'storage upload tickets table exists'
);
select ok(
  to_regprocedure('public.request_document_deletion(uuid,uuid)') is not null,
  'owner tombstone RPC exists'
);
select ok(
  to_regprocedure('public.claim_document_deletion_operation(text)') is not null,
  'cleanup claim RPC exists'
);
select ok(
  to_regprocedure('public.finalize_document_deletion(uuid,uuid)') is not null,
  'cleanup finalizer RPC exists'
);
select ok(
  to_regprocedure('public.create_validated_report(uuid,text,text,text,text,uuid[],uuid[],jsonb,boolean,jsonb,text,text,text,text[],jsonb)') is not null,
  'validated report writer exists'
);
select ok(
  to_regprocedure('public.persist_profile_health_synthesis(uuid,uuid[],jsonb,text,text,text,timestamptz)') is not null,
  'validated synthesis writer exists'
);
select ok(
  to_regprocedure('public.consume_storage_upload_ticket(uuid,text)') is not null,
  'upload ticket consume RPC exists'
);
select ok(
  to_regprocedure('public.complete_storage_write_intent(uuid,text,boolean)') is not null,
  'storage intent completion RPC exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.consume_storage_upload_ticket(uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'service role can consume upload tickets'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.consume_storage_upload_ticket(uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot consume upload tickets'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_storage_upload_ticket(uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot consume upload tickets'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.complete_storage_write_intent(uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'service role can complete storage intents'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.complete_storage_write_intent(uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot complete storage intents'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_storage_write_intent(uuid,text,boolean)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot complete storage intents'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.persist_profile_health_synthesis(uuid,uuid[],jsonb,text,text,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'service role can persist Health Profile synthesis'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.persist_profile_health_synthesis(uuid,uuid[],jsonb,text,text,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot persist Health Profile synthesis'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.persist_profile_health_synthesis(uuid,uuid[],jsonb,text,text,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot persist Health Profile synthesis'
);
select ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.document_deletion_operations'::regclass
      and pg_get_constraintdef(oid) ilike '%documents%'
  ),
  'deletion receipt has no cascading document foreign key'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.request_document_deletion(uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service role can request deletion'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.request_document_deletion(uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot call deletion RPC directly'
);
select ok(
  has_table_privilege('service_role', 'public.reports', 'SELECT'),
  'service role retains report reads'
);
select ok(
  not has_table_privilege('service_role', 'public.reports', 'INSERT'),
  'service role cannot directly insert reports'
);
select ok(
  not has_table_privilege('service_role', 'public.reports', 'DELETE'),
  'service role cannot directly delete reports'
);
select ok(
  not has_table_privilege('service_role', 'public.documents', 'DELETE'),
  'service role cannot directly delete root documents'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_invocations'::regclass
      and conname = 'ai_invocations_error_code_check'
  ),
  'AI error code allowlist constraint exists'
);

insert into public.profiles (id)
values ('00000000-0000-0000-0000-000000104001')
on conflict do nothing;
insert into public.documents (
  id,
  profile_id,
  storage_path,
  original_storage_path,
  original_filename,
  status,
  processing_status,
  lifecycle_state,
  upload_state
)
values (
  '00000000-0000-0000-0000-000000104002',
  '00000000-0000-0000-0000-000000104001',
  'eh104/owner/original.pdf',
  'eh104/owner/original.pdf',
  'eh104.pdf',
  'completed',
  'ready',
  'active',
  'complete'
)
on conflict do nothing;

insert into public.reports (
  id,
  profile_id,
  title,
  report_type,
  detail_level,
  document_ids,
  actual_source_document_ids,
  source_scope_known,
  content,
  summary_preview
)
values
(
  '00000000-0000-0000-0000-000000104003',
  '00000000-0000-0000-0000-000000104001',
  'EH-104 exact report',
  'general_practice',
  'standard',
  array['00000000-0000-0000-0000-000000104002']::uuid[],
  array['00000000-0000-0000-0000-000000104002']::uuid[],
  true,
  '{"overview":"synthetic"}'::jsonb,
  'synthetic'
),
(
  '00000000-0000-0000-0000-000000104004',
  '00000000-0000-0000-0000-000000104001',
  'EH-104 unknown report',
  'general_practice',
  'standard',
  null,
  '{}'::uuid[],
  false,
  '{"overview":"synthetic"}'::jsonb,
  'synthetic'
)
,
(
  '00000000-0000-0000-0000-000000104005',
  '00000000-0000-0000-0000-000000104001',
  'EH-104 empty-known report',
  'general_practice',
  'standard',
  '{}'::uuid[],
  '{}'::uuid[],
  true,
  '{"overview":"synthetic"}'::jsonb,
  'synthetic'
)
on conflict do nothing;

delete from public.profile_health_synthesis
where profile_id = '00000000-0000-0000-0000-000000104001';

insert into public.profile_health_synthesis (
  profile_id,
  synthesis_text,
  source_document_ids,
  input_hash,
  model
)
values (
  '00000000-0000-0000-0000-000000104001',
  'synthetic synthesis',
  array['00000000-0000-0000-0000-000000104002']::uuid[],
  repeat('1', 64),
  'synthetic'
);

select lives_ok(
  $$
    select * from public.persist_profile_health_synthesis(
      '00000000-0000-0000-0000-000000104001'::uuid,
      array['00000000-0000-0000-0000-000000104002']::uuid[],
      jsonb_build_object('00000000-0000-0000-0000-000000104002', 0),
      repeat('1', 64),
      'synthetic-model',
      'refreshed synthesis',
      now()
    )
  $$,
  'synthesis writer updates an existing input-hash row'
);
select is(
  (
    select synthesis_text
    from public.profile_health_synthesis
    where profile_id = '00000000-0000-0000-0000-000000104001'
      and input_hash = repeat('1', 64)
  ),
  'refreshed synthesis',
  'synthesis writer preserves the keyed row while refreshing its text'
);
select throws_ok(
  $$
    select * from public.persist_profile_health_synthesis(
      '00000000-0000-0000-0000-000000104001'::uuid,
      array['00000000-0000-0000-0000-000000104002']::uuid[],
      jsonb_build_object('00000000-0000-0000-0000-000000104002', 1),
      repeat('2', 64),
      'synthetic-model',
      'stale synthesis',
      now()
    )
  $$,
  'P0001',
  'report_source_generation_conflict',
  'synthesis writer rejects a stale source generation'
);
select is(
  (
    select count(*)::int
    from public.profile_health_synthesis
    where profile_id = '00000000-0000-0000-0000-000000104001'
      and input_hash = repeat('2', 64)
  ),
  0,
  'stale synthesis does not create a keyed row'
);

insert into public.documents (
  id,
  profile_id,
  storage_path,
  original_storage_path,
  original_filename,
  status,
  processing_status,
  lifecycle_state,
  upload_state
)
values (
  '00000000-0000-0000-0000-000000104007',
  '00000000-0000-0000-0000-000000104001',
  'eh104/upload/original.pdf',
  'eh104/upload/original.pdf',
  'upload.pdf',
  'processing',
  'upload_pending',
  'active',
  'pending'
)
on conflict do nothing;

insert into public.document_storage_write_intents (
  id,
  document_id,
  profile_id,
  write_generation,
  principal_kind,
  operation_kind,
  bucket,
  object_path,
  content_type,
  deadline_at
)
values (
  '00000000-0000-0000-0000-000000104008',
  '00000000-0000-0000-0000-000000104007',
  '00000000-0000-0000-0000-000000104001',
  0,
  'owner',
  'owner_original',
  'lab-documents',
  'eh104/upload/original.pdf',
  'application/pdf',
  now() + interval '10 minutes'
)
on conflict do nothing;

insert into public.document_storage_upload_tickets (
  ticket_hash,
  intent_id,
  profile_id,
  write_generation,
  expires_at
)
values (
  repeat('a', 64),
  '00000000-0000-0000-0000-000000104008',
  '00000000-0000-0000-0000-000000104001',
  0,
  now() + interval '60 seconds'
)
on conflict do nothing;

select throws_ok(
  $$
    select * from public.consume_storage_upload_ticket(
      '00000000-0000-0000-0000-000000104008'::uuid,
      repeat('b', 64)
    )
  $$,
  'P0001',
  'storage_ticket_not_found',
  'wrong upload ticket hash is rejected'
);
select is(
  (
    select state
    from public.document_storage_write_intents
    where id = '00000000-0000-0000-0000-000000104008'
  ),
  'pending',
  'wrong upload ticket hash does not advance the intent'
);
select is(
  (
    select consumed_at
    from public.document_storage_upload_tickets
    where ticket_hash = repeat('a', 64)
  ),
  null::timestamptz,
  'wrong upload ticket hash does not consume the valid ticket'
);
select lives_ok(
  $$
    select * from public.consume_storage_upload_ticket(
      '00000000-0000-0000-0000-000000104008'::uuid,
      repeat('a', 64)
    )
  $$,
  'valid upload ticket is consumed'
);
select is(
  (
    select state
    from public.document_storage_write_intents
    where id = '00000000-0000-0000-0000-000000104008'
  ),
  'exchanged',
  'valid upload ticket advances the intent to exchanged'
);
select ok(
  (
    select consumed_at is not null
    from public.document_storage_upload_tickets
    where ticket_hash = repeat('a', 64)
  ),
  'valid upload ticket records consumption'
);
select lives_ok(
  $$
    select public.complete_storage_write_intent(
      '00000000-0000-0000-0000-000000104008'::uuid,
      repeat('a', 64),
      true
    )
  $$,
  'valid upload ticket completes the storage intent'
);
select is(
  (
    select state
    from public.document_storage_write_intents
    where id = '00000000-0000-0000-0000-000000104008'
  ),
  'completed',
  'completed upload intent reaches its terminal state'
);
select is(
  (
    select upload_state
    from public.documents
    where id = '00000000-0000-0000-0000-000000104007'
  ),
  'complete',
  'completed owner upload marks the document complete'
);

insert into public.ai_invocations (
  profile_id,
  document_id,
  stage,
  provider,
  model_id,
  success,
  error_code
)
values (
  '00000000-0000-0000-0000-000000104001',
  '00000000-0000-0000-0000-000000104002',
  'report',
  'openai',
  'synthetic',
  false,
  'llm_timeout'
);

select is(
  (select count(*)::int
   from public.request_document_deletion(
     '00000000-0000-0000-0000-000000104001'::uuid,
     '00000000-0000-0000-0000-000000104002'::uuid
   )),
  1,
  'first deletion request creates one operation receipt'
);
select is(
  (select lifecycle_state from public.documents where id = '00000000-0000-0000-0000-000000104002'),
  'deleting',
  'tombstone fences the document'
);
select is(
  (select write_generation from public.documents where id = '00000000-0000-0000-0000-000000104002'),
  1::bigint,
  'tombstone increments the shared write generation'
);
select is(
  (select count(*)::int
   from public.document_deletion_operations
   where document_id = '00000000-0000-0000-0000-000000104002'),
  1,
  'document has one durable deletion operation'
);
select is(
  (select count(*)::int
   from public.reports
   where id in (
     '00000000-0000-0000-0000-000000104003',
     '00000000-0000-0000-0000-000000104004',
     '00000000-0000-0000-0000-000000104005'
   )
   and invalidated_at is not null),
  3,
  'exact, unknown, and empty-known reports are invalidated'
);
select is(
  (select count(*)::int
   from public.profile_health_synthesis
   where profile_id = '00000000-0000-0000-0000-000000104001'),
  0,
  'source-linked synthesis is removed during tombstone'
);
select is(
  (select count(*)::int
   from public.ai_invocations
   where document_id = '00000000-0000-0000-0000-000000104002'),
  1,
  'document-linked AI receipt remains until final purge'
);

select is(
  (select count(*)::int
   from public.request_document_deletion(
     '00000000-0000-0000-0000-000000104001'::uuid,
     '00000000-0000-0000-0000-000000104002'::uuid
   )),
  1,
  'repeated deletion request returns the same operation'
);
select is(
  (select count(*)::int
   from public.document_deletion_operations
   where document_id = '00000000-0000-0000-0000-000000104002'),
  1,
  'repeated deletion request does not duplicate the receipt'
);
select is(
  (select count(*)::int
   from public.document_deletion_operations
   where document_id = '00000000-0000-0000-0000-000000104002'
     and status = 'queued'),
  1,
  'operation remains queued for cleanup worker'
);

select throws_ok(
  $$select * from public.create_validated_report(
    '00000000-0000-0000-0000-000000104001'::uuid,
    'late report',
    'general_practice',
    'standard',
    'explicit',
    array['00000000-0000-0000-0000-000000104002']::uuid[],
    array['00000000-0000-0000-0000-000000104002']::uuid[],
    '{"00000000-0000-0000-0000-000000104002":0}'::jsonb,
    false,
    '{
      "schema_version":"eh148.v1",
      "report_kind":"doctor_visit_brief",
      "requested_scope":{"kind":"explicit","document_ids":["00000000-0000-0000-0000-000000104002"]},
      "source_document_ids":["00000000-0000-0000-0000-000000104002"],
      "sections":[
        {"id":"document_summary","items":[],"empty_state":"no_data"},
        {"id":"latest_measurements","items":[],"empty_state":"no_data"},
        {"id":"changes","items":[],"empty_state":"no_data"},
        {"id":"clinician_questions","items":[],"empty_state":"no_data"},
        {"id":"limitations","items":[],"empty_state":"no_data"},
        {"id":"source_ledger","items":[{"type":"source_ref","source_id":"src_ffffffffffffffffffffffffffffffff"}]}
      ],
      "claims":[],
      "limitations":[],
      "validation":{"status":"valid","version":"eh150.v1","issue_codes":[]},
      "overview":"Synthetic source-grounded overview.",
      "sources":[{
        "source_id":"src_ffffffffffffffffffffffffffffffff",
        "kind":"observation",
        "document_id":"00000000-0000-0000-0000-000000104002",
        "snapshot":{
          "kind":"observation",
          "label":"Synthetic",
          "observed_at":"2026-09-20",
          "value":1,
          "value_text":"1",
          "unit":"unit",
          "ref_low":null,
          "ref_high":null
        }
      }]
    }'::jsonb,
    'late',
    'valid',
    'eh150.v1',
    '{}'::text[],
    '[{
      "source_id":"src_ffffffffffffffffffffffffffffffff",
      "source_kind":"observation",
      "source_row_id":"00000000-0000-0000-0000-000000104002",
      "document_id":"00000000-0000-0000-0000-000000104002"
    }]'::jsonb
  )$$,
  'report_source_unavailable',
  'report writer rejects a tombstoned source'
);
select throws_ok(
  $$insert into public.document_pages (
      id, document_id, profile_id, page_number, preview_storage_path
    ) values (
      '00000000-0000-0000-0000-000000104006',
      '00000000-0000-0000-0000-000000104002',
      '00000000-0000-0000-0000-000000104001',
      1,
      'eh104/owner/page-1.png'
    )$$,
  'document_deleting',
  'direct document child writes reject a tombstoned document'
);

select throws_ok(
  $$insert into public.ai_invocations (
      profile_id, document_id, stage, provider, model_id
    ) values (
      '00000000-0000-0000-0000-000000104001',
      '00000000-0000-0000-0000-000000104002',
      'report',
      'openai',
      'synthetic'
    )$$,
  'document_deleting',
  'document-scoped AI receipts reject a tombstoned document'
);

select lives_ok(
  $eh104$
  do $$
  declare
    v_claim record;
  begin
    select * into v_claim
    from public.claim_document_deletion_operation('eh104-db-test')
    limit 1;
    if v_claim.operation_id is null then
      raise exception using message = 'deletion_claim_missing';
    end if;
    perform public.transition_document_deletion_operation(
      v_claim.operation_id,
      v_claim.cleanup_lease_token,
      'waiting_for_writers',
      'cleaning_storage',
      null,
      null,
      null,
      null
    );

    select * into v_claim
    from public.claim_document_deletion_operation('eh104-db-test')
    limit 1;
    perform public.transition_document_deletion_operation(
      v_claim.operation_id,
      v_claim.cleanup_lease_token,
      'cleaning_storage',
      'verifying_storage',
      null,
      2,
      now() - interval '10 seconds',
      null
    );

    select * into v_claim
    from public.claim_document_deletion_operation('eh104-db-test')
    limit 1;
    perform public.finalize_document_deletion(
      v_claim.operation_id,
      v_claim.cleanup_lease_token
    );
  end $$;
  $eh104$,
  'finalizer purges after two stable empty listings'
);
select is(
  (select count(*)::int
   from public.documents
   where id = '00000000-0000-0000-0000-000000104002'),
  0,
  'finalizer removes the tombstoned document'
);
select is(
  (select status
   from public.document_deletion_operations
   where document_id = '00000000-0000-0000-0000-000000104002'),
  'completed',
  'finalizer completes the independent receipt'
);
select is(
  (select count(*)::int
   from public.reports
   where id in (
     '00000000-0000-0000-0000-000000104003',
     '00000000-0000-0000-0000-000000104004',
     '00000000-0000-0000-0000-000000104005'
   )),
  0,
  'finalizer purges invalidated report rows as whole rows'
);
select is(
  (select count(*)::int
   from public.ai_invocations
   where document_id = '00000000-0000-0000-0000-000000104002'),
  0,
  'finalizer purges document-linked AI receipts'
);
update public.document_deletion_operations
set receipt_expires_at = now() - interval '1 second'
where document_id = '00000000-0000-0000-0000-000000104002';
select is(
  public.prune_expired_document_deletion_receipts(1000),
  1,
  'expired deletion receipt is prunable'
);
select is(
  (select count(*)::int
   from public.document_deletion_operations
   where document_id = '00000000-0000-0000-0000-000000104002'),
  0,
  'expired deletion receipt is removed without document content'
);

select * from finish();
rollback;
