-- Reserve guest creation attempts before creating a Supabase anonymous Auth user.
-- The ticket is one-time and short-lived so an application throttle rejection
-- cannot leave provider-level anonymous users behind or be replayed.

create table if not exists public.guest_creation_reservations (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint guest_creation_reservations_status_check
    check (status in ('reserved', 'consumed', 'expired'))
);

create index if not exists guest_creation_reservations_active_idx
  on public.guest_creation_reservations (expires_at, id)
  where status = 'reserved';

alter table public.guest_creation_reservations enable row level security;
revoke all on public.guest_creation_reservations from public, anon, authenticated;
grant select, insert, update, delete on public.guest_creation_reservations to service_role;

create or replace function public.reserve_guest_creation_ticket(
  p_key_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 3600,
  p_ttl_seconds integer default 300
)
returns table (ticket_id uuid, allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_retry_after integer;
  v_ticket_id uuid;
  v_now timestamptz := now();
begin
  if p_key_hash is null or length(p_key_hash) < 16
    or p_limit < 1 or p_limit > 100
    or p_window_seconds < 60 or p_window_seconds > 86400
    or p_ttl_seconds < 30 or p_ttl_seconds > 900 then
    raise exception using message = 'invalid_guest_creation_limit';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));

  update public.guest_creation_reservations
  set status = 'expired'
  where status = 'reserved'
    and expires_at <= v_now;

  select r.allowed, r.retry_after_seconds
  into v_allowed, v_retry_after
  from public.reserve_guest_creation(p_key_hash, p_limit, p_window_seconds) as r
  limit 1;

  if not coalesce(v_allowed, false) then
    return query select null::uuid, false, coalesce(v_retry_after, 60);
    return;
  end if;

  insert into public.guest_creation_reservations (key_hash, expires_at)
  values (p_key_hash, v_now + make_interval(secs => p_ttl_seconds))
  returning id into v_ticket_id;

  return query select v_ticket_id, true, 0;
end;
$$;

revoke all on function public.reserve_guest_creation_ticket(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_guest_creation_ticket(text, integer, integer, integer)
  to service_role;

create or replace function public.consume_guest_creation_ticket(
  p_ticket_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expires_at timestamptz;
begin
  select status, expires_at
  into v_status, v_expires_at
  from public.guest_creation_reservations
  where id = p_ticket_id
  for update;

  if v_status is distinct from 'reserved' or v_expires_at <= now() then
    if v_status = 'reserved' then
      update public.guest_creation_reservations
      set status = 'expired'
      where id = p_ticket_id;
    end if;
    return false;
  end if;

  update public.guest_creation_reservations
  set status = 'consumed', consumed_at = now()
  where id = p_ticket_id;
  return true;
end;
$$;

revoke all on function public.consume_guest_creation_ticket(uuid)
  from public, anon, authenticated;
grant execute on function public.consume_guest_creation_ticket(uuid)
  to service_role;

-- Serialize the profile lock with deletion acceptance so a reservation cannot
-- create a new document after a guest deletion request commits.
create or replace function public.create_document_upload_reservation(
  p_profile_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_content_sha256 text,
  p_document_type text,
  p_file_kind text,
  p_extension text
)
returns table (
  document_id uuid,
  intent_id uuid,
  bucket text,
  object_path text,
  content_type text,
  write_generation bigint,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid := gen_random_uuid();
  v_path text;
  v_intent_id uuid;
  v_deadline timestamptz := now() + interval '10 minutes';
  v_account_type text;
  v_guest_deletion_state text;
begin
  select account_type, guest_deletion_state
  into v_account_type, v_guest_deletion_state
  from public.profiles
  where id = p_profile_id
  for update;
  if not found then
    raise exception using message = 'profile_not_found';
  end if;
  if v_account_type = 'guest' and v_guest_deletion_state <> 'active' then
    raise exception using message = 'guest_profile_deletion_requested';
  end if;
  if p_mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
    'text/plain', 'application/json'
  ) then
    raise exception using message = 'unsupported_document_mime_type';
  end if;
  if p_file_size_bytes is null
    or p_file_size_bytes <= 0
    or p_file_size_bytes > 10 * 1024 * 1024 then
    raise exception using message = 'invalid_document_size';
  end if;
  if p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_document_content_hash';
  end if;
  if p_document_type not in (
    'lab_result',
    'instrumental_report',
    'consultation_note',
    'discharge_summary',
    'prescription',
    'referral',
    'dicom'
  ) then
    raise exception using message = 'invalid_document_type';
  end if;
  if p_file_kind not in ('pdf', 'image', 'unknown') then
    raise exception using message = 'invalid_document_file_kind';
  end if;

  v_path := public.eh104_storage_intent_path(
    p_profile_id,
    v_document_id,
    0,
    null,
    'owner_original',
    null,
    p_extension
  );

  insert into public.documents (
    id,
    profile_id,
    storage_path,
    original_filename,
    status,
    mime_type,
    file_size_bytes,
    original_storage_path,
    lifecycle_state,
    upload_state,
    processing_status,
    document_type,
    file_kind,
    content_sha256
  )
  values (
    v_document_id,
    p_profile_id,
    v_path,
    left(p_original_filename, 500),
    'processing',
    p_mime_type,
    p_file_size_bytes,
    v_path,
    'active',
    'pending',
    'upload_pending',
    p_document_type,
    p_file_kind,
    p_content_sha256
  );

  insert into public.document_storage_write_intents (
    document_id,
    profile_id,
    write_generation,
    principal_kind,
    operation_kind,
    bucket,
    object_path,
    content_type,
    deadline_at
  )
  values (
    v_document_id,
    p_profile_id,
    0,
    'owner',
    'owner_original',
    'lab-documents',
    v_path,
    p_mime_type,
    v_deadline
  )
  returning id into v_intent_id;

  return query select
    v_document_id,
    v_intent_id,
    'lab-documents'::text,
    v_path,
    p_mime_type,
    0::bigint,
    v_deadline;
end;
$$;

revoke all on function public.create_document_upload_reservation(uuid, text, text, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_document_upload_reservation(uuid, text, text, bigint, text, text, text, text)
  to service_role;
