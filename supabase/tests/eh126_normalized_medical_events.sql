begin;

select plan(24);

select ok(
  to_regclass('public.medical_events') is not null,
  'medical_events table exists'
);

select ok(
  to_regclass('public.medical_event_dates') is not null,
  'medical_event_dates table exists'
);

select ok(
  to_regclass('public.medical_event_timeline') is not null,
  'medical_event_timeline view exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.eh126_sync_document_event_dates(uuid,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service_role can synchronize event dates'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.eh126_sync_document_event_dates(uuid,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot synchronize event dates'
);

select ok(
  has_table_privilege('service_role', 'public.medical_event_timeline', 'SELECT'),
  'service_role can select the timeline view'
);

select ok(
  not has_table_privilege('anon', 'public.medical_event_timeline', 'SELECT'),
  'anon cannot select the timeline view'
);
select ok(
  public.eh119_is_measurement_override('{"observed_at": null}'::jsonb),
  'explicit null observed_at corrections are valid'
);


insert into public.profiles (id, email)
values
  ('12600000-0000-0000-0000-000000000001', 'eh126-primary@example.test'),
  ('12600000-0000-0000-0000-000000000002', 'eh126-secondary@example.test');

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
    '12600000-0000-0000-0000-000000000010',
    '12600000-0000-0000-0000-000000000001',
    'eh126/known.pdf',
    'known.pdf',
    'processing',
    'lab_result',
    '2026-08-16'
  ),
  (
    '12600000-0000-0000-0000-000000000011',
    '12600000-0000-0000-0000-000000000001',
    'eh126/unknown.pdf',
    'unknown.pdf',
    'processing',
    'consultation_note',
    null
  ),
  (
    '12600000-0000-0000-0000-000000000012',
    '12600000-0000-0000-0000-000000000002',
    'eh126/other-profile.pdf',
    'other-profile.pdf',
    'processing',
    'referral',
    null
  );

select is(
  (
    select count(*)::integer
    from public.medical_events
    where source_document_id in (
      '12600000-0000-0000-0000-000000000010',
      '12600000-0000-0000-0000-000000000011',
      '12600000-0000-0000-0000-000000000012'
    )
  ),
  3,
  'document creation creates exactly one event per source document'
);
select is(
  (
    select count(*)::integer
    from public.documents d
    left join public.medical_events e on e.source_document_id = d.id
    where e.id is null
  ),
  0,
  'migration backfill leaves no source document without an event'
);


select is(
  (
    select count(*)::integer
    from public.medical_event_dates d
    join public.medical_events e on e.id = d.medical_event_id
    where e.source_document_id = '12600000-0000-0000-0000-000000000010'
  ),
  4,
  'each event starts with all supported date roles'
);

select is(
  (
    select event_type
    from public.medical_events
    where source_document_id = '12600000-0000-0000-0000-000000000010'
  ),
  'lab_result',
  'event type follows the source document type'
);

select throws_ok(
  $$
    insert into public.medical_events (profile_id, source_document_id, event_type)
    values (
      '12600000-0000-0000-0000-000000000002',
      '12600000-0000-0000-0000-000000000010',
      'lab_result'
    )
  $$,
  null,
  null,
  'event ownership cannot cross profiles'
);

select throws_ok(
  $$
    update public.medical_event_dates
    set precision = 'unknown', value_text = '2026'
    where medical_event_id = (
      select id from public.medical_events
      where source_document_id = '12600000-0000-0000-0000-000000000010'
    )
      and date_role = 'occurred'
  $$,
  null,
  null,
  'unknown dates cannot retain a value'
);

select lives_ok(
  $$
    select *
    from public.eh126_sync_document_event_dates(
      '12600000-0000-0000-0000-000000000010',
      jsonb_build_array(
        jsonb_build_object(
          'role', 'occurred',
          'precision', 'month',
          'value', '2026-08',
          'raw_text', '08/2026'
        ),
        jsonb_build_object(
          'role', 'collected',
          'precision', 'unknown',
          'raw_text', 'not stated'
        )
      )
    )
  $$,
  'partial and unknown source dates synchronize without invented precision'
);

select is(
  (
    select d.precision
    from public.medical_event_dates d
    join public.medical_events e on e.id = d.medical_event_id
    where e.source_document_id = '12600000-0000-0000-0000-000000000010'
      and d.date_role = 'occurred'
  ),
  'month',
  'occurred precision is preserved'
);

select is(
  (
    select d.value_text
    from public.medical_event_dates d
    join public.medical_events e on e.id = d.medical_event_id
    where e.source_document_id = '12600000-0000-0000-0000-000000000010'
      and d.date_role = 'occurred'
  ),
  '2026-08',
  'normalized date value is stored separately from raw text'
);

select is(
  (
    select observed_at::text
    from public.documents
    where id = '12600000-0000-0000-0000-000000000010'
  ),
  null,
  'legacy day projection is cleared for a partial occurred date'
);

select lives_ok(
  $$
    insert into public.observations (
      id,
      profile_id,
      document_id,
      name,
      value,
      unit,
      observed_at,
      observation_kind,
      value_kind
    )
    values (
      '12600000-0000-0000-0000-000000000020',
      '12600000-0000-0000-0000-000000000001',
      '12600000-0000-0000-0000-000000000010',
      'Glucose',
      5.4,
      'mmol/L',
      null,
      'lab',
      'numeric'
    )
  $$,
  'observations can omit observed_at when the event date is unknown or partial'
);

select is(
  (
    select medical_event_id::text
    from public.observations
    where id = '12600000-0000-0000-0000-000000000020'
  ),
  (
    select id::text
    from public.medical_events
    where source_document_id = '12600000-0000-0000-0000-000000000010'
  ),
  'observation links to its source document event'
);

select is(
  (
    select count(*)::integer
    from public.medical_event_timeline
    where profile_id = '12600000-0000-0000-0000-000000000001'
  ),
  2,
  'timeline is scoped to the profile'
);

select is(
  (
    select count(*)::integer
    from public.medical_event_timeline
    where profile_id = '12600000-0000-0000-0000-000000000002'
  ),
  1,
  'timeline does not leak another profile'
);

select is(
  (
    select occurred_unknown_rank
    from public.medical_event_timeline
    where profile_id = '12600000-0000-0000-0000-000000000001'
      and document_id = '12600000-0000-0000-0000-000000000010'
  ),
  0,
  'known occurred dates sort before unknown dates'
);

select is(
  (
    select document_id::text
    from public.medical_event_timeline
    where profile_id = '12600000-0000-0000-0000-000000000001'
    order by occurred_unknown_rank, occurred_sort_start_on, occurred_sort_end_on, occurred_sort_at, event_id
    limit 1
  ),
  '12600000-0000-0000-0000-000000000010',
  'timeline ordering uses deterministic internal sort bounds'
);

select * from finish();
rollback;
