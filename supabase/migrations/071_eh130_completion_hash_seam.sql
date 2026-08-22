-- EH-130: make worker completion writes persist the source hash in the same
-- transaction as the existing processing finalizers. The wrapped functions keep
-- their established lifecycle and publication logic; this seam adds only the
-- duplicate-detection projection update.

alter function public.complete_document_processing_attempt(uuid, jsonb)
  rename to eh130_complete_document_processing_attempt_v1;

create or replace function public.complete_document_processing_attempt(
  p_attempt_id uuid,
  p_document jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid;
  v_content_sha256 text;
begin
  perform public.eh130_complete_document_processing_attempt_v1(
    p_attempt_id,
    p_document
  );

  v_document_id := (
    select document_id
    from public.document_processing_attempts
    where id = p_attempt_id
  );
  v_content_sha256 := nullif(p_document ->> 'content_sha256', '');

  if v_document_id is not null and v_content_sha256 is not null then
    update public.documents
    set content_sha256 = v_content_sha256
    where id = v_document_id;
  end if;
end;
$$;

revoke all on function public.eh130_complete_document_processing_attempt_v1(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.eh130_complete_document_processing_attempt_v1(uuid, jsonb)
  to service_role;
revoke all on function public.complete_document_processing_attempt(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_document_processing_attempt(uuid, jsonb)
  to service_role;

alter function public.finalize_instrumental_publication(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) rename to eh130_finalize_instrumental_publication_v1;

create or replace function public.finalize_instrumental_publication(
  p_document_id uuid,
  p_job_id uuid,
  p_processing_attempt_id uuid,
  p_publication_id uuid,
  p_snapshot_content_id uuid,
  p_canonicalization_version text,
  p_snapshot_hash text,
  p_summary_text text,
  p_completion jsonb
)
returns table(
  publication_id uuid,
  write_generation bigint,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_content_sha256 text;
begin
  return query
  select *
  from public.eh130_finalize_instrumental_publication_v1(
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

  v_content_sha256 := nullif(p_completion ->> 'content_sha256', '');
  if v_content_sha256 is not null then
    update public.documents
    set content_sha256 = v_content_sha256
    where id = p_document_id;
  end if;
end;
$$;

revoke all on function public.eh130_finalize_instrumental_publication_v1(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.eh130_finalize_instrumental_publication_v1(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) to service_role;
revoke all on function public.finalize_instrumental_publication(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_instrumental_publication(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) to service_role;

notify pgrst, 'reload schema';
