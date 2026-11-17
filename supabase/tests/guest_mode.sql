begin;
select plan(18);

select ok(
  (
    select count(*) = 7
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
        'guest_deletion_state'
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
  has_function_privilege(
    'service_role',
    'public.touch_guest_profile_activity(uuid,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'service role can update guest activity'
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
update public.profiles
set guest_deletion_state = 'active'
where id = '00000000-0000-4000-8000-000000000106';

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
