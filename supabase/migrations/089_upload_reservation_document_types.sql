-- Keep the owner upload reservation RPC aligned with the document types
-- exposed by the upload UI and enforced by documents_document_type_check.

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
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception using message = 'profile_not_found';
  end if;
  if p_mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
    'text/plain', 'application/json'
  ) then
    raise exception using message = 'unsupported_document_mime_type';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 10 * 1024 * 1024 then
    raise exception using message = 'invalid_document_size';
  end if;
  if p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then
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
