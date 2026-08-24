-- EH-123: durable assessment invalidation and immutable score versions.
begin;
select plan(21);

insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000231') on conflict do nothing;
insert into public.documents (id, profile_id, storage_path, original_filename, status)
values ('00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-000000000231', 'eh123/doc', 'eh123.pdf', 'completed') on conflict do nothing;

insert into public.observation_change_events (id, event_kind, origin, profile_id, document_id, observation_id)
values ('00000000-0000-0000-0000-000000000233', 'verification_changed', 'capture', '00000000-0000-0000-0000-000000000231', '00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-000000000234');
select is((select count(*)::int from public.assessment_dependency_events where source_change_event_id = '00000000-0000-0000-0000-000000000233'), 1, 'one live source event creates one dependency event');
select is((select status::text from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'), 'queued', 'live source event queues Health Profile recalculation');
select ok((select stale from public.profile_health_synthesis_state where profile_id = '00000000-0000-0000-0000-000000000231'), 'live source event marks synthesis stale');

insert into public.observation_change_events (id, event_kind, origin, profile_id, document_id, observation_id)
values ('00000000-0000-0000-0000-000000000235', 'verification_changed', 'backfill', '00000000-0000-0000-0000-000000000231', '00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-000000000236');
select is((select count(*)::int from public.assessment_dependency_events where source_change_event_id = '00000000-0000-0000-0000-000000000235'), 0, 'backfill does not queue assessment work');

select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessment_dependency_events'
      and column_name in (
        'raw_name', 'raw_value_text', 'raw_reference_text', 'raw_unit',
        'source_text', 'bounding_box', 'resolver_evidence', 'resolver_decision_trace'
      )
  ),
  0,
  'dependency events do not duplicate raw document or resolver evidence'
);

select lives_ok('select * from public.claim_assessment_recalculation_job()', 'one worker can claim queued work');
select is((select status::text from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'), 'processing', 'claim transitions the job to processing');

select is(
  (select count(*)::int from public.claim_assessment_recalculation_job()),
  0,
  'a processing job cannot be claimed a second time'
);
select throws_ok($$select public.complete_assessment_recalculation_job((select id from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'), 'invalid', '{}'::jsonb, '{}')$$, 'invalid_assessment_snapshot', 'invalid completion does not produce an output');
select lives_ok($$select public.complete_assessment_recalculation_job((select id from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'), repeat('a', 64), '{}'::jsonb, '{}')$$, 'claimed job writes a version');
select is((select count(*)::int from public.health_profile_assessment_versions where profile_id = '00000000-0000-0000-0000-000000000231'), 1, 'one immutable assessment version exists');
select is(
  (select freshness_policy_version from public.health_profile_assessment_versions where profile_id = '00000000-0000-0000-0000-000000000231'),
  'eh-144.v1',
  'the legacy completion call receives the default freshness policy version'
);
select is((select count(*)::int from public.health_profile_assessment_event_receipts), 1, 'captured source event receives one receipt');
select is((select status::text from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'), 'succeeded', 'completed job reaches succeeded');

select throws_ok(
  $$update public.assessment_dependency_events set occurred_at = now() where source_change_event_id = '00000000-0000-0000-0000-000000000233'$$,
  'eh123_append_only',
  'dependency events are append-only'
);

insert into public.observation_change_events (id, event_kind, origin, profile_id, document_id, observation_id)
values ('00000000-0000-0000-0000-000000000237', 'mapping_corrected', 'capture', '00000000-0000-0000-0000-000000000231', '00000000-0000-0000-0000-000000000232', '00000000-0000-0000-0000-000000000238');
select is(
  (select status::text from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'),
  'queued',
  'a later live change requeues a completed profile'
);
select lives_ok(
  'select * from public.claim_assessment_recalculation_job()',
  'requeued assessment work can be claimed'
);
update public.assessment_recalculation_jobs
set lease_expires_at = now() - interval '1 second'
where profile_id = '00000000-0000-0000-0000-000000000231';
select is(
  public.reclaim_stale_assessment_recalculation_jobs(),
  1,
  'expired assessment claim is reclaimed'
);
select is(
  (select status::text from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'),
  'retryable_failed',
  'expired claim becomes retryable when attempts remain'
);
select lives_ok(
  $$select public.retry_assessment_recalculation_job('00000000-0000-0000-0000-000000000231')$$,
  'failed assessment work can be retried'
);
select is(
  (select status::text || ':' || attempts::text from public.assessment_recalculation_jobs where profile_id = '00000000-0000-0000-0000-000000000231'),
  'queued:0',
  'manual retry requeues work and resets its attempt budget'
);

select * from finish();
rollback;