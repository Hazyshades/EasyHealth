-- EH-104 lease-aware wrappers around the existing PR2/EH-120 authorities.
-- Each wrapper locks the document/attempt lease before invoking the original
-- SECURITY DEFINER implementation in the same transaction. The old tokenless
-- entry points are private implementation helpers, never runtime authorities.

create or replace function public.complete_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_document jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.eh104_assert_processing_lease(
    p_attempt_id,
    p_lease_token,
    p_write_generation,
    false
  );
  perform public.complete_document_processing_attempt(p_attempt_id, p_document);
end;
$$;

create or replace function public.eh120_complete_document_processing_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_write_generation bigint,
  p_document jsonb,
  p_lifecycle_request_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.eh104_assert_processing_lease(
    p_attempt_id,
    p_lease_token,
    p_write_generation,
    false
  );
  perform public.eh120_complete_document_processing_attempt(
    p_attempt_id,
    p_document,
    p_lifecycle_request_hash
  );
end;
$$;

create or replace function public.prepare_instrumental_publication(
  p_document_id uuid,
  p_job_id uuid,
  p_processing_attempt_id uuid,
  p_snapshot jsonb,
  p_caller_digest text,
  p_lease_token uuid,
  p_write_generation bigint
)
returns table (
  publication_id uuid,
  snapshot_content_id uuid,
  canonicalization_version text,
  snapshot_hash text,
  content_reused boolean,
  publication_reused boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.eh104_assert_processing_lease(
    p_processing_attempt_id,
    p_lease_token,
    p_write_generation,
    false
  );
  return query
  select *
  from public.prepare_instrumental_publication(
    p_document_id,
    p_job_id,
    p_processing_attempt_id,
    p_snapshot,
    p_caller_digest
  );
end;
$$;

create or replace function public.finalize_instrumental_publication(
  p_document_id uuid,
  p_job_id uuid,
  p_processing_attempt_id uuid,
  p_publication_id uuid,
  p_snapshot_content_id uuid,
  p_canonicalization_version text,
  p_snapshot_hash text,
  p_summary_text text,
  p_completion jsonb,
  p_lease_token uuid,
  p_write_generation bigint
)
returns table (
  publication_id uuid,
  write_generation bigint,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.eh104_assert_processing_lease(
    p_processing_attempt_id,
    p_lease_token,
    p_write_generation,
    false
  );
  return query
  select *
  from public.finalize_instrumental_publication(
    p_document_id,
    p_job_id,
    p_processing_attempt_id,
    p_publication_id,
    p_snapshot_content_id,
    p_canonicalization_version,
    p_snapshot_hash,
    p_summary_text,
    p_completion
  );
end;
$$;

revoke all on function public.complete_document_processing_attempt(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.eh120_complete_document_processing_attempt(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.complete_document_processing_attempt(uuid, uuid, bigint, jsonb)
  to service_role;
grant execute on function public.eh120_complete_document_processing_attempt(uuid, uuid, bigint, jsonb, text)
  to service_role;
grant execute on function public.prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text, uuid, bigint)
  to service_role;
grant execute on function public.finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb, uuid, bigint)
  to service_role;

notify pgrst, 'reload schema';
