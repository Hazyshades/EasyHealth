begin;

select no_plan();

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'review_mode_default'
  ),
  'profiles stores the future laboratory review mode default'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name in ('review_mode', 'review_mode_locked_at')
    group by table_schema, table_name
    having count(*) = 2
  ),
  'Documents store effective review mode and its lock timestamp'
);
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'observation_normalization_revisions'
      and column_name = 'review_mode_at_write'
  ),
  'normalization revisions store nullable review mode metadata'
);
select ok(
  to_regprocedure('public.write_observation_normalization_revision_with_review_mode(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean,text)') is not null,
  'review-mode normalization writer wrapper exists'
);
select ok(
  to_regprocedure('public.restore_observation_normalization_revision_with_review_mode(uuid,uuid,uuid,uuid,text,text,jsonb,text)') is not null,
  'review-mode historical restore wrapper exists'
);
select ok(
  to_regprocedure('public.eh122_reverse_normalization_with_review_mode(uuid,uuid,text,text,text)') is not null,
  'review-mode batch reversal wrapper exists'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'eh_snapshot_document_review_mode'
      and not tgisinternal
  ),
  'new Documents snapshot the profile default through a database trigger'
);
select ok(
  pg_get_functiondef(
    'public.write_observation_normalization_revision_with_review_mode(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean,text)'::regprocedure
  ) like '%review_mode_locked_at%'
  and pg_get_functiondef(
    'public.write_observation_normalization_revision_with_review_mode(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean,text)'::regprocedure
  ) like '%review_mode_at_write%',
  'the writer locks the first review write and records its mode in one transaction'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.write_observation_normalization_revision_with_review_mode(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean,text)'::regprocedure,
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.write_observation_normalization_revision_with_review_mode(uuid,jsonb,jsonb,text,uuid,text,jsonb,uuid,text,text,uuid,uuid,text,boolean,text)'::regprocedure,
    'EXECUTE'
  ),
  'only service_role can execute the review-mode writer wrapper'
);

insert into public.profiles (id, email, review_mode_default)
values
  ('00000000-0000-0000-0000-000000009001', 'review-mode-owner@example.test', 'easy'),
  ('00000000-0000-0000-0000-000000009002', 'review-mode-pro@example.test', 'pro');

insert into public.documents (
  id,
  profile_id,
  storage_path,
  original_filename,
  status,
  document_type,
  lifecycle_state,
  upload_state
)
values
  (
    '00000000-0000-0000-0000-000000009010',
    '00000000-0000-0000-0000-000000009001',
    'review-modes/easy.pdf',
    'easy.pdf',
    'completed',
    'lab_result',
    'active',
    'complete'
  ),
  (
    '00000000-0000-0000-0000-000000009011',
    '00000000-0000-0000-0000-000000009001',
    'review-modes/instrumental.pdf',
    'instrumental.pdf',
    'completed',
    'instrumental_report',
    'active',
    'complete'
  );

select is(
  (select review_mode from public.documents where id = '00000000-0000-0000-0000-000000009010'),
  'easy'::text,
  'a laboratory upload snapshots the profile default'
);
select is(
  (select review_mode from public.documents where id = '00000000-0000-0000-0000-000000009011'),
  null::text,
  'non-laboratory Documents stay outside the review-mode policy'
);

select throws_ok(
  $$
    update public.documents
    set review_mode = 'invalid'
    where id = '00000000-0000-0000-0000-000000009010'
  $$,
  '23514',
  null,
  'Documents reject unsupported review modes'
);

update public.documents
set review_mode_locked_at = '2026-08-14 10:00:00+00'
where id = '00000000-0000-0000-0000-000000009010';

select is(
  (select review_mode_locked_at is not null from public.documents where id = '00000000-0000-0000-0000-000000009010'),
  true,
  'a locked Document records the initial review boundary'
);
select is(
  (
    select count(*)
    from public.documents
    where id = '00000000-0000-0000-0000-000000009010'
      and review_mode = 'easy'
      and review_mode_locked_at is not null
  ),
  1::bigint,
  'locking preserves the effective Easy mode'
);

with attempted as (
  update public.documents
  set review_mode = 'pro'
  where id = '00000000-0000-0000-0000-000000009010'
    and review_mode = 'easy'
    and review_mode_locked_at is null
  returning id
)
select is(
  (select count(*) from attempted),
  0::bigint,
  'a stale pre-lock mode update cannot reverse a locked Document'
);

select * from finish();
rollback;
