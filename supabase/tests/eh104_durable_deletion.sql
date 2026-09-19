-- EH-104: durable document deletion schema, tombstone, retention, and writer fences.
begin;
select plan(36);

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
  to_regprocedure('public.create_validated_report(uuid,text,text,text,uuid[],uuid[],jsonb,boolean,jsonb,text)') is not null,
  'validated report writer exists'
);
select ok(
  to_regprocedure('public.persist_profile_health_synthesis(uuid,uuid[],jsonb,text,text,text,timestamptz)') is not null,
  'validated synthesis writer exists'
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
    array['00000000-0000-0000-0000-000000104002']::uuid[],
    array['00000000-0000-0000-0000-000000104002']::uuid[],
    '{"00000000-0000-0000-0000-000000104002":0}'::jsonb,
    false,
    '{"overview":"late"}'::jsonb,
    'late'
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
