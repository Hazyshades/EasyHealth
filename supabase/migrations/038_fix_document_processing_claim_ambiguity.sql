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

-- EH-105 repair: qualify table columns that collide with the prepare RPC's
-- RETURNS TABLE output names. The remaining function body is copied verbatim
-- from migration 037 so upgraded and freshly reset databases share a contract.

create or replace function public.prepare_instrumental_publication(
  p_document_id uuid,
  p_job_id uuid,
  p_processing_attempt_id uuid,
  p_snapshot jsonb,
  p_caller_digest text default null
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
declare
  v_document public.documents%rowtype;
  v_job public.document_processing_jobs%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
  v_canonical jsonb;
  v_hash text;
  v_content public.document_instrumental_snapshot_contents%rowtype;
  v_publication public.document_instrumental_publications%rowtype;
  v_content_reused boolean := false;
  v_measure jsonb;
  v_finding jsonb;
  v_source_id uuid;
  v_source public.document_extracted_instrumental_measures%rowtype;
  v_observation public.observations%rowtype;
  v_ordinal integer := 0;
  v_study_date date;
begin
  -- Lock DAG: documents -> jobs/attempts -> publication/content rows.
  select * into v_document
  from public.documents
  where id = p_document_id
  for update;

  if v_document.id is null then
    raise exception using message = 'instrumental_document_not_found';
  end if;
  if v_document.document_type is distinct from 'instrumental_report' then
    raise exception using message = 'instrumental_document_type_mismatch';
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.id is null then
    raise exception using message = 'instrumental_job_not_found';
  end if;
  if v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'instrumental_job_document_profile_mismatch';
  end if;
  if v_job.status is distinct from 'processing' then
    raise exception using message = 'instrumental_job_not_processing';
  end if;

  select * into v_attempt
  from public.document_processing_attempts
  where id = p_processing_attempt_id
  for update;

  if v_attempt.id is null
    or v_attempt.job_id is distinct from v_job.id
    or v_attempt.document_id is distinct from v_document.id
    or v_attempt.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_attempt_ownership_mismatch';
  end if;
  if v_attempt.state is distinct from 'active' then
    raise exception using message = 'processing_attempt_not_active';
  end if;
  if v_attempt.captured_write_generation is distinct from v_document.write_generation then
    raise exception using message = 'processing_attempt_generation_mismatch';
  end if;

  perform public.pr2_validate_instrumental_snapshot(p_snapshot);
  v_canonical := public.pr2_canonical_instrumental_snapshot(p_snapshot);
  v_hash := public.pr2_instrumental_snapshot_hash(v_canonical);
  v_study_date := (p_snapshot ->> 'study_date')::date;

  if p_caller_digest is not null and p_caller_digest is distinct from v_hash then
    raise exception using message = 'instrumental_snapshot_digest_mismatch';
  end if;

  -- Serialize content decisions for this document.
  perform 1
  from public.document_instrumental_snapshot_contents as locked_content
  where locked_content.document_id = v_document.id
  order by locked_content.id
  for update;

  select candidate_content.* into v_content
  from public.document_instrumental_snapshot_contents as candidate_content
  where candidate_content.document_id = v_document.id
    and candidate_content.canonicalization_version = 'eh105.instrumental-snapshot.v2'
    and candidate_content.snapshot_hash = v_hash;

  if v_content.id is not null then
    -- Hash equality alone is never trusted: require exact canonical bytes.
    if v_content.canonical_payload::text is distinct from v_canonical::text then
      raise exception using message = 'instrumental_snapshot_payload_conflict';
    end if;
    v_content_reused := true;
  else
    insert into public.document_instrumental_snapshot_contents (
      document_id,
      profile_id,
      canonicalization_version,
      snapshot_hash,
      canonical_payload,
      study_date,
      modality,
      body_region,
      facility_name,
      impression,
      processing_version,
      extraction_model
    )
    values (
      v_document.id,
      v_document.profile_id,
      'eh105.instrumental-snapshot.v2',
      v_hash,
      v_canonical,
      v_study_date,
      p_snapshot ->> 'modality',
      p_snapshot ->> 'body_region',
      p_snapshot ->> 'facility_name',
      p_snapshot ->> 'impression',
      p_snapshot ->> 'processing_version',
      p_snapshot ->> 'extraction_model'
    )
    returning * into v_content;

    -- Immutable source occurrences and observation identity are created with
    -- the content, but stay invisible: is_current flips only at finalize.
    for v_measure in select value from jsonb_array_elements(p_snapshot -> 'measures')
    loop
      insert into public.document_extracted_instrumental_measures (
        document_id,
        profile_id,
        processing_job_id,
        snapshot_content_id,
        key_hint,
        name,
        raw_name,
        value,
        raw_value_text,
        unit,
        raw_unit,
        observed_at,
        source_page,
        source_text,
        source_locator,
        occurrence_index,
        bounding_box,
        confidence,
        modality,
        body_region,
        processing_version,
        extraction_model,
        snapshot_hash,
        is_current,
        superseded_at
      )
      values (
        v_document.id,
        v_document.profile_id,
        v_job.id,
        v_content.id,
        v_measure ->> 'key_hint',
        v_measure ->> 'name',
        v_measure ->> 'raw_name',
        (v_measure ->> 'value')::numeric,
        v_measure ->> 'raw_value_text',
        v_measure ->> 'unit',
        v_measure ->> 'raw_unit',
        v_study_date,
        (v_measure ->> 'source_page')::integer,
        v_measure ->> 'source_text',
        v_measure ->> 'source_locator',
        (v_measure ->> 'occurrence_index')::integer,
        case when jsonb_typeof(v_measure -> 'bounding_box') = 'object' then v_measure -> 'bounding_box' end,
        (v_measure ->> 'confidence')::numeric,
        p_snapshot ->> 'modality',
        p_snapshot ->> 'body_region',
        p_snapshot ->> 'processing_version',
        p_snapshot ->> 'extraction_model',
        v_hash,
        false,
        null
      )
      returning id into v_source_id;

      insert into public.observations (
        profile_id,
        document_id,
        source_instrumental_measure_id,
        name,
        value,
        value_kind,
        value_text,
        unit,
        raw_name,
        raw_value_text,
        raw_unit,
        ref_low,
        ref_high,
        observed_at,
        source_page,
        source_text,
        bounding_box,
        confidence,
        extraction_version,
        observation_kind
      )
      values (
        v_document.profile_id,
        v_document.id,
        v_source_id,
        v_measure ->> 'name',
        (v_measure ->> 'value')::numeric,
        'numeric',
        v_measure ->> 'raw_value_text',
        v_measure ->> 'unit',
        v_measure ->> 'raw_name',
        v_measure ->> 'raw_value_text',
        v_measure ->> 'raw_unit',
        null,
        null,
        v_study_date,
        (v_measure ->> 'source_page')::integer,
        v_measure ->> 'source_text',
        case when jsonb_typeof(v_measure -> 'bounding_box') = 'object' then v_measure -> 'bounding_box' end,
        (v_measure ->> 'confidence')::numeric,
        p_snapshot ->> 'processing_version',
        'instrumental'
      );
    end loop;

    -- Immutable finding versions in canonical order; the content-level
    -- impression is mirrored onto ordinal 0 for the compatibility shape.
    for v_finding in
      select value
      from jsonb_array_elements(p_snapshot -> 'findings') as f(value)
      order by (f.value ->> 'finding_text') collate "C",
        (f.value ->> 'source_page')::integer nulls first,
        (f.value ->> 'source_text') collate "C" nulls first,
        (f.value ->> 'confidence') collate "C" nulls first
    loop
      insert into public.document_extracted_finding_versions (
        document_id,
        profile_id,
        snapshot_content_id,
        ordinal,
        modality,
        body_region,
        finding_text,
        impression,
        source_page,
        source_text,
        confidence,
        extraction_method,
        processing_version,
        extraction_model,
        status
      )
      values (
        v_document.id,
        v_document.profile_id,
        v_content.id,
        v_ordinal,
        p_snapshot ->> 'modality',
        p_snapshot ->> 'body_region',
        v_finding ->> 'finding_text',
        case when v_ordinal = 0 then p_snapshot ->> 'impression' end,
        (v_finding ->> 'source_page')::integer,
        v_finding ->> 'source_text',
        (v_finding ->> 'confidence')::numeric,
        'llm',
        p_snapshot ->> 'processing_version',
        p_snapshot ->> 'extraction_model',
        'accepted'
      );
      v_ordinal := v_ordinal + 1;
    end loop;

    if v_ordinal = 0 and p_snapshot ->> 'impression' is not null then
      insert into public.document_extracted_finding_versions (
        document_id,
        profile_id,
        snapshot_content_id,
        ordinal,
        modality,
        body_region,
        finding_text,
        impression,
        source_page,
        source_text,
        confidence,
        extraction_method,
        processing_version,
        extraction_model,
        status
      )
      values (
        v_document.id,
        v_document.profile_id,
        v_content.id,
        0,
        p_snapshot ->> 'modality',
        p_snapshot ->> 'body_region',
        p_snapshot ->> 'impression',
        p_snapshot ->> 'impression',
        null,
        null,
        null,
        'llm',
        p_snapshot ->> 'processing_version',
        p_snapshot ->> 'extraction_model',
        'accepted'
      );
    end if;
  end if;

  -- Same-hash behavior is publication-state specific.
  select prepared_publication.* into v_publication
  from public.document_instrumental_publications as prepared_publication
  where prepared_publication.document_id = v_document.id
    and prepared_publication.snapshot_content_id = v_content.id
    and prepared_publication.state = 'prepared'
    and prepared_publication.processing_attempt_id = v_attempt.id;

  if v_publication.id is not null then
    return query select
      v_publication.id, v_content.id, v_content.canonicalization_version,
      v_content.snapshot_hash, v_content_reused, true;
    return;
  end if;

  -- Another live attempt owning a preparation is impossible under the
  -- one-active-attempt rule, but reject deterministically as defense.
  if exists (
    select 1
    from public.document_instrumental_publications p
    join public.document_processing_attempts a on a.id = p.processing_attempt_id
    where p.document_id = v_document.id
      and p.state = 'prepared'
      and a.state = 'active'
      and a.id is distinct from v_attempt.id
  ) then
    raise exception using message = 'instrumental_preparation_concurrent';
  end if;

  insert into public.document_instrumental_publications (
    document_id,
    profile_id,
    snapshot_content_id,
    processing_attempt_id,
    captured_write_generation,
    state
  )
  values (
    v_document.id,
    v_document.profile_id,
    v_content.id,
    v_attempt.id,
    v_attempt.captured_write_generation,
    'prepared'
  )
  returning * into v_publication;

  return query select
    v_publication.id, v_content.id, v_content.canonicalization_version,
    v_content.snapshot_hash, v_content_reused, false;
end;
$$;

revoke all on function public.prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text) to service_role;

-- EH-105 repair: the finalize RPC output named write_generation collides with
-- the documents column unless the right-hand side is table-qualified.

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
returns table (
  publication_id uuid,
  write_generation bigint,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_document public.documents%rowtype;
  v_job public.document_processing_jobs%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
  v_publication public.document_instrumental_publications%rowtype;
  v_prior public.document_instrumental_publications%rowtype;
  v_pointer public.document_instrumental_current_publication%rowtype;
  v_content public.document_instrumental_snapshot_contents%rowtype;
  v_digest text;
  v_generation bigint;
begin
  if p_completion is not null and jsonb_typeof(p_completion) is distinct from 'object' then
    raise exception using message = 'invalid_completion_payload';
  end if;

  -- Lock DAG: documents -> jobs/attempts -> pointer/publication/content -> synthesis.
  select * into v_document
  from public.documents
  where id = p_document_id
  for update;

  if v_document.id is null then
    raise exception using message = 'instrumental_document_not_found';
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.id is null
    or v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'instrumental_job_document_profile_mismatch';
  end if;

  select * into v_attempt
  from public.document_processing_attempts
  where id = p_processing_attempt_id
  for update;

  if v_attempt.id is null
    or v_attempt.job_id is distinct from v_job.id
    or v_attempt.document_id is distinct from v_document.id
    or v_attempt.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_attempt_ownership_mismatch';
  end if;

  select * into v_pointer
  from public.document_instrumental_current_publication
  where document_id = v_document.id
  for update;

  select * into v_publication
  from public.document_instrumental_publications
  where id = p_publication_id
  for update;

  if v_publication.id is null
    or v_publication.document_id is distinct from v_document.id
    or v_publication.profile_id is distinct from v_document.profile_id
    or v_publication.processing_attempt_id is distinct from v_attempt.id then
    raise exception using message = 'instrumental_publication_ownership_mismatch';
  end if;
  if v_publication.snapshot_content_id is distinct from p_snapshot_content_id then
    raise exception using message = 'instrumental_publication_binding_mismatch';
  end if;

  select * into v_content
  from public.document_instrumental_snapshot_contents
  where id = v_publication.snapshot_content_id
  for update;

  if v_content.canonicalization_version is distinct from p_canonicalization_version
    or v_content.snapshot_hash is distinct from p_snapshot_hash then
    raise exception using message = 'instrumental_publication_binding_mismatch';
  end if;

  v_digest := public.pr2_instrumental_publication_digest(
    v_publication.id,
    v_content.id,
    v_content.canonicalization_version,
    v_content.snapshot_hash,
    p_summary_text,
    p_completion
  );

  -- Idempotent replay of the committed result: no writes, no generation bump.
  if v_publication.state = 'current' then
    if v_attempt.state = 'completed'
      and v_pointer.publication_id = v_publication.id then
      if v_publication.publication_digest is distinct from v_digest then
        raise exception using message = 'instrumental_publication_digest_conflict';
      end if;
      return query select v_publication.id, v_document.write_generation, true;
      return;
    end if;
    raise exception using message = 'instrumental_publication_invalid_state';
  end if;

  if v_publication.state is distinct from 'prepared' then
    raise exception using message = 'instrumental_publication_invalid_state';
  end if;
  if v_attempt.state is distinct from 'active' then
    raise exception using message = 'processing_attempt_not_active';
  end if;
  if v_job.status is distinct from 'processing' then
    raise exception using message = 'processing_job_not_processing';
  end if;
  if v_attempt.captured_write_generation is distinct from v_document.write_generation then
    raise exception using message = 'processing_attempt_generation_mismatch';
  end if;

  -- Lock content children in stable id order before state transitions.
  perform 1 from public.document_extracted_instrumental_measures
  where document_id = v_document.id
  order by id
  for update;
  perform 1 from public.document_extracted_finding_versions
  where document_id = v_document.id
  order by id
  for update;

  -- Supersede the prior current publication.
  if v_pointer.publication_id is not null then
    select * into v_prior
    from public.document_instrumental_publications
    where id = v_pointer.publication_id
    for update;

    update public.document_instrumental_publications
    set state = 'superseded',
        superseded_at = now()
    where id = v_prior.id;
  end if;

  -- Activate the target publication with its summary and digest binding.
  update public.document_instrumental_publications
  set state = 'current',
      published_at = now(),
      summary_text = p_summary_text,
      summary_hash = case
        when p_summary_text is null then null
        else encode(extensions.digest(convert_to(p_summary_text, 'UTF8'), 'sha256'), 'hex')
      end,
      completion_payload = p_completion,
      publication_digest = v_digest
  where id = v_publication.id;

  -- Content epoch advances exactly once per newly-advanced current publication.
  update public.documents as target_document
  set write_generation = target_document.write_generation + 1
  where target_document.id = v_document.id
  returning target_document.write_generation into v_generation;

  -- Advance the authoritative pointer.
  insert into public.document_instrumental_current_publication (
    document_id, profile_id, publication_id, snapshot_content_id, write_generation, updated_at
  )
  values (v_document.id, v_document.profile_id, v_publication.id, v_content.id, v_generation, now())
  on conflict (document_id) do update
  set publication_id = excluded.publication_id,
      snapshot_content_id = excluded.snapshot_content_id,
      write_generation = excluded.write_generation,
      updated_at = excluded.updated_at;

  -- Legacy measure projection stays equal to the current pointer.
  update public.document_extracted_instrumental_measures
  set is_current = false,
      superseded_at = now()
  where document_id = v_document.id
    and snapshot_content_id is distinct from v_content.id
    and is_current;

  update public.document_extracted_instrumental_measures
  set is_current = true,
      superseded_at = null
  where document_id = v_document.id
    and snapshot_content_id = v_content.id
    and not is_current;

  -- Document projections equal the committed current publication.
  update public.documents
  set processing_status = 'ready',
      status = 'completed',
      document_summary = p_summary_text,
      observed_at = v_content.study_date,
      modality = v_content.modality,
      lab_name = v_content.facility_name,
      processing_version = v_content.processing_version,
      extraction_model = v_content.extraction_model,
      processed_at = now(),
      processing_error = null,
      page_count = coalesce((p_completion ->> 'page_count')::integer, page_count),
      thumbnail_storage_path = coalesce(p_completion ->> 'thumbnail_storage_path', thumbnail_storage_path),
      ocr_status = coalesce(p_completion ->> 'ocr_status', ocr_status),
      extraction_status = coalesce(p_completion ->> 'extraction_status', extraction_status),
      detected_document_type = case
        when p_completion ? 'detected_document_type' then nullif(p_completion ->> 'detected_document_type', '')
        else detected_document_type
      end,
      type_mismatch_warning = coalesce((p_completion ->> 'type_mismatch_warning')::boolean, type_mismatch_warning),
      type_mismatch_reason = case
        when p_completion ? 'type_mismatch_reason' then nullif(p_completion ->> 'type_mismatch_reason', '')
        else type_mismatch_reason
      end
  where id = v_document.id;

  -- Job and attempt complete in the same commit.
  update public.document_processing_jobs
  set status = 'completed',
      error = null,
      finished_at = now()
  where id = v_job.id;

  update public.document_processing_attempts
  set state = 'completed',
      terminal_at = now(),
      terminal_reason = null
  where id = v_attempt.id;

  -- Synthesis invalidation shares the commit (locked after publication per DAG).
  delete from public.profile_health_synthesis
  where profile_id = v_document.profile_id;

  return query select v_publication.id, v_generation, false;
end;
$$;

revoke all on function public.finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) to service_role;
