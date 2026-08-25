-- EH-144: versioned technical freshness policy and immutable assessment provenance.
begin;
select plan(14);

select has_column(
  'public',
  'health_profile_assessment_versions',
  'freshness_policy_version',
  'assessment versions persist the freshness policy identity'
);

select has_function(
  'public',
  'complete_assessment_recalculation_job',
  array['uuid', 'text', 'jsonb', 'uuid[]', 'text'],
  'assessment completion accepts an explicit freshness policy version'
);

insert into public.profiles (id)
values
  ('00000000-0000-0000-0000-000000000241'),
  ('00000000-0000-0000-0000-000000000242'),
  ('00000000-0000-0000-0000-000000000243'),
  ('00000000-0000-0000-0000-000000000244')
on conflict do nothing;

insert into public.health_profile_assessment_versions (
  profile_id,
  input_hash,
  payload,
  source_document_ids
)
values (
  '00000000-0000-0000-0000-000000000241',
  repeat('a', 64),
  jsonb_build_object('freshness_policy_version', 'eh-144.v1'),
  '{}'
);
select is(
  (select freshness_policy_version from public.health_profile_assessment_versions where input_hash = repeat('a', 64)),
  'eh-144.v1',
  'legacy version inserts receive the EH-144 default policy version'
);
select is(
  (select payload ->> 'freshness_policy_version' from public.health_profile_assessment_versions where input_hash = repeat('a', 64)),
  'eh-144.v1',
  'assessment payload keeps the self-describing policy version'
);
select throws_ok(
  $$update public.health_profile_assessment_versions
    set freshness_policy_version = 'eh-144.v2'
    where input_hash = repeat('a', 64)$$,
  'eh123_append_only',
  'assessment versions remain immutable after policy stamping'
);

insert into public.assessment_recalculation_jobs (
  id,
  profile_id,
  output_kind,
  status,
  attempts,
  max_attempts,
  started_at,
  lease_expires_at
)
values (
  '00000000-0000-0000-0000-000000000245',
  '00000000-0000-0000-0000-000000000242',
  'health_profile',
  'processing',
  1,
  3,
  now(),
  now() + interval '5 minutes'
);
select lives_ok(
  $$select public.complete_assessment_recalculation_job(
    '00000000-0000-0000-0000-000000000245',
    repeat('b', 64),
    jsonb_build_object('freshness_policy_version', 'eh-144.v2'),
    '{}'::uuid[],
    'eh-144.v2'
  )$$,
  'completion accepts and stores an explicit policy version'
);
select is(
  (select status::text from public.assessment_recalculation_jobs where id = '00000000-0000-0000-0000-000000000245'),
  'succeeded',
  'a valid policy-stamped completion succeeds'
);
select is(
  (select count(*)::int from public.health_profile_assessment_versions where profile_id = '00000000-0000-0000-0000-000000000242'),
  1,
  'one immutable assessment version is written for the completed job'
);
select is(
  (select freshness_policy_version from public.health_profile_assessment_versions where profile_id = '00000000-0000-0000-0000-000000000242'),
  'eh-144.v2',
  'the assessment row records the explicit policy version'
);
select is(
  (select payload ->> 'freshness_policy_version' from public.health_profile_assessment_versions where profile_id = '00000000-0000-0000-0000-000000000242'),
  'eh-144.v2',
  'the stored payload agrees with the row policy version'
);

insert into public.assessment_recalculation_jobs (
  id, profile_id, output_kind, status, attempts, max_attempts, started_at, lease_expires_at
)
values (
  '00000000-0000-0000-0000-000000000246',
  '00000000-0000-0000-0000-000000000243',
  'health_profile', 'processing', 1, 3, now(), now() + interval '5 minutes'
);
select lives_ok(
  $$select public.complete_assessment_recalculation_job(
    '00000000-0000-0000-0000-000000000246',
    repeat('c', 64),
    '{}'::jsonb,
    '{}'::uuid[]
  )$$,
  'completion keeps the default policy version for older callers'
);
select is(
  (select freshness_policy_version from public.health_profile_assessment_versions where profile_id = '00000000-0000-0000-0000-000000000243'),
  'eh-144.v1',
  'older four-argument callers receive the EH-144 default version'
);

insert into public.assessment_recalculation_jobs (
  id, profile_id, output_kind, status, attempts, max_attempts, started_at, lease_expires_at
)
values
  ('00000000-0000-0000-0000-000000000247', '00000000-0000-0000-0000-000000000244', 'health_profile', 'processing', 1, 3, now(), now() + interval '5 minutes');
select throws_ok(
  $$select public.complete_assessment_recalculation_job(
    '00000000-0000-0000-0000-000000000247',
    repeat('d', 64),
    jsonb_build_object('freshness_policy_version', 'eh-144.v1'),
    '{}'::uuid[],
    'eh-144.v2'
  )$$,
  'invalid_assessment_snapshot',
  'completion rejects a payload whose policy version disagrees with the row'
);
select throws_ok(
  $$select public.complete_assessment_recalculation_job(
    '00000000-0000-0000-0000-000000000247',
    repeat('e', 64),
    '{}'::jsonb,
    '{}'::uuid[],
    'eh-145.v1'
  )$$,
  'invalid_assessment_snapshot',
  'completion rejects an unknown policy version'
);

select * from finish();
rollback;
