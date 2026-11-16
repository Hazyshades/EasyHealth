begin;
select no_plan();

select has_table('public', 'clinics', 'clinic table exists');
select has_table('public', 'clinic_memberships', 'clinic membership table exists');
select has_table('public', 'patient_access_grants', 'patient access grant table exists');
select has_table('public', 'consultations', 'consultation table exists');
select has_table('public', 'consultation_sources', 'consultation source table exists');
select has_table('public', 'consultation_recording_consents', 'recording consent table exists');
select has_table('public', 'recording_sessions', 'recording session table exists');
select has_table('public', 'transcript_drafts', 'transcript draft table exists');
select has_table('public', 'consultation_note_revisions', 'consultation note revision table exists');
select has_table('public', 'clinical_access_events', 'clinical access event table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.clinics'::regclass),
  'clinic tables have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.patient_access_grants'::regclass),
  'patient access grants have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.recording_sessions'::regclass),
  'recording sessions have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.consultation_note_revisions'::regclass),
  'note revisions have row-level security enabled'
);

select ok(
  not has_table_privilege('service_role', 'public.clinics', 'SELECT'),
  'service role cannot read clinic tables directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_authorize_patient_access(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'service role can call the shared grant decision'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh170_authorize_patient_access(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the shared grant decision directly'
);

select is(
  (select public from storage.buckets where id = 'doctor-recordings'),
  false,
  'doctor recordings bucket is private'
);
select ok(
  (select array['audio/wav', 'audio/webm']::text[] <@ allowed_mime_types
   from storage.buckets
   where id = 'doctor-recordings'),
  'doctor recordings bucket accepts supported audio types'
);

insert into public.profiles (id, email)
values
  ('00000000-0000-0000-0000-000000170001', 'eh170-patient@example.test'),
  ('00000000-0000-0000-0000-000000170002', 'eh170-clinician@example.test'),
  ('00000000-0000-0000-0000-000000170003', 'eh170-other@example.test');

insert into public.clinics (id, name, created_by_profile_id)
values (
  '00000000-0000-0000-0000-000000170010',
  'EH-170 Synthetic Clinic',
  '00000000-0000-0000-0000-000000170002'
);

insert into public.clinic_memberships (
  id,
  clinic_id,
  clinician_profile_id,
  role,
  status,
  invited_by_profile_id,
  accepted_at
)
values (
  '00000000-0000-0000-0000-000000170011',
  '00000000-0000-0000-0000-000000170010',
  '00000000-0000-0000-0000-000000170002',
  'clinician',
  'active',
  '00000000-0000-0000-0000-000000170002',
  clock_timestamp()
);

select throws_ok(
  $$
    insert into public.clinic_memberships (
      clinic_id,
      clinician_profile_id,
      status,
      invited_by_profile_id,
      accepted_at
    )
    values (
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170002',
      'active',
      '00000000-0000-0000-0000-000000170002',
      clock_timestamp()
    )
  $$,
  null,
  null,
  'a clinician has one membership per clinic'
);

insert into public.patient_access_grants (
  id,
  clinic_id,
  patient_profile_id,
  clinician_profile_id,
  scopes,
  state,
  issued_by_profile_id
)
values (
  '00000000-0000-0000-0000-000000170020',
  '00000000-0000-0000-0000-000000170010',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  array['health_profile', 'observations', 'consultations'],
  'pending',
  '00000000-0000-0000-0000-000000170002'
);

select throws_ok(
  $$
    insert into public.patient_access_grants (
      clinic_id,
      patient_profile_id,
      clinician_profile_id,
      scopes,
      state,
      issued_by_profile_id
    )
    values (
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001',
      '00000000-0000-0000-0000-000000170002',
      array['health_profile'],
      'pending',
      '00000000-0000-0000-0000-000000170002'
    )
  $$,
  null,
  null,
  'only one pending or active grant exists for a named clinician'
);

select throws_ok(
  $$
    insert into public.patient_access_grants (
      clinic_id,
      patient_profile_id,
      clinician_profile_id,
      scopes,
      state,
      issued_by_profile_id
    )
    values (
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001',
      '00000000-0000-0000-0000-000000170003',
      array['unknown_scope'],
      'pending',
      '00000000-0000-0000-0000-000000170003'
    )
  $$,
  null,
  null,
  'unknown patient resource scopes are rejected'
);

insert into public.consultations (
  id,
  clinic_id,
  patient_profile_id,
  clinician_profile_id,
  created_by_profile_id,
  status,
  title,
  started_at
)
values (
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170010',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170002',
  'in_progress',
  'Synthetic consultation',
  clock_timestamp()
);

insert into public.consultation_recording_consents (
  id,
  consultation_id,
  patient_profile_id,
  clinician_profile_id
)
values (
  '00000000-0000-0000-0000-000000170040',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002'
);

insert into public.recording_sessions (
  id,
  consultation_id,
  patient_profile_id,
  clinician_profile_id,
  consent_id,
  status
)
values (
  '00000000-0000-0000-0000-000000170050',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170040',
  'consent_checked'
);

insert into public.transcript_drafts (
  recording_session_id,
  consultation_id,
  patient_profile_id,
  status
)
values (
  '00000000-0000-0000-0000-000000170050',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  'processing'
);

insert into public.consultation_note_revisions (
  consultation_id,
  patient_profile_id,
  recording_session_id,
  transcript_draft_id,
  revision_number,
  content,
  source_references,
  authored_by_profile_id
)
values (
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170050',
  (select id from public.transcript_drafts where recording_session_id = '00000000-0000-0000-0000-000000170050'),
  1,
  '{}'::jsonb,
  '[]'::jsonb,
  '00000000-0000-0000-0000-000000170002'
);

select throws_ok(
  $$
    insert into public.consultation_note_revisions (
      consultation_id,
      patient_profile_id,
      revision_number,
      status,
      authored_by_profile_id
    )
    values (
      '00000000-0000-0000-0000-000000170030',
      '00000000-0000-0000-0000-000000170001',
      2,
      'reviewed',
      '00000000-0000-0000-0000-000000170002'
    )
  $$,
  null,
  null,
  'reviewed note revisions require reviewer metadata'
);

savepoint eh170_rollback_check;
insert into public.clinics (name, created_by_profile_id)
values ('EH-170 rollback fixture', '00000000-0000-0000-0000-000000170002');
rollback to savepoint eh170_rollback_check;
select is(
  (select count(*)::integer from public.clinics where name = 'EH-170 rollback fixture'),
  0,
  'foundation writes can be rolled back transactionally'
);

rollback;
