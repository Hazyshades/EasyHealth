begin;
select plan(43);

select ok(
  (
    select count(*) = 9
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in (
        'account_type',
        'guest_last_activity_at',
        'guest_expires_at',
        'guest_consent_version',
        'guest_consent_accepted_at',
        'guest_converted_at',
        'guest_deletion_state',
        'privacy_consent_at',
        'privacy_version'
      )
  ),
  'guest lifecycle columns exist on profiles'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_profile_deletion_operations'
      and column_name in (
        'filename',
        'storage_path',
        'raw_value',
        'extracted_text',
        'health_data'
      )
  ),
  'guest deletion operations have no document-content columns'
);
select ok(
  to_regclass('public.guest_profile_deletion_operations') is not null,
  'guest deletion operation table exists'
);
select ok(
  to_regclass('public.guest_resource_usage') is not null,
  'guest resource usage table exists'
);
select ok(
  to_regclass('public.guest_upload_quota_reservations') is not null,
  'guest upload quota reservation table exists'
);
select ok(
  (
    select count(*) = 2
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_upload_quota_reservations'
      and column_name in ('document_id', 'intent_id')
  ),
  'guest upload quota reservations retain completion references'
);
select ok(
  to_regclass('public.guest_creation_reservations') is not null,
  'guest creation reservation table exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_guest_creation_ticket(text,integer,integer,integer)'::regprocedure,
    'EXECUTE'
  ),
  'service role can reserve a guest creation ticket'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.touch_guest_profile_activity(uuid,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'service role can update guest activity'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_guest_upload(uuid,bigint,bigint,bigint,bigint,date)'::regprocedure,
    'EXECUTE'
  ),
  'service role can reserve upload quotas atomically'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.attach_guest_upload_quota_reservation(uuid,uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service role can attach a document and intent to an upload quota reservation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.release_guest_upload(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service role can release a failed upload quota reservation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_guest_upload(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service role can finalize a successful upload quota reservation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_guest_upload_quota_reservations(timestamptz,integer)'::regprocedure,
    'EXECUTE'
  ),
  'service role can reconcile abandoned upload quota reservations'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.touch_guest_profile_activity(uuid,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated role cannot update guest activity directly'
);

insert into public.profiles (
  id,
  first_name,
  account_type,
  guest_last_activity_at,
  guest_expires_at,
  guest_consent_version,
  guest_consent_accepted_at
)
values (
  '00000000-0000-4000-8000-000000000106',
  'Guest',
  'guest',
  '2026-06-01T00:00:00Z',
  '2026-07-01T00:00:00Z',
  'guest-2026-06-29',
  '2026-06-01T00:00:00Z'
);

select ok(
  not public.touch_guest_profile_activity(
    '00000000-0000-4000-8000-000000000106',
    '2026-06-01T00:04:00Z'
  ),
  'activity updates are throttled within five minutes'
);
select ok(
  (
    select guest_last_activity_at = '2026-06-01T00:00:00Z'::timestamptz
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000106'
  ),
  'throttled activity leaves the prior timestamp unchanged'
);
select ok(
  public.touch_guest_profile_activity(
    '00000000-0000-4000-8000-000000000106',
    '2026-06-01T00:06:00Z'
  ),
  'activity updates after the throttle window'
);
select ok(
  (
    select guest_last_activity_at = '2026-06-01T00:06:00Z'::timestamptz
      and guest_expires_at >= '2026-07-01T00:06:00Z'::timestamptz
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000106'
  ),
  'activity is monotonic and extends the expiry window'
);
insert into public.profiles (
  id,
  first_name,
  account_type,
  guest_last_activity_at,
  guest_expires_at,
  guest_consent_version,
  guest_consent_accepted_at
)
values (
  '00000000-0000-4000-8000-000000000110',
  'Expired',
  'guest',
  '2026-06-01T00:00:00Z',
  '2026-06-01T00:01:00Z',
  'guest-2026-06-29',
  '2026-06-01T00:00:00Z'
);
select ok(
  not public.touch_guest_profile_activity(
    '00000000-0000-4000-8000-000000000110',
    '2026-06-01T00:02:00Z'
  ),
  'expired guest activity cannot extend retention'
);
select throws_ok(
  $$
    insert into public.reports (
      profile_id,
      title,
      report_type,
      detail_level,
      content,
      summary_preview
    ) values (
      '00000000-0000-4000-8000-000000000110',
      'expired guest report',
      'general_practice',
      'standard',
      '{}'::jsonb,
      'expired'
    )
  $$,
  'P0001',
  'guest_profile_expired',
  'expired guest writes are rejected by the database fence'
);
insert into public.profiles (
  id,
  first_name,
  account_type,
  guest_last_activity_at,
  guest_expires_at,
  guest_consent_version,
  guest_consent_accepted_at,
  privacy_version,
  privacy_consent_at
)
values (
  '00000000-0000-0000-0000-000000000111',
  'Convertible',
  'guest',
  '2098-06-01T00:00:00Z',
  '2099-06-01T00:00:00Z',
  'guest-previous',
  '2098-06-01T00:00:00Z',
  '2026-06-29',
  '2098-06-01T00:00:00Z'
);
select ok(
  not public.complete_guest_conversion(
    '00000000-0000-0000-0000-000000000111',
    'controlled@example.invalid',
    'guest-2026-06-29'
  ),
  'guest conversion rejects stale consent versions'
);
update public.profiles
set guest_consent_version = 'guest-2026-06-29'
where id = '00000000-0000-0000-0000-000000000111';
update public.profiles
set first_name = null
where id = '00000000-0000-0000-0000-000000000111';
select ok(
  not public.complete_guest_conversion(
    '00000000-0000-0000-0000-000000000111',
    'controlled@example.invalid',
    'guest-2026-06-29'
  ),
  'guest conversion rejects a profile without a name'
);
update public.profiles
set first_name = 'Convertible'
where id = '00000000-0000-0000-0000-000000000111';
select ok(
  public.complete_guest_conversion(
    '00000000-0000-0000-0000-000000000111',
    'controlled@example.invalid',
    'guest-2026-06-29'
  ),
  'guest conversion updates an eligible profile atomically'
);
select is(
  (
    select account_type
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000111'
  ),
  'standard',
  'eligible guest conversion changes account type'
);

update public.profiles
set guest_converted_at = '2026-06-01T00:07:00Z'
where id = '00000000-0000-4000-8000-000000000106';
select ok(
  not public.touch_guest_profile_activity(
    '00000000-0000-4000-8000-000000000106',
    '2026-06-02T00:00:00Z'
  ),
  'converted profiles cannot be extended'
);
update public.profiles
set guest_converted_at = null,
    guest_deletion_state = 'active'
where id = '00000000-0000-4000-8000-000000000106';
update public.profiles
set guest_deletion_state = 'deleting'
where id = '00000000-0000-4000-8000-000000000106';
select ok(
  not public.touch_guest_profile_activity(
    '00000000-0000-4000-8000-000000000106',
    '2026-06-03T00:00:00Z'
  ),
  'deleting profiles cannot be extended'
);
select throws_ok(
  $$
    insert into public.reports (
      profile_id,
      title,
      report_type,
      detail_level,
      content,
      summary_preview
    ) values (
      '00000000-0000-4000-8000-000000000106',
      'blocked guest report',
      'general_practice',
      'standard',
      '{}'::jsonb,
      'blocked'
    )
  $$,
  'P0001',
  'guest_profile_deletion_requested',
  'product writes are frozen after guest deletion starts'
);
update public.profiles
set guest_deletion_state = 'active'
where id = '00000000-0000-4000-8000-000000000106';

update public.profiles
set guest_last_activity_at = clock_timestamp() - interval '10 minutes',
    guest_expires_at = clock_timestamp() + interval '1 day',
    guest_deletion_state = 'active'
where id = '00000000-0000-4000-8000-000000000106';
insert into public.reports (
  profile_id,
  title,
  report_type,
  detail_level,
  content,
  summary_preview
) values (
  '00000000-0000-4000-8000-000000000106',
  'activity guest report',
  'general_practice',
  'standard',
  '{}'::jsonb,
  'activity'
);
select ok(
  (
    select guest_last_activity_at > clock_timestamp() - interval '1 minute'
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000106'
  ),
  'guest product writes refresh activity through the write fence'
);

select ok(
  not (
    select allowed
    from public.reserve_guest_upload(
      '00000000-0000-4000-8000-000000000106',
      10,
      10,
      5,
      10
    )
  ),
  'atomic upload reservation rejects the first exceeded resource'
);
select is(
  (
    select coalesce(sum(amount), 0)::bigint
    from public.guest_resource_usage
    where profile_id = '00000000-0000-4000-8000-000000000106'
      and usage_day = current_date
      and resource in ('upload_count', 'upload_bytes', 'processing_count')
  ),
  0::bigint,
  'failed atomic upload reservation rolls back every resource increment'
);

select ok(
  (
    select reservation_id is not null
    from public.reserve_guest_upload(
      '00000000-0000-4000-8000-000000000106',
      10,
      10,
      100,
      10,
      current_date
    )
  ),
  'successful atomic upload reservation returns a durable reservation id'
);
select ok(
  public.release_guest_upload((
    select id
    from public.guest_upload_quota_reservations
    where profile_id = '00000000-0000-4000-8000-000000000106'
      and status = 'reserved'
    order by created_at desc
    limit 1
  )),
  'failed upload quota release is accepted'
);
select ok(
  public.release_guest_upload((
    select id
    from public.guest_upload_quota_reservations
    where profile_id = '00000000-0000-4000-8000-000000000106'
      and status = 'released'
    order by released_at desc
    limit 1
  )),
  'failed upload quota release is idempotent'
);
update public.guest_upload_quota_reservations
set created_at = now() - interval '20 minutes'
where id = (
  select reservation_id
  from public.reserve_guest_upload(
    '00000000-0000-4000-8000-000000000106',
    10,
    10,
    100,
    10,
    current_date
  )
);
select is(
  public.reconcile_guest_upload_quota_reservations(
    now() - interval '10 minutes',
    10
  ),
  1,
  'stale upload quota reservations are reconciled'
);
select ok(
  exists (
    select 1
    from public.guest_upload_quota_reservations
    where profile_id = '00000000-0000-4000-8000-000000000106'
      and status = 'released'
      and created_at < now() - interval '10 minutes'
  ),
  'reconciliation marks the abandoned reservation released'
);

select ok(
  (
    select allowed
    from public.reserve_guest_resource(
      '00000000-0000-4000-8000-000000000106',
      'upload_count',
      1,
      1
    )
  ),
  'guest resource reservation is allowed under the limit'
);
select ok(
  not (
    select allowed
    from public.reserve_guest_resource(
      '00000000-0000-4000-8000-000000000106',
      'upload_count',
      1,
      1
    )
  ),
  'guest resource reservation is rejected over the limit'
);

insert into public.assessment_recalculation_jobs (
  profile_id,
  output_kind,
  status
)
values (
  '00000000-0000-4000-8000-000000000106',
  'health_profile',
  'queued'
)
on conflict (profile_id, output_kind) do update
set status = 'queued';

select ok(
  (
    select operation_id is not null
    from public.request_guest_profile_deletion(
      '00000000-0000-4000-8000-000000000106',
      'explicit'
    )
  ),
  'guest deletion request creates an operation'
);
select is(
  (
    select status::text
    from public.assessment_recalculation_jobs
    where profile_id = '00000000-0000-4000-8000-000000000106'
      and output_kind = 'health_profile'
  ),
  'failed',
  'guest deletion cancels assessment recalculation'
);
select is(
  (
    select guest_deletion_state
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000106'
  ),
  'deleting',
  'guest deletion freezes the profile'
);
select is(
  (
    select request.operation_id::text
    from public.request_guest_profile_deletion(
      '00000000-0000-4000-8000-000000000106',
      'explicit'
    ) as request
  ),
  (
    select id::text
    from public.guest_profile_deletion_operations
    where profile_id = '00000000-0000-4000-8000-000000000106'
  ),
  'repeated guest deletion requests return the same operation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_guest_profile_purge(uuid,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service role can finalize guest purge'
);

select * from finish();
rollback;
