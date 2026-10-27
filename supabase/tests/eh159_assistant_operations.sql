-- EH-159: quota, telemetry, controlled feedback, and PII-safe operation contracts.
begin;
select plan(30);

select has_table('public', 'assistant_request_events', 'assistant request event table exists');
select has_table('public', 'assistant_feedback', 'assistant feedback table exists');
select has_column('public', 'assistant_request_events', 'request_id', 'request identity is stored');
select has_column('public', 'assistant_request_events', 'reserved_cost_usd', 'quota reservation cost is stored');
select has_column('public', 'assistant_request_events', 'structured_source_count', 'structured retrieval count is stored');
select has_column('public', 'assistant_request_events', 'semantic_source_count', 'semantic retrieval count is stored');
select has_column('public', 'assistant_feedback', 'rating', 'feedback rating is stored');
select has_column('public', 'assistant_feedback', 'category', 'feedback category is stored');
select has_column('public', 'assistant_feedback', 'comment', 'feedback comment is bounded');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_request_events'::regclass),
  'assistant request event RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assistant_feedback'::regclass),
  'assistant feedback RLS is enabled'
);
select ok(
  has_table_privilege('service_role', 'public.assistant_request_events', 'SELECT'),
  'service role can read assistant request events'
);
select ok(
  not has_table_privilege('authenticated', 'public.assistant_request_events', 'SELECT'),
  'authenticated role cannot read assistant request events directly'
);
select ok(
  not has_table_privilege('anon', 'public.assistant_feedback', 'SELECT'),
  'anon role cannot read assistant feedback directly'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'reserve_assistant_request'),
  'assistant quota reservation RPC exists'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'complete_assistant_request'),
  'assistant event completion RPC exists'
);
select ok(
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'record_assistant_feedback'),
  'assistant feedback RPC exists'
);
select ok(
  has_function_privilege('service_role', 'public.reserve_assistant_request(uuid,uuid,text,integer,numeric,numeric)'::regprocedure, 'EXECUTE'),
  'service role can reserve assistant requests'
);
select ok(
  not has_function_privilege('authenticated', 'public.reserve_assistant_request(uuid,uuid,text,integer,numeric,numeric)'::regprocedure, 'EXECUTE'),
  'authenticated role cannot reserve assistant requests'
);
select ok(
  has_function_privilege('service_role', 'public.record_assistant_feedback(uuid,uuid,text,text,text)'::regprocedure, 'EXECUTE'),
  'service role can record assistant feedback'
);
select ok(
  not has_function_privilege('authenticated', 'public.record_assistant_feedback(uuid,uuid,text,text,text)'::regprocedure, 'EXECUTE'),
  'authenticated role cannot record assistant feedback'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_invocations'
      and column_name = 'request_id'
  ),
  'AI invocation receipts can join assistant requests'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_invocations'::regclass
      and pg_get_constraintdef(oid) ilike '%assistant_provider_unavailable%'
  ),
  'assistant error codes are constrained'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assistant_request_events'
      and column_name in ('question', 'answer', 'source_excerpt', 'document_content')
  ),
  'request events exclude prompt and document content'
);

insert into public.profiles (id)
values ('00000000-0000-0000-0000-000000159001')
on conflict do nothing;

select ok(
  (select allowed from public.reserve_assistant_request(
    '00000000-0000-0000-0000-000000159001',
    '00000000-0000-0000-0000-000000159101',
    'general_education',
    1,
    5.0,
    0.1
  )),
  'first request is admitted under the daily limit'
);
select ok(
  not (select allowed from public.reserve_assistant_request(
    '00000000-0000-0000-0000-000000159001',
    '00000000-0000-0000-0000-000000159102',
    'general_education',
    1,
    5.0,
    0.1
  )),
  'second request is denied atomically at the daily limit'
);
select lives_ok(
  $$select public.complete_assistant_request(
    '00000000-0000-0000-0000-000000159101',
    'completed',
    'openai',
    'gpt-4o-mini',
    10,
    20,
    null,
    120,
    0,
    0,
    array['GENERAL_INFORMATION']::text[],
    null
  )$$,
  'completed assistant event accepts safe telemetry'
);
select lives_ok(
  $$select public.record_assistant_feedback(
    '00000000-0000-0000-0000-000000159001',
    '00000000-0000-0000-0000-000000159101',
    'negative',
    'missing_evidence',
    'The source was not clear.'
  )$$,
  'controlled feedback is accepted for an owned request'
);
select is(
  (select count(*)::integer from public.assistant_feedback where request_id = '00000000-0000-0000-0000-000000159101'),
  1,
  'one feedback row is stored without answer content'
);
select throws_ok(
  $$select public.record_assistant_feedback(
    '00000000-0000-0000-0000-000000159001',
    '00000000-0000-0000-0000-000000159101',
    'negative',
    'free_form_category',
    null
  )$$,
  'P0001',
  'assistant_feedback_category_invalid',
  'unknown feedback categories are rejected'
);

select * from finish();
rollback;
