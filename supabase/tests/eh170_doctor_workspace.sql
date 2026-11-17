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
    'public.eh170_retention_actor_is_valid(uuid)',
    'EXECUTE'
  ),
  'service role can validate the retention deletion actor'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.eh170_retention_actor_is_valid(uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot validate retention actors directly'
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

select is(
  public.eh170_retention_actor_is_valid(
    '00000000-0000-0000-0000-000000170002'
  ),
  true,
  'configured retention actor must reference an existing profile'
);
select is(
  public.eh170_retention_actor_is_valid(
    '00000000-0000-0000-0000-000000170099'
  ),
  false,
  'unknown retention actor disables deletion eligibility'
);

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

select lives_ok(
  $$
    select * from public.eh170_list_workspace_access(
      '00000000-0000-0000-0000-000000170002'
    )
  $$,
  'clinician can list active workspace grants'
);
select is(
  (
    select count(*)::integer
    from public.clinical_access_events
    where actor_profile_id = '00000000-0000-0000-0000-000000170002'
      and grant_id = '00000000-0000-0000-0000-000000170020'
      and resource_kind = 'grant'
      and operation = 'read'
      and result = 'allowed'
  ),
  1,
  'workspace grant listing emits an audit event'
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
select lives_ok(
  $$
    select * from public.eh170_invite_clinician_membership(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170003',
      'clinician'
    )
  $$,
  'clinic owner can reinvite a previously revoked clinician'
);
select lives_ok(
  $$
    select * from public.eh170_accept_clinician_membership(
      '00000000-0000-0000-0000-000000170003',
      (
        select id
        from public.clinic_memberships
        where clinic_id = '00000000-0000-0000-0000-000000170010'
          and clinician_profile_id = '00000000-0000-0000-0000-000000170003'
          and status = 'invited'
        order by invited_at desc
        limit 1
      )
    )
  $$,
  'reinvited clinician can accept the membership'
);
insert into public.patient_access_grants (
  id,
  clinic_id,
  patient_profile_id,
  clinician_profile_id,
  scopes,
  requested_scopes,
  state,
  issued_by_profile_id,
  approved_by_profile_id,
  approved_at
)
values (
  '00000000-0000-0000-0000-000000170022',
  '00000000-0000-0000-0000-000000170010',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170003',
  array['consultations'],
  array['consultations'],
  'active',
  '00000000-0000-0000-0000-000000170003',
  '00000000-0000-0000-0000-000000170001',
  clock_timestamp()
);
select is(
  (
    select state
    from public.patient_access_grants
    where id = '00000000-0000-0000-0000-000000170022'
  ),
  'active',
  'second clinician has an active consultation grant for ownership checks'
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
select lives_ok(
  $$
    select * from public.eh170_cancel_recording(
      '00000000-0000-0000-0000-000000170002',
      (
        select id
        from public.recording_sessions
        where consultation_id = '00000000-0000-0000-0000-000000170030'
          and status = 'recording'
        order by created_at desc
        limit 1
      )
    )
  $$,
  'clinician can cancel an upload after consent revocation'
);
update public.consultation_recording_consents
set state = 'active',
    revoked_at = null,
    expires_at = clock_timestamp() + interval '1 millisecond'
where id = '00000000-0000-0000-0000-000000170040';
select pg_sleep(0.01);
select lives_ok(
  $$
    select * from public.eh170_grant_recording_consent(
      '00000000-0000-0000-0000-000000170001',
      '00000000-0000-0000-0000-000000170030',
      clock_timestamp() + interval '1 hour'
    )
  $$,
  'patient can renew an expired active recording consent'
);
select is(
  (
    select count(*)::integer
    from public.consultation_recording_consents
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and state = 'active'
  ),
  1,
  'consent renewal leaves one active consent'
);
select is(
  (
    select state
    from public.consultation_recording_consents
    where id = '00000000-0000-0000-0000-000000170040'
  ),
  'expired',
  'expired consent is closed before renewal'
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
update public.recording_sessions
set consent_id = (
  select id
  from public.consultation_recording_consents
  where consultation_id = '00000000-0000-0000-0000-000000170030'
    and state = 'active'
  order by granted_at desc
  limit 1
)
where id = '00000000-0000-0000-0000-000000170050';

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
        'summary', jsonb_build_object(
          'text', 'Synthetic note',
          'diagnosis', 'must not be accepted'
        ),
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
    select (content->'summary') ? 'diagnosis'
    from public.consultation_note_revisions
    where consultation_id = '00000000-0000-0000-0000-000000170030'
    order by revision_number desc
    limit 1
  ),
  false,
  'nested unsupported clinical directives are removed from note candidates'
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
select is(
  (
    select status
    from public.recording_sessions
    where id = '00000000-0000-0000-0000-000000170050'
  ),
  'completed',
  'reviewed note finalizes the recording lifecycle'
);
select throws_ok(
  $$
    select * from public.eh170_delete_transcript(
      '00000000-0000-0000-0000-000000170003',
      '00000000-0000-0000-0000-000000170050'
    )
  $$,
  null,
  null,
  'a different clinician cannot delete another clinician transcript'
);
select throws_ok(
  $$
    select * from public.eh170_delete_note_revision(
      '00000000-0000-0000-0000-000000170003',
      (
        select id
        from public.consultation_note_revisions
        where recording_session_id = '00000000-0000-0000-0000-000000170050'
        order by revision_number desc
        limit 1
      )
    )
  $$,
  null,
  null,
  'a different clinician cannot delete another clinician note'
);
select lives_ok(
  $$
    select * from public.eh170_prepare_recording_audio_delete(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170050'
    )
  $$,
  'manual audio deletion creates an authorized deletion intent'
);
select lives_ok(
  $$
    select * from public.eh170_mark_recording_audio_deleted(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170050'
    )
  $$,
  'reviewed note survives independent audio deletion'
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
  '00000000-0000-0000-0000-000000170056',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  (
    select id
    from public.consultation_recording_consents
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and state = 'active'
    order by granted_at desc
    limit 1
  ),
  'cancelled',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170056.webm'
);
select lives_ok(
  $$
    select * from public.eh170_retention_prepare_audio_delete(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170056',
      clock_timestamp() + interval '1 minute'
    )
  $$,
  'retention audio deletion records an intent before storage removal'
);
select lives_ok(
  $$
    select * from public.eh170_retention_mark_audio_deleted(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170056'
    )
  $$,
  'retention audio deletion emits one transition'
);
select lives_ok(
  $$
    select * from public.eh170_retention_mark_audio_deleted(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170056'
    )
  $$,
  'repeated retention audio deletion remains harmless'
);
select is(
  (
    select count(*)::integer
    from public.clinical_access_events
    where actor_profile_id = '00000000-0000-0000-0000-000000170002'
      and patient_profile_id = '00000000-0000-0000-0000-000000170001'
      and resource_kind = 'recording'
      and operation = 'delete'
  ),
  2,
  'repeated retention deletion emits no duplicate audit transition'
);
select is(
  (
    select latest_note->>'source_audio_available'
    from public.eh170_list_consultations(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170010',
      '00000000-0000-0000-0000-000000170001'
    )
    where consultation_id = '00000000-0000-0000-0000-000000170030'
  ),
  'false',
  'reviewed note exposes deleted audio as unavailable provenance'
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
  '00000000-0000-0000-0000-000000170051',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  (
    select id
    from public.consultation_recording_consents
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and state = 'active'
    order by granted_at desc
    limit 1
  ),
  'transcript_ready',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170051.webm'
);
insert into public.transcript_drafts (
  recording_session_id,
  consultation_id,
  patient_profile_id,
  status,
  transcript_text
)
values (
  '00000000-0000-0000-0000-000000170051',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  'ready',
  'Second recording transcript'
);
select lives_ok(
  $$
    select * from public.eh170_create_note_draft(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170051',
      jsonb_build_object('summary', 'Second recording draft'),
      jsonb_build_array(jsonb_build_object(
        'field', 'summary',
        'kind', 'transcript',
        'recording_id', '00000000-0000-0000-0000-000000170051'
      ))
    )
  $$,
  'second recording can create an independent note draft'
);
select is(
  (
    select latest_note_status
    from public.eh170_list_recordings(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030'
    )
    where recording_id = '00000000-0000-0000-0000-000000170050'
  ),
  'reviewed',
  'recording list keeps the first recording note status scoped'
);
select is(
  (
    select latest_note_status
    from public.eh170_list_recordings(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030'
    )
    where recording_id = '00000000-0000-0000-0000-000000170051'
  ),
  'draft',
  'recording list exposes the second recording draft status'
);
select is(
  (
    select latest_note->'content'->>'summary'
    from public.eh170_read_recording(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170050'
    )
  ),
  'Reviewed synthetic note',
  'recording read keeps note content scoped to the selected recording'
);
select lives_ok(
  $$
    select * from public.eh170_save_note_revision(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030',
      '00000000-0000-0000-0000-000000170051',
      null,
      jsonb_build_object('summary', 'Second recording reviewed note'),
      jsonb_build_array(jsonb_build_object(
        'field', 'summary',
        'kind', 'transcript',
        'recording_id', '00000000-0000-0000-0000-000000170051'
      )),
      true
    )
  $$,
  'second recording review appends an independent revision'
);
select is(
  (
    select status
    from public.consultation_note_revisions
    where recording_session_id = '00000000-0000-0000-0000-000000170050'
    order by revision_number desc
    limit 1
  ),
  'reviewed',
  'reviewing the second recording does not supersede the first note'
);
insert into public.recording_sessions (
  id,
  consultation_id,
  patient_profile_id,
  clinician_profile_id,
  consent_id,
  status,
  storage_path,
  transcription_lease_expires_at
)
values (
  '00000000-0000-0000-0000-000000170054',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  (
    select id
    from public.consultation_recording_consents
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and state = 'active'
    order by granted_at desc
    limit 1
  ),
  'transcribing',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170054.webm',
  clock_timestamp() - interval '1 minute'
);
select is(
  (
    select recording_id::text
    from public.eh170_claim_recording_transcription('eh170-test-worker')
    limit 1
  ),
  '00000000-0000-0000-0000-000000170054',
  'expired transcription leases are reclaimable'
);
select lives_ok(
  $$
    select * from public.eh170_release_recording_transcription(
      '00000000-0000-0000-0000-000000170054',
      (
        select transcription_lease_token
        from public.recording_sessions
        where id = '00000000-0000-0000-0000-000000170054'
      )
    )
  $$,
  'cohort exclusion can release a transcription lease without failing the recording'
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
  '00000000-0000-0000-0000-000000170057',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  (
    select id
    from public.consultation_recording_consents
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and state = 'active'
    order by granted_at desc
    limit 1
  ),
  'uploaded',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170057.webm'
);
select lives_ok(
  $$
    select * from public.eh170_prepare_recording_audio_delete(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170057'
    )
  $$,
  'audio deletion intent is recorded before a later grant revoke'
);
update public.recording_sessions
set status = 'uploading'
where id = '00000000-0000-0000-0000-000000170057';
select throws_ok(
  $$
    select * from public.eh170_prepare_recording_upload(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170057',
      'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170059.webm'
    )
  $$,
  null,
  null,
  'pending audio deletion blocks upload path replacement'
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
  '00000000-0000-0000-0000-000000170058',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  (
    select id
    from public.consultation_recording_consents
    where consultation_id = '00000000-0000-0000-0000-000000170030'
      and state = 'active'
    order by granted_at desc
    limit 1
  ),
  'uploaded',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170058.webm'
);
select lives_ok(
  $$
    select * from public.eh170_prepare_recording_audio_delete(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170058'
    )
  $$,
  'manual deletion intent can become retention-owned after it is stale'
);
update public.recording_sessions
set source_audio_delete_requested_at = clock_timestamp() - interval '2 days'
where id = '00000000-0000-0000-0000-000000170058';
select lives_ok(
  $$
    select * from public.eh170_retention_prepare_audio_delete(
      '00000000-0000-0000-0000-000000170003',
      '00000000-0000-0000-0000-000000170058',
      clock_timestamp()
    )
  $$,
  'retention can take over an abandoned stale deletion intent'
);
select lives_ok(
  $$
    select * from public.eh170_retention_mark_audio_deleted(
      '00000000-0000-0000-0000-000000170003',
      '00000000-0000-0000-0000-000000170058'
    )
  $$,
  'retention finalizes a recovered deletion intent'
);

select lives_ok(
  $$
    select * from public.eh170_revoke_recording_consent(
      '00000000-0000-0000-0000-000000170001',
      (
        select id
        from public.consultation_recording_consents
        where consultation_id = '00000000-0000-0000-0000-000000170030'
          and state = 'active'
        order by granted_at desc
        limit 1
      )
    )
  $$,
  'patient can revoke the active consent after review'
);
select throws_ok(
  $$
    select * from public.eh170_save_note_revision(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170030',
      '00000000-0000-0000-0000-000000170050',
      null,
      jsonb_build_object('summary', 'Must not persist after consent revoke'),
      jsonb_build_array(jsonb_build_object(
        'field', 'summary',
        'kind', 'transcript',
        'recording_id', '00000000-0000-0000-0000-000000170050'
      )),
      true
    )
  $$,
  null,
  null,
  'consent revocation blocks derived note persistence'
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
select lives_ok(
  $$
    select * from public.eh170_mark_recording_audio_deleted(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170057'
    )
  $$,
  'authorized deletion intent can finalize after grant revoke'
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
  '00000000-0000-0000-0000-000000170052',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170040',
  'recording',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170052.webm'
);

insert into public.recording_sessions (
  id,
  consultation_id,
  patient_profile_id,
  clinician_profile_id,
  consent_id,
  status,
  storage_path,
  uploaded_at
)
values (
  '00000000-0000-0000-0000-000000170053',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170040',
  'cancelled',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170053.webm',
  clock_timestamp() - interval '2 days'
);

insert into public.recording_sessions (
  id,
  consultation_id,
  patient_profile_id,
  clinician_profile_id,
  consent_id,
  status,
  storage_path,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000170055',
  '00000000-0000-0000-0000-000000170030',
  '00000000-0000-0000-0000-000000170001',
  '00000000-0000-0000-0000-000000170002',
  '00000000-0000-0000-0000-000000170040',
  'uploading',
  'consultations/00000000-0000-0000-0000-000000170030/recordings/00000000-0000-0000-0000-000000170055.webm',
  clock_timestamp() - interval '2 days'
);
select is(
  (
    select count(*)::integer
    from public.eh170_retention_list_audio_candidates(clock_timestamp())
    where recording_id = '00000000-0000-0000-0000-000000170055'
  ),
  1,
  'retention includes stale uploaded objects without completion timestamps'
);
select is(
  (
    select count(*)::integer
    from public.eh170_retention_list_audio_candidates(clock_timestamp())
    where recording_id = '00000000-0000-0000-0000-000000170053'
  ),
  1,
  'retention includes uploaded audio from cancelled recordings'
);
select throws_ok(
  $$
    select * from public.eh170_cancel_recording(
      '00000000-0000-0000-0000-000000170002',
      '00000000-0000-0000-0000-000000170052'
    )
  $$,
  null,
  null,
  'revoked patient grant blocks recording cancellation'
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
