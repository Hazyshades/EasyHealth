begin;

select plan(34);

select has_column(
  'public',
  'documents',
  'content_sha256',
  'documents persist the exact-upload SHA-256'
);
select has_column(
  'public',
  'documents',
  'archived_at',
  'safe archive is a retained lifecycle marker'
);
select has_table(
  'public',
  'document_duplicate_candidates',
  'EH-130 stores one candidate per unordered document pair'
);
select has_table(
  'public',
  'document_duplicate_audit_events',
  'EH-130 stores append-only detection and resolution evidence'
);

select lives_ok(
  $$
    insert into public.profiles (id, email)
    values
      ('00000000-0000-0000-0000-000000130001', 'eh130-owner@example.test'),
      ('00000000-0000-0000-0000-000000130002', 'eh130-other@example.test')
  $$,
  'synthetic EH-130 profiles can be created'
);

select lives_ok(
  $$
    insert into public.documents (
      id,
      profile_id,
      storage_path,
      original_filename,
      status,
      document_type,
      mime_type,
      file_size_bytes,
      content_sha256,
      observed_at,
      lab_name
    ) values
      (
        '00000000-0000-0000-0000-000000130011',
        '00000000-0000-0000-0000-000000130001',
        'eh130/exact-a.pdf',
        'exact-report.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        42000,
        repeat('a', 64),
        '2026-01-14',
        'North Clinic'
      ),
      (
        '00000000-0000-0000-0000-000000130012',
        '00000000-0000-0000-0000-000000130001',
        'eh130/exact-b.pdf',
        'exact-report.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        42000,
        repeat('a', 64),
        '2026-01-14',
        'North Clinic'
      ),
      (
        '00000000-0000-0000-0000-000000130013',
        '00000000-0000-0000-0000-000000130001',
        'eh130/weak-a.pdf',
        'common-report.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        100,
        repeat('b', 64),
        null,
        null
      ),
      (
        '00000000-0000-0000-0000-000000130014',
        '00000000-0000-0000-0000-000000130001',
        'eh130/weak-b.pdf',
        'common-report.pdf',
        'completed',
        'referral',
        'image/png',
        101,
        repeat('c', 64),
        null,
        null
      ),
      (
        '00000000-0000-0000-0000-000000130015',
        '00000000-0000-0000-0000-000000130001',
        'eh130/near-a.pdf',
        'near-report.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        1000,
        repeat('d', 64),
        null,
        null
      ),
      (
        '00000000-0000-0000-0000-000000130016',
        '00000000-0000-0000-0000-000000130001',
        'eh130/near-b.pdf',
        'near-report.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        1000,
        repeat('e', 64),
        null,
        null
      ),
      (
        '00000000-0000-0000-0000-000000130017',
        '00000000-0000-0000-0000-000000130002',
        'eh130/other-exact.pdf',
        'exact-report.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        42000,
        repeat('a', 64),
        '2026-01-14',
        'North Clinic'
      )
  $$,
  'synthetic documents exercise exact, metadata, weak, and cross-profile matches'
);

select is(
  (
    select count(*)::int
    from public.document_duplicate_candidates
    where profile_id = '00000000-0000-0000-0000-000000130001'
  ),
  2,
  'the owner receives exactly one exact and one metadata candidate'
);
select is(
  (
    select match_kind
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130011'
      and right_document_id = '00000000-0000-0000-0000-000000130012'
  ),
  'exact',
  'matching SHA-256 values create an exact candidate'
);
select is(
  (
    select left_document_id::text || ':' || right_document_id::text
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130011'
      and right_document_id = '00000000-0000-0000-0000-000000130012'
  ),
  '00000000-0000-0000-0000-000000130011:00000000-0000-0000-0000-000000130012',
  'candidate identifiers are stored in canonical order'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_audit_events
    where candidate_id = (
      select id
      from public.document_duplicate_candidates
      where left_document_id = '00000000-0000-0000-0000-000000130011'
        and right_document_id = '00000000-0000-0000-0000-000000130012'
    )
      and action = 'detected'
  ),
  1,
  'exact detection emits one audit event'
);
select is(
  (
    select match_kind
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130015'
      and right_document_id = '00000000-0000-0000-0000-000000130016'
  ),
  'metadata',
  'metadata score at the threshold creates a metadata candidate'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130013'
      and right_document_id = '00000000-0000-0000-0000-000000130014'
  ),
  0,
  'a common filename alone does not create a candidate'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_candidates
    where profile_id = '00000000-0000-0000-0000-000000130002'
  ),
  0,
  'matching content across profiles is not actionable'
);

select lives_ok(
  $$
    select *
    from public.eh130_resolve_duplicate_candidate(
      (
        select id
        from public.document_duplicate_candidates
        where left_document_id = '00000000-0000-0000-0000-000000130011'
          and right_document_id = '00000000-0000-0000-0000-000000130012'
      ),
      '00000000-0000-0000-0000-000000130001',
      'keep_both'
    )
  $$,
  'the owner can explicitly keep both exact matches'
);
select is(
  (
    select state
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130011'
      and right_document_id = '00000000-0000-0000-0000-000000130012'
  ),
  'kept_both',
  'keep-both is a terminal candidate state'
);
select is(
  (
    select count(*)::int
    from public.documents
    where id in (
      '00000000-0000-0000-0000-000000130011',
      '00000000-0000-0000-0000-000000130012'
    )
      and archived_at is null
  ),
  2,
  'keep-both does not archive either document'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_audit_events
    where candidate_id = (
      select id
      from public.document_duplicate_candidates
      where left_document_id = '00000000-0000-0000-0000-000000130011'
        and right_document_id = '00000000-0000-0000-0000-000000130012'
    )
      and action = 'keep_both'
  ),
  1,
  'keep-both creates one resolution audit event'
);
select lives_ok(
  $$
    select *
    from public.eh130_resolve_duplicate_candidate(
      (
        select id
        from public.document_duplicate_candidates
        where left_document_id = '00000000-0000-0000-0000-000000130011'
          and right_document_id = '00000000-0000-0000-0000-000000130012'
      ),
      '00000000-0000-0000-0000-000000130001',
      'keep_both'
    )
  $$,
  'repeating the same keep-both decision is idempotent'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_audit_events
    where candidate_id = (
      select id
      from public.document_duplicate_candidates
      where left_document_id = '00000000-0000-0000-0000-000000130011'
        and right_document_id = '00000000-0000-0000-0000-000000130012'
    )
      and action = 'keep_both'
  ),
  1,
  'idempotent retry does not duplicate the resolution audit event'
);

select lives_ok(
  $$
    select *
    from public.eh130_resolve_duplicate_candidate(
      (
        select id
        from public.document_duplicate_candidates
        where left_document_id = '00000000-0000-0000-0000-000000130015'
          and right_document_id = '00000000-0000-0000-0000-000000130016'
      ),
      '00000000-0000-0000-0000-000000130001',
      'archive_left'
    )
  $$,
  'the owner can archive one metadata candidate'
);
select is(
  (
    select state
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130015'
      and right_document_id = '00000000-0000-0000-0000-000000130016'
  ),
  'archived_left',
  'the candidate records which side was archived'
);
select is(
  (
    select archive_reason
    from public.documents
    where id = '00000000-0000-0000-0000-000000130015'
  ),
  'duplicate_document',
  'safe archive records the duplicate reason'
);
select is(
  (
    select count(*)::int
    from public.documents
    where id = '00000000-0000-0000-0000-000000130016'
      and archived_at is null
  ),
  1,
  'the non-selected candidate document remains active'
);
select is(
  (
    select storage_path
    from public.documents
    where id = '00000000-0000-0000-0000-000000130015'
  ),
  'eh130/near-a.pdf',
  'safe archive retains the source document and Storage path'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_audit_events
    where candidate_id = (
      select id
      from public.document_duplicate_candidates
      where left_document_id = '00000000-0000-0000-0000-000000130015'
        and right_document_id = '00000000-0000-0000-0000-000000130016'
    )
      and action = 'archive_left'
      and actor_profile_id = '00000000-0000-0000-0000-000000130001'
  ),
  1,
  'archive resolution records the owner actor'
);
select throws_ok(
  $$
    select *
    from public.eh130_resolve_duplicate_candidate(
      (
        select id
        from public.document_duplicate_candidates
        where left_document_id = '00000000-0000-0000-0000-000000130015'
          and right_document_id = '00000000-0000-0000-0000-000000130016'
      ),
      '00000000-0000-0000-0000-000000130001',
      'archive_right'
    )
  $$,
  'duplicate_candidate_already_resolved',
  'a conflicting decision cannot overwrite the archive choice'
);
select throws_ok(
  $$
    update public.document_duplicate_audit_events
    set action = 'keep_both'
    where action = 'detected'
      and candidate_id = (
        select id
        from public.document_duplicate_candidates
        where left_document_id = '00000000-0000-0000-0000-000000130011'
          and right_document_id = '00000000-0000-0000-0000-000000130012'
      )
  $$,
  'duplicate_audit_events_are_append_only',
  'duplicate audit rows cannot be rewritten'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130011'
      and right_document_id = '00000000-0000-0000-0000-000000130012'
  ),
  1,
  'the exact pair remains one canonical candidate after repeated detection'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_audit_events
    where candidate_id = (
      select id
      from public.document_duplicate_candidates
      where left_document_id = '00000000-0000-0000-0000-000000130011'
        and right_document_id = '00000000-0000-0000-0000-000000130012'
    )
      and action = 'detected'
  ),
  1,
  'repeated detection keeps one detection audit event'
);
select is(
  (
    select count(*)::int
    from public.documents
    where profile_id = '00000000-0000-0000-0000-000000130001'
      and id in (
        '00000000-0000-0000-0000-000000130011',
        '00000000-0000-0000-0000-000000130012',
        '00000000-0000-0000-0000-000000130015',
        '00000000-0000-0000-0000-000000130016'
      )
  ),
  4,
  'duplicate resolution never deletes source document rows'
);
select lives_ok(
  $$
    delete from public.documents
    where id = '00000000-0000-0000-0000-000000130011'
  $$,
  'explicit source deletion can detach candidate foreign keys without rewriting audit facts'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_audit_events
    where left_document_id = '00000000-0000-0000-0000-000000130011'
      and candidate_id is null
  ),
  2,
  'detached audit rows retain both exact detection and resolution history'
);

select lives_ok(
  $test$
    do $do$
    begin
      perform set_config('eh104.tombstone', 'on', true);
      insert into public.documents (
        id,
        profile_id,
        storage_path,
        original_filename,
        status,
        document_type,
        mime_type,
        file_size_bytes,
        file_kind,
        processing_status,
        lifecycle_state,
        upload_state,
        content_sha256
      ) values (
        '00000000-0000-0000-0000-000000130018',
        '00000000-0000-0000-0000-000000130001',
        'eh130/deleting-source.pdf',
        'deleting-source.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        42000,
        'pdf',
        'deleting',
        'deleting',
        'complete',
        repeat('f', 64)
      );
    end
    $do$;
  $test$,
  'synthetic deleting documents can be inserted for the regression'
);
select lives_ok(
  $test$
    do $do$
    begin
      perform set_config('eh104.tombstone', 'off', true);
      insert into public.documents (
        id,
        profile_id,
        storage_path,
        original_filename,
        status,
        document_type,
        mime_type,
        file_size_bytes,
        file_kind,
        processing_status,
        lifecycle_state,
        upload_state,
        content_sha256
      ) values (
        '00000000-0000-0000-0000-000000130019',
        '00000000-0000-0000-0000-000000130001',
        'eh130/replacement.pdf',
        'replacement.pdf',
        'completed',
        'lab_result',
        'application/pdf',
        42000,
        'pdf',
        'complete',
        'active',
        'complete',
        repeat('f', 64)
      );
    end
    $do$;
  $test$,
  'new uploads ignore deleting documents during duplicate detection'
);
select is(
  (
    select count(*)::int
    from public.document_duplicate_candidates
    where left_document_id = '00000000-0000-0000-0000-000000130018'
       or right_document_id = '00000000-0000-0000-0000-000000130018'
  ),
  0,
  'deleting documents do not create duplicate candidates'
);
select * from finish();
rollback;
