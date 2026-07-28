-- EH-109 release-gate repair: keep the deployed claim contract while making
-- the active-attempt guard unambiguous in PL/pgSQL.

create or replace function public.claim_document_processing_job(p_job_id uuid)
returns table (
  job_id uuid,
  document_id uuid,
  profile_id uuid,
  attempts integer,
  max_attempts integer,
  processing_attempt_id uuid,
  attempt_number integer,
  captured_write_generation bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.document_processing_jobs%rowtype;
  v_document public.documents%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
begin
  -- Snapshot read to learn the document; authoritative checks happen under lock.
  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id;

  if v_job.id is null then
    return;
  end if;

  select * into v_document
  from public.documents
  where id = v_job.document_id
  for update;

  if v_document.id is null then
    return;
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.status is distinct from 'queued' then
    return; -- lost the race; not an error
  end if;

  if v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_job_document_profile_mismatch';
  end if;

  -- The partial unique indexes are the hard guarantee; this check returns a
  -- clean no-claim result instead of surfacing a constraint error. Qualifying
  -- these columns prevents collision with the RETURNS TABLE document_id name.
  if exists (
    select 1
    from public.document_processing_attempts as active_attempt
    where active_attempt.document_id = v_document.id
      and active_attempt.state = 'active'
  ) then
    return;
  end if;

  update public.document_processing_jobs
  set status = 'processing',
      attempts = v_job.attempts + 1,
      started_at = now(),
      finished_at = null
  where id = v_job.id;

  insert into public.document_processing_attempts (
    job_id,
    document_id,
    profile_id,
    attempt_number,
    captured_write_generation
  )
  values (
    v_job.id,
    v_document.id,
    v_document.profile_id,
    v_job.attempts + 1,
    v_document.write_generation
  )
  returning * into v_attempt;

  return query select
    v_job.id,
    v_document.id,
    v_document.profile_id,
    v_job.attempts + 1,
    v_job.max_attempts,
    v_attempt.id,
    v_attempt.attempt_number,
    v_attempt.captured_write_generation;
end;
$$;

revoke all on function public.claim_document_processing_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_document_processing_job(uuid) to service_role;
