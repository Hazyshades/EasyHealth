begin;

select plan(27);

select ok(
  to_regclass('public.medical_events') is not null,
  'EH-132 medical event identity exists'
);
select ok(
  to_regclass('public.medical_event_dates') is not null,
  'EH-132 medical event date contract exists'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.medical_events'::regclass
      and conname = 'medical_events_source_document_unique'
  ),
  'one medical event is unique per source document'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.medical_event_dates'::regclass
      and conname = 'medical_event_dates_role_unique'
  ),
  'one date role is unique per medical event'
);

insert into public.profiles (id, email)
values
  ('13200000-0000-0000-0000-000000000001', 'eh132-owner@example.test'),
  ('13200000-0000-0000-0000-000000000002', 'eh132-other@example.test');

select lives_ok(
  $$
    insert into public.documents (
      id,
      profile_id,
      storage_path,
      original_filename,
      status,
      document_type,
      observed_at
    )
    values
      (
        '13200000-0000-0000-0000-000000000010',
        '13200000-0000-0000-0000-000000000001',
        'eh132/owner-known.pdf',
        'owner-known.pdf',
        'completed',
        'lab_result',
        '2026-08-24'
      ),
      (
        '13200000-0000-0000-0000-000000000011',
        '13200000-0000-0000-0000-000000000001',
        'eh132/owner-unknown.pdf',
        'owner-unknown.pdf',
        'completed',
        'consultation_note',
        null
      ),
      (
        '13200000-0000-0000-0000-000000000012',
        '13200000-0000-0000-0000-000000000002',
        'eh132/other-profile.pdf',
        'other-profile.pdf',
        'completed',
        'referral',
        null
      )
  $$,
  'synthetic owner and second-profile documents can be created'
);

select is(
  (
    select count(*)::bigint
    from public.medical_events
    where source_document_id in (
      '13200000-0000-0000-0000-000000000010',
      '13200000-0000-0000-0000-000000000011'
    )
  ),
  2::bigint,
  'document triggers create exactly one event for each owner document'
);
select is(
  (
    select count(*)::bigint
    from public.medical_event_dates dates
    join public.medical_events events on events.id = dates.medical_event_id
    where events.source_document_id = '13200000-0000-0000-0000-000000000010'
  ),
  4::bigint,
  'new events begin with one row for each supported date role'
);

select throws_ok(
  $$
    insert into public.medical_events (profile_id, source_document_id, event_type)
    values (
      '13200000-0000-0000-0000-000000000001',
      '13200000-0000-0000-0000-000000000010',
      'lab_result'
    )
  $$,
  null,
  null,
  'a duplicate source document event is rejected'
);
select throws_ok(
  $$
    insert into public.medical_event_dates (medical_event_id, date_role, precision)
    select id, 'occurred', 'unknown'
    from public.medical_events
    where source_document_id = '13200000-0000-0000-0000-000000000010'
  $$,
  null,
  null,
  'a duplicate date role is rejected'
);

select lives_ok(
  $$
    select *
    from public.eh126_sync_document_event_dates(
      '13200000-0000-0000-0000-000000000010',
      jsonb_build_array(
        jsonb_build_object(
          'role', 'occurred',
          'precision', 'month',
          'value', '2026-08',
          'raw_text', '08/2026'
        )
      )
    )
  $$,
  'partial month synchronization succeeds without inventing a day'
);
select is(
  (
    select dates.precision
    from public.medical_event_dates dates
    join public.medical_events events on events.id = dates.medical_event_id
    where events.source_document_id = '13200000-0000-0000-0000-000000000010'
      and dates.date_role = 'occurred'
  ),
  'month',
  'partial month precision is retained'
);
select is(
  (
    select dates.value_text
    from public.medical_event_dates dates
    join public.medical_events events on events.id = dates.medical_event_id
    where events.source_document_id = '13200000-0000-0000-0000-000000000010'
      and dates.date_role = 'occurred'
  ),
  '2026-08',
  'partial month canonical value is retained'
);
select is(
  (
    select dates.raw_text
    from public.medical_event_dates dates
    join public.medical_events events on events.id = dates.medical_event_id
    where events.source_document_id = '13200000-0000-0000-0000-000000000010'
      and dates.date_role = 'occurred'
  ),
  '08/2026',
  'partial month source wording is retained'
);
select is(
  (
    select observed_at::text
    from public.documents
    where id = '13200000-0000-0000-0000-000000000010'
  ),
  null,
  'partial event dates clear the complete-day compatibility projection'
);
select is(
  (
    select occurred_sort_start_on::text
    from public.medical_event_timeline
    where document_id = '13200000-0000-0000-0000-000000000010'
  ),
  '2026-08-01',
  'partial date lower bound is internal and deterministic'
);
select is(
  (
    select occurred_sort_end_on::text
    from public.medical_event_timeline
    where document_id = '13200000-0000-0000-0000-000000000010'
  ),
  '2026-08-31',
  'partial date upper bound is internal and deterministic'
);

select lives_ok(
  $$
    select *
    from public.eh126_sync_document_event_dates(
      '13200000-0000-0000-0000-000000000010',
      jsonb_build_array(
        jsonb_build_object(
          'role', 'occurred',
          'precision', 'month',
          'value', '2026-08',
          'raw_text', '08/2026'
        )
      )
    )
  $$,
  'repeating the same date synchronization is idempotent'
);
select is(
  (
    select count(*)::bigint
    from public.medical_event_dates dates
    join public.medical_events events on events.id = dates.medical_event_id
    where events.source_document_id = '13200000-0000-0000-0000-000000000010'
  ),
  4::bigint,
  'idempotent synchronization does not multiply date-role rows'
);

select lives_ok(
  $$
    select *
    from public.eh126_sync_document_event_dates(
      '13200000-0000-0000-0000-000000000010',
      jsonb_build_array(
        jsonb_build_object(
          'role', 'occurred',
          'precision', 'instant',
          'value', '2026-08-24T23:30:00-04:00',
          'timezone', '-04:00'
        )
      )
    )
  $$,
  'an explicit-offset instant synchronizes successfully'
);
select is(
  (
    select dates.timezone
    from public.medical_event_dates dates
    join public.medical_events events on events.id = dates.medical_event_id
    where events.source_document_id = '13200000-0000-0000-0000-000000000010'
      and dates.date_role = 'occurred'
  ),
  '-04:00',
  'instant timezone evidence is retained'
);
select throws_ok(
  $$
    select *
    from public.eh126_sync_document_event_dates(
      '13200000-0000-0000-0000-000000000010',
      jsonb_build_array(
        jsonb_build_object(
          'role', 'occurred',
          'precision', 'instant',
          'value', '2026-08-24T23:30:00'
        )
      )
    )
  $$,
  null,
  null,
  'timezone-less instants are rejected'
);
select throws_ok(
  $$
    select *
    from public.eh126_sync_document_event_dates(
      '13200000-0000-0000-0000-000000000010',
      jsonb_build_array(
        jsonb_build_object(
          'role', 'occurred',
          'precision', 'month',
          'value', '2026-13'
        )
      )
    )
  $$,
  null,
  null,
  'invalid partial calendar values are rejected'
);
select throws_ok(
  $$
    insert into public.medical_events (profile_id, source_document_id, event_type)
    values (
      '13200000-0000-0000-0000-000000000002',
      '13200000-0000-0000-0000-000000000010',
      'lab_result'
    )
  $$,
  null,
  null,
  'medical events cannot cross profile ownership'
);

select is(
  (
    select count(*)::bigint
    from public.medical_event_timeline
    where profile_id = '13200000-0000-0000-0000-000000000001'
      and document_id in (
        '13200000-0000-0000-0000-000000000010',
        '13200000-0000-0000-0000-000000000011'
      )
  ),
  2::bigint,
  'the owner timeline contains only owner events'
);
select is(
  (
    select count(*)::bigint
    from public.medical_event_timeline
    where profile_id = '13200000-0000-0000-0000-000000000001'
      and document_id = '13200000-0000-0000-0000-000000000012'
  ),
  0::bigint,
  'the owner timeline excludes the second profile event'
);
select is(
  (
    select occurred_sort_start_on::text
    from public.medical_event_timeline
    where document_id = '13200000-0000-0000-0000-000000000010'
  ),
  '2026-08-25',
  'instant lower bound is normalized to its UTC calendar day'
);
select is(
  (
    select occurred_sort_end_on::text
    from public.medical_event_timeline
    where document_id = '13200000-0000-0000-0000-000000000010'
  ),
  '2026-08-25',
  'instant upper bound is normalized to its UTC calendar day'
);

select * from finish();
rollback;
