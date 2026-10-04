begin;
select no_plan();

select has_table('public', 'report_share_links', 'share links table exists');
select has_table('public', 'report_share_documents', 'explicit document scope table exists');
select has_table('public', 'report_share_access_events', 'access events table exists');
select has_table('public', 'share_pin_proofs', 'PIN proof table exists');
select has_table('public', 'share_rate_limit_buckets', 'rate-limit buckets table exists');
select has_table('public', 'share_replacement_operations', 'replacement operations table exists');

select ok(to_regprocedure('public.create_report_share(uuid,uuid,text,text,text,text,timestamptz,text,text[],uuid[])') is not null, 'atomic create RPC exists');
select ok(to_regprocedure('public.read_report_share_by_digest(text)') is not null, 'digest lookup RPC exists');
select ok(to_regprocedure('public.touch_report_share_last_accessed(uuid,timestamptz)') is not null, 'monotonic last-access RPC exists');
select ok(to_regprocedure('public.write_report_share_access_event(uuid,timestamptz,text,text,text,integer)') is not null, 'durable event writer exists');
select ok(to_regprocedure('public.cleanup_report_share_access_events(timestamptz,integer)') is not null, 'event cleanup RPC exists');
select ok(to_regprocedure('public.consume_report_share_rate_limit(text,integer,integer,timestamptz)') is not null, 'rate-limit consume RPC exists');
select ok(to_regprocedure('public.cleanup_report_share_rate_limit_buckets(timestamptz,integer)') is not null, 'rate-limit cleanup RPC exists');
select ok(to_regprocedure('public.cleanup_report_share_pin_proofs(timestamptz,integer)') is not null, 'proof cleanup RPC exists');
select ok(to_regprocedure('public.replace_report_share(uuid,uuid,text,text,text)') is not null, 'replacement RPC exists');
select ok(to_regprocedure('public.revoke_report_share(uuid,uuid)') is not null, 'revoke RPC exists');
select ok(to_regprocedure('public.list_report_shares_for_owner(uuid,uuid)') is not null, 'EH-152 management list seam exists');
select ok(to_regprocedure('public.list_report_share_access_events_for_owner(uuid,uuid)') is not null, 'EH-152 access-event seam exists');

select ok(
  not has_table_privilege('service_role', 'public.report_share_links', 'INSERT')
  and not has_table_privilege('service_role', 'public.report_share_links', 'UPDATE')
  and not has_table_privilege('service_role', 'public.report_share_links', 'DELETE'),
  'service role cannot bypass the share transition'
);
select ok(
  not has_table_privilege('service_role', 'public.report_share_documents', 'INSERT')
  and not has_table_privilege('service_role', 'public.report_share_documents', 'UPDATE')
  and not has_table_privilege('service_role', 'public.report_share_documents', 'DELETE'),
  'service role cannot bypass explicit document scope transition'
);
select ok(
  has_function_privilege('service_role', 'public.create_report_share(uuid,uuid,text,text,text,text,timestamptz,text,text[],uuid[])', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.create_report_share(uuid,uuid,text,text,text,text,timestamptz,text,text[],uuid[])', 'EXECUTE'),
  'only the service role can call atomic creation'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.report_share_documents'::regclass
      and confrelid = 'public.report_share_links'::regclass
      and confdeltype = 'c'
  ),
  'share document scope cascades with its share'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.report_share_access_events'::regclass
      and confrelid = 'public.report_share_links'::regclass
      and confdeltype = 'c'
  ),
  'access events cascade with their share'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.share_pin_proofs'::regclass
      and confrelid = 'public.report_share_links'::regclass
      and confdeltype = 'c'
  ),
  'PIN proofs cascade with their share'
);
select ok(public.eh151_unique_text_array(array['pdf', 'json']), 'format allow-list accepts unique values');
select ok(not public.eh151_unique_text_array(array['pdf', 'pdf']), 'format allow-list rejects duplicate values');

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000151001', 'eh151-owner@example.test'),
  ('00000000-0000-0000-0000-000000151002', 'eh151-other@example.test');

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
values
  (
    '00000000-0000-0000-0000-000000151003',
    '00000000-0000-0000-0000-000000151001',
    'eh151/owner/document.pdf',
    'eh151/owner/document.pdf',
    'document.pdf',
    'completed',
    'ready',
    'active',
    'complete'
  ),
  (
    '00000000-0000-0000-0000-000000151004',
    '00000000-0000-0000-0000-000000151002',
    'eh151/other/document.pdf',
    'eh151/other/document.pdf',
    'other.pdf',
    'completed',
    'ready',
    'active',
    'complete'
  );

insert into public.reports (
  id,
  profile_id,
  title,
  report_type,
  detail_level,
  document_ids,
  actual_source_document_ids,
  source_scope_known,
  validation_status,
  validation_version,
  validation_issue_codes,
  content,
  summary_preview
)
values (
  '00000000-0000-0000-0000-000000151005',
  '00000000-0000-0000-0000-000000151001',
  'EH-151 synthetic report',
  'general_practice',
  'standard',
  array['00000000-0000-0000-0000-000000151003']::uuid[],
  array['00000000-0000-0000-0000-000000151003']::uuid[],
  true,
  'valid',
  'eh150.v1',
  '{}'::text[],
  '{}'::jsonb,
  'synthetic'
);

select is(
  (select count(*)::int
   from public.create_report_share(
     '00000000-0000-0000-0000-000000151001'::uuid,
     '00000000-0000-0000-0000-000000151005'::uuid,
     repeat('a', 64),
     '2026-1',
     null,
     null,
     clock_timestamp() + interval '1 day',
     'report',
     array['pdf', 'json'],
     array['00000000-0000-0000-0000-000000151003']::uuid[]
   )),
  1,
  'valid owner share creation commits one row'
);
select is(
  (select count(*)::int
   from public.report_share_documents
   where share_id = (select id from public.report_share_links where token_digest = repeat('a', 64))),
  1,
  'valid owner share persists explicit document scope'
);
select is(
  (select count(*)::int
   from public.read_report_share_by_digest(repeat('a', 64))),
  1,
  'digest lookup returns the scoped share'
);
select is(
  (select report_title
   from public.list_report_shares_for_owner(
     '00000000-0000-0000-0000-000000151001'::uuid,
     null
   )
   where share_id = (
     select id from public.report_share_links where token_digest = repeat('a', 64)
   )),
  'EH-151 synthetic report',
  'owner share seam returns the safe report title'
);

select throws_ok(
  $$
    select * from public.create_report_share(
      '00000000-0000-0000-0000-000000151001'::uuid,
      '00000000-0000-0000-0000-000000151005'::uuid,
      repeat('b', 64),
      '2026-1',
      null,
      null,
      clock_timestamp() + interval '1 day',
      'documents',
      '{}'::text[],
      array['00000000-0000-0000-0000-000000151004']::uuid[]
    )
  $$,
  'share_document_scope_invalid',
  'out-of-scope document creation is rejected'
);
select is(
  (select count(*)::int from public.report_share_links where token_digest = repeat('b', 64)),
  0,
  'rejected creation leaves no share row'
);

select ok(
  (select last_accessed_at
   from public.touch_report_share_last_accessed(
     (select id from public.report_share_links where token_digest = repeat('a', 64)),
     clock_timestamp() - interval '1 hour'
   )) is not null,
  'first last-access transition returns a timestamp'
);
select ok(
  (select last_accessed_at
   from public.report_share_links
   where token_digest = repeat('a', 64)) is not null,
  'first last-access transition is persisted'
);
select ok(
  (select last_accessed_at
   from public.touch_report_share_last_accessed(
     (select id from public.report_share_links where token_digest = repeat('a', 64)),
     clock_timestamp()
   )) >= (select last_accessed_at from public.report_share_links where token_digest = repeat('a', 64)),
  'last-access transition is monotonic'
);
select public.write_report_share_access_event(
  (select id from public.report_share_links where token_digest = repeat('a', 64)),
  clock_timestamp(),
  'denied',
  'report',
  'browser',
  1
);
select is(
  (select count(*)::int
   from public.list_report_share_access_events_for_owner(
     '00000000-0000-0000-0000-000000151001'::uuid,
     (select id from public.report_share_links where token_digest = repeat('a', 64))
   )
   where result = 'denied'),
  1,
  'owner access seam returns retained events'
);

select public.write_report_share_access_event(
  (select id from public.report_share_links where token_digest = repeat('a', 64)),
  clock_timestamp() - interval '2 days',
  'allowed',
  'report',
  'browser',
  1
);
select is(
  (select deleted_count
   from public.cleanup_report_share_access_events(clock_timestamp(), 1)),
  1,
  'expired access event cleanup deletes one expired event'
);

select is(
  (select allowed
   from public.consume_report_share_rate_limit(repeat('c', 64), 60, 1, clock_timestamp())),
  true,
  'first rate-limit attempt is allowed'
);
select is(
  (select allowed
   from public.consume_report_share_rate_limit(repeat('c', 64), 60, 1, clock_timestamp())),
  false,
  'second rate-limit attempt is denied atomically'
);
select throws_ok(
  $$
    select * from public.replace_report_share(
      '00000000-0000-0000-0000-000000151001'::uuid,
      (select id from public.report_share_links where token_digest = repeat('a', 64)),
      'eh152-preflight-key',
      null,
      null
    )
  $$,
  'share_replacement_token_required',
  'fresh replacement preflight requires token material'
);
select is(
  (select operation_status
   from public.replace_report_share(
     '00000000-0000-0000-0000-000000151001'::uuid,
     (select id from public.report_share_links where token_digest = repeat('a', 64)),
     'eh152-replay-key',
     repeat('d', 64),
     '2026-1'
   )),
  'committed',
  'replacement commits through the owner RPC'
);
select is(
  (select replayed
   from public.replace_report_share(
     '00000000-0000-0000-0000-000000151001'::uuid,
     (select id from public.report_share_links where token_digest = repeat('a', 64)),
     'eh152-replay-key',
     null,
     null
   )),
  true,
  'replacement replay returns the committed operation without token material'
);
select throws_ok(
  $$
    select * from public.replace_report_share(
      '00000000-0000-0000-0000-000000151001'::uuid,
      (select id from public.report_share_links where token_digest = repeat('a', 64)),
      'eh152-replay-key',
      'not-a-digest',
      '2026-1'
    )
  $$,
  'share_replacement_invalid',
  'malformed replay token material remains invalid'
);
select is(
  (select count(*)::int
   from public.report_share_links
   where predecessor_share_id = (
     select id from public.report_share_links where token_digest = repeat('a', 64)
   )),
  1,
  'replacement replay does not create a second successor'
);

select * from finish();
rollback;
