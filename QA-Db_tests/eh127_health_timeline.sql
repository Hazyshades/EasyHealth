begin;

select plan(13);

select has_table(
  'public',
  'documents',
  'EH-127 reads the existing profile-owned documents source'
);
select has_column(
  'public',
  'documents',
  'document_type',
  'timeline source rows retain their document type'
);
select has_column(
  'public',
  'documents',
  'observed_at',
  'timeline source rows expose an explicit medical date when known'
);
select has_column(
  'public',
  'document_extracted_clinical_notes',
  'visit_date',
  'consultation events have a typed visit date available to the projection'
);
select has_column(
  'public',
  'document_extracted_referrals',
  'referral_date',
  'referral events have a typed referral date available to the projection'
);

insert into public.profiles (id, email) values
  ('00000000-0000-4000-8000-000000001271', 'eh127-owner@example.test'),
  ('00000000-0000-4000-8000-000000001272', 'eh127-other@example.test');

select lives_ok($$
  insert into public.documents (
    id, profile_id, storage_path, original_filename, status, document_type, observed_at
  ) values
    (
      '00000000-0000-4000-8000-000000001273',
      '00000000-0000-4000-8000-000000001271',
      'eh127/owner-lab.pdf',
      'owner-lab.pdf',
      'completed',
      'lab_result',
      '2025-02-03'
    ),
    (
      '00000000-0000-4000-8000-000000001274',
      '00000000-0000-4000-8000-000000001271',
      'eh127/owner-consultation.pdf',
      'owner-consultation.pdf',
      'completed',
      'consultation_note',
      null
    )
$$, 'synthetic owner documents can be projected with known and unknown dates');

select lives_ok($$
  insert into public.documents (
    id, profile_id, storage_path, original_filename, status, document_type, observed_at
  ) values (
    '00000000-0000-4000-8000-000000001275',
    '00000000-0000-4000-8000-000000001272',
    'eh127/other-referral.pdf',
    'other-referral.pdf',
    'completed',
    'referral',
    '2025-03-01'
  )
$$, 'a second synthetic profile can own an independent source document');

select is(
  (
    select count(*)::bigint
    from public.documents
    where profile_id = '00000000-0000-4000-8000-000000001271'
      and document_type in (
        'lab_result',
        'instrumental_report',
        'consultation_note',
        'discharge_summary',
        'prescription',
        'referral'
      )
  ),
  2::bigint,
  'the owner projection source contains only the owner''s supported documents'
);
select is(
  (
    select count(*)::bigint
    from public.documents
    where profile_id = '00000000-0000-4000-8000-000000001271'
      and observed_at is null
  ),
  1::bigint,
  'an unknown medical date remains null in the source'
);
select is(
  (
    select count(*)::bigint
    from public.documents
    where profile_id = '00000000-0000-4000-8000-000000001271'
      and id = '00000000-0000-4000-8000-000000001275'
  ),
  0::bigint,
  'a different profile source cannot enter the owner projection set'
);
select is(
  (
    select count(*)::bigint
    from public.documents
    where profile_id = '00000000-0000-4000-8000-000000001271'
      and observed_at = '2025-02-03'
  ),
  1::bigint,
  'explicit document medical dates remain queryable for date filtering'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.documents'::regclass
  ),
  'documents keep row-level security enabled'
);
select ok(
  has_table_privilege('service_role', 'public.documents', 'SELECT'),
  'the server-side timeline reader can select documents through service_role'
);
select * from finish();
rollback;
