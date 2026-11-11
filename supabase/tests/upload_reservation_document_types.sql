begin;

select no_plan();

insert into public.profiles (id, email)
values (
  '00000000-0000-0000-0000-000000009101',
  'upload-reservation-types@example.test'
);

select lives_ok(
  $$
    select *
    from public.create_document_upload_reservation(
      '00000000-0000-0000-0000-000000009101',
      'probe.pdf',
      'application/pdf',
      5,
      repeat('a', 64),
      'lab_result',
      'pdf',
      'pdf'
    )
  $$,
  'lab-result uploads reserve successfully'
);

select lives_ok(
  $$
    select *
    from public.create_document_upload_reservation(
      '00000000-0000-0000-0000-000000009101',
      'probe.pdf',
      'application/pdf',
      5,
      repeat('b', 64),
      'instrumental_report',
      'pdf',
      'pdf'
    )
  $$,
  'instrumental-report uploads reserve successfully'
);

select lives_ok(
  $$
    select *
    from public.create_document_upload_reservation(
      '00000000-0000-0000-0000-000000009101',
      'probe.pdf',
      'application/pdf',
      5,
      repeat('c', 64),
      'consultation_note',
      'pdf',
      'pdf'
    )
  $$,
  'consultation-note uploads reserve successfully'
);

select lives_ok(
  $$
    select *
    from public.create_document_upload_reservation(
      '00000000-0000-0000-0000-000000009101',
      'probe.pdf',
      'application/pdf',
      5,
      repeat('d', 64),
      'discharge_summary',
      'pdf',
      'pdf'
    )
  $$,
  'discharge-summary uploads reserve successfully'
);

select lives_ok(
  $$
    select *
    from public.create_document_upload_reservation(
      '00000000-0000-0000-0000-000000009101',
      'probe.pdf',
      'application/pdf',
      5,
      repeat('e', 64),
      'prescription',
      'pdf',
      'pdf'
    )
  $$,
  'prescription uploads reserve successfully'
);

select lives_ok(
  $$
    select *
    from public.create_document_upload_reservation(
      '00000000-0000-0000-0000-000000009101',
      'probe.pdf',
      'application/pdf',
      5,
      repeat('f', 64),
      'referral',
      'pdf',
      'pdf'
    )
  $$,
  'referral uploads reserve successfully'
);

select is(
  (
    select count(*)
    from public.documents
    where profile_id = '00000000-0000-0000-0000-000000009101'
  ),
  6::bigint,
  'every uploadable document type creates one pending reservation'
);

select * from finish();
rollback;
