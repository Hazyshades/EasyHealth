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

select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_start_recording(uuid,uuid,text)',
    'EXECUTE'
  ),
  'service role can start consented recordings'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh170_start_recording(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot start recordings directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_claim_recording_transcription(text)',
    'EXECUTE'
  ),
  'service role can claim transcription leases'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_retention_delete_transcript(uuid,uuid)',
    'EXECUTE'
  ),
  'service role can invoke audited transcript retention'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_retention_list_audio_candidates(timestamptz)',
    'EXECUTE'
  ),
  'service role can enumerate audio retention candidates through the RPC boundary'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_retention_list_transcript_candidates(timestamptz)',
    'EXECUTE'
  ),
  'service role can enumerate transcript retention candidates through the RPC boundary'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_retention_list_note_candidates(timestamptz)',
    'EXECUTE'
  ),
  'service role can enumerate note retention candidates through the RPC boundary'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh170_retention_list_audio_candidates(timestamptz)',
    'EXECUTE'
  ),
  'authenticated clients cannot enumerate retention candidates directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.eh170_list_clinician_memberships(uuid)',
    'EXECUTE'
  ),
  'service role can list named clinician memberships'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh170_list_clinician_memberships(uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot list clinician memberships directly'
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
  ('00000000-0000-0000-0000-000000170003', 'eh170-other@example.test'),
  ('00000000-0000-0000-0000-000000170004', 'eh170-expiry-patient@example.test');

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
  'owner',
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
  requested_scopes,
  state,
  issued_by_profile_id
)
values (
  '00000000-0000-0000-0000-000000170020',
  '00000000-0000-0000-0000-000000170010',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  array['health_profile', 'observations', 'consultations'],
  array['health_profile', 'observations', 'consultations'],
  'pending',
  '00000000-0000-0000-0000-000000170002'
);

select is(
  (
    select allowed
    from public.eh170_authorize_patient_access(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001',
      'health_profile',
      'read'
    )
  ),
  false,
  'pending patient grant denies clinician reads'
);
select lives_ok(
  $$
    select * from public.eh170_approve_patient_access(
      '00000000-0000-0000-0000-000000170001',
      '00000000-0000-0000-0000-000000170020',
      array['health_profile', 'observations', 'consultations']
    )
  $$,
  'patient can approve the requested scopes'
);
select is(
  (
    select allowed
    from public.eh170_authorize_patient_access(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001',
      'consultations',
      'read'
    )
  ),
  true,
  'active patient grant allows only the approved consultation scope'
);

insert into public.patient_access_grants (
  id,
  clinic_id,
  patient_profile_id,
  clinician_profile_id,
  scopes,
  state,
  issued_by_profile_id,
  approved_by_profile_id,
  created_at,
  approved_at,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000170021',
  '00000000-0000-0000-0000-000000170010',
  '00000000-0000-0000-0000-000000170004',
  '00000000-0000-0000-0000-000000170002',
  array['health_profile'],
  'active',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170004',
  clock_timestamp() - interval '3 hours',
  clock_timestamp() - interval '2 hours',
  clock_timestamp() - interval '1 hour'
);
select is(
  (
    select allowed
    from public.eh170_authorize_patient_access(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170004',
      'health_profile',
      'read'
    )
  ),
  false,
  'expired patient grants deny clinician reads'
);
select is(
  (
    select state
    from public.patient_access_grants
    where id = '00000000-0000-0000-0000-000000170021'
  ),
  'expired',
  'expired access is recorded as an explicit transition'
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

select lives_ok(
  $$
    select * from public.eh170_invite_clinician_membership(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170003',
      'clinician'
    )
  $$,
  'clinic owner can invite a named clinician'
);
select is(
  (
    select status
    from public.clinic_memberships
    where clinic_id = '00000000-0000-0000-0000-000000170010'
      and clinician_profile_id = '00000000-0000-0000-0000-000000170003'
  ),
  'invited',
  'named clinician invitation starts pending'
);
select lives_ok(
  $$
    select * from public.eh170_accept_clinician_membership(
      '00000000-0000-0000-0000-000000170003',
      (
        select id from public.clinic_memberships
        where clinic_id = '00000000-0000-0000-0000-000000170010'
          and clinician_profile_id = '00000000-0000-0000-0000-000000170003'
      )
    )
  $$,
  'invited clinician can accept the named membership'
);

select lives_ok(
  $$
    select * from public.eh170_revoke_clinician_membership(
      '00000000-0000-0000-0000-000000170002',
      (
        select id from public.clinic_memberships
        where clinic_id = '00000000-0000-0000-0000-000000170010'
          and clinician_profile_id = '00000000-0000-0000-0000-000000170003'
      )
    )
  $$,
  'clinic owner can revoke the clinician membership'
);

select is(
  (
    select allowed
    from public.eh170_authorize_patient_access(
      '00000000-0000-0000-0000-000000170003',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001',
      'health_profile',
      'read'
    )
  ),
  false,
  'revoked clinician memberships deny patient reads'
);
insert into public.clinics (id, name, created_by_profile_id)
values (
  '00000000-0000-0000-0000-000000170012',
  'EH-170 Other Clinic',
  '00000000-0000-0000-0000-000000170003'
);
select is(
  (
    select allowed
    from public.eh170_authorize_patient_access(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170012',
      '00000000-0000-0000-0000-000000170001',
      'health_profile',
      'read'
    )
  ),
  false,
  'cross-clinic clinician access is denied'
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

select lives_ok(
  $$
    select * from public.eh170_start_recording(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030',
      'en'
    )
  $$,
  'clinician can start a recording only while consent and access are active'
);
select is(
  (
    select count(*)::integer
    from public.recording_sessions
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and status = 'recording'
  ),
  1,
  'recording start creates a consent-checked recording session'
);
select lives_ok(
  $$
    select * from public.eh170_revoke_recording_consent(
      '00000000-0000-0000-0000-000000170001',
      '00000000-0000-0000-0000-000000170040'
    )
  $$,
  'patient can revoke recording consent'
);
select throws_ok(
  $$
    select * from public.eh170_start_recording(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030',
      'en'
    )
  $$,
  null,
  null,
  'revoked recording consent prevents a new recording'
);

insert into public.recording_sessions (
  id,
  consultation_id,
  patient_profile_id,
  clinician_profile_id,
  consent_id,
  status,
  storage_path
)
values (
  '00000000-0000-0000-0000-000000170050',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170040',
  'transcript_ready',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170050.webm'
);

select throws_ok(
  $$
    select * from public.eh170_prepare_recording_upload(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170050',
      'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170050.webm'
    )
  $$,
  null,
  null,
  'revoked consent prevents private audio upload preparation'
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

update public.transcript_drafts
set status = 'ready',
    transcript_text = 'Synthetic transcript source',
    updated_at = clock_timestamp()
where recording_session_id = '00000000-0000-0000-0000-000000170050';

select lives_ok(
  $$
    select * from public.eh170_create_note_draft(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170050',
      jsonb_build_object(
        'summary', 'Synthetic note',
        'diagnosis', 'must not be accepted',
        'urgency_instruction', 'must not be accepted'
      ),
      jsonb_build_array(jsonb_build_object(
        'field', 'summary',
        'kind', 'transcript',
        'recording_id', '00000000-0000-0000-0000-000000170050'
      ))
    )
  $$,
  'note draft creation preserves a transcript source boundary'
);
select is(
  (
    select content ? 'diagnosis'
    from public.consultation_note_revisions
    where consultation_id = '00000000-0000-0000-0000-000000170030'
    order by revision_number desc
    limit 1
  ),
  false,
  'unsupported clinical directives are removed from note candidates'
);
select is(
  (
    select status
    from public.consultation_note_revisions
    where consultation_id = '00000000-0000-0000-0000-000000170030'
    order by revision_number desc
    limit 1
  ),
  'draft',
  'note candidate remains a draft until review'
);
select throws_ok(
  $$
    select * from public.eh170_save_note_revision(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030',
      '00000000-0000-0000-0000-000000170050',
      null,
      jsonb_build_object('summary', 'Missing source reference'),
      '[]'::jsonb,
      true
    )
  $$,
  null,
  null,
  'reviewed note requires a source reference for every persisted field'
);
select lives_ok(
  $$
    select * from public.eh170_save_note_revision(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030',
      '00000000-0000-0000-0000-000000170050',
      null,
      jsonb_build_object('summary', 'Reviewed synthetic note'),
      jsonb_build_array(jsonb_build_object(
        'field', 'summary',
        'kind', 'transcript',
        'recording_id', '00000000-0000-0000-0000-000000170050'
      )),
      true
    )
  $$,
  'clinician review appends a reviewed note revision'
);


select lives_ok(
  $$
    select * from public.eh170_revoke_patient_access(
      '00000000-0000-0000-0000-000000170001',
      '00000000-0000-0000-0000-000000170020'
    )
  $$,
  'patient can revoke an active clinic grant'
);
select is(
  (
    select allowed
    from public.eh170_authorize_patient_access(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001',
      'consultations',
      'read'
    )
  ),
  false,
  'revoked patient grant denies subsequent clinician reads'
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

select * from finish();
rollback;
