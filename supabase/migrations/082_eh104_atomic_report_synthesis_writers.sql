-- EH-104 cross-domain writer cutover. Report and synthesis PHI may only be
-- persisted after sorted document locks and write-generation revalidation.

alter table public.reports
  add column if not exists requested_document_ids uuid[],
  add column if not exists source_write_generations jsonb not null default '{}'::jsonb;

create index if not exists reports_requested_document_ids_idx
  on public.reports using gin (requested_document_ids);

create or replace function public.eh104_lock_validate_source_documents(
  p_profile_id uuid,
  p_document_ids uuid[],
  p_source_write_generations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_document_id uuid;
  v_expected_generation bigint;
begin
  if p_document_ids is null
    or array_length(p_document_ids, 1) is null
    or p_source_write_generations is null
    or jsonb_typeof(p_source_write_generations) is distinct from 'object' then
    raise exception using message = 'report_source_snapshot_required';
  end if;
  if exists (
    select 1
    from unnest(p_document_ids) as ids(document_id)
    group by ids.document_id
    having count(*) > 1
  ) then
    raise exception using message = 'report_source_ids_duplicated';
  end if;

  for v_document_id in
    select ids.document_id
    from unnest(p_document_ids) as ids(document_id)
    order by ids.document_id
  loop
    select * into v_document
    from public.documents
    where id = v_document_id
      and profile_id = p_profile_id
    for update;

    if v_document.id is null then
      raise exception using message = 'report_source_not_found';
    end if;
    if v_document.lifecycle_state is distinct from 'active'
      or v_document.upload_state is distinct from 'complete' then
      raise exception using message = 'report_source_unavailable';
    end if;

    begin
      v_expected_generation := (p_source_write_generations ->> v_document_id::text)::bigint;
    exception when invalid_text_representation then
      raise exception using message = 'report_source_generation_invalid';
    end;
    if v_expected_generation is null
      or v_expected_generation is distinct from v_document.write_generation then
      raise exception using message = 'report_source_generation_conflict';
    end if;
  end loop;
end;
$$;

revoke all on function public.eh104_lock_validate_source_documents(uuid, uuid[], jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.create_validated_report(
  p_profile_id uuid,
  p_title text,
  p_report_type text,
  p_detail_level text,
  p_requested_document_ids uuid[],
  p_actual_source_document_ids uuid[],
  p_source_write_generations jsonb,
  p_abnormal_only boolean,
  p_content jsonb,
  p_summary_preview text
)
returns setof public.reports
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_report public.reports%rowtype;
begin
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception using message = 'report_title_required';
  end if;
  if p_report_type not in ('general_practice', 'cardiology', 'endocrinology') then
    raise exception using message = 'report_type_invalid';
  end if;
  if p_detail_level not in ('compact', 'standard', 'detailed', 'full') then
    raise exception using message = 'report_detail_level_invalid';
  end if;
  if p_content is null or jsonb_typeof(p_content) is distinct from 'object' then
    raise exception using message = 'report_content_invalid';
  end if;
  if p_summary_preview is null then
    raise exception using message = 'report_summary_required';
  end if;

  perform public.eh104_lock_validate_source_documents(
    p_profile_id,
    p_actual_source_document_ids,
    p_source_write_generations
  );

  insert into public.reports (
    profile_id,
    title,
    report_type,
    detail_level,
    document_ids,
    requested_document_ids,
    actual_source_document_ids,
    source_scope_known,
    source_write_generations,
    abnormal_only,
    content,
    summary_preview,
    invalidated_at,
    invalidation_reason,
    invalidated_by_deletion_operation_id
  )
  values (
    p_profile_id,
    left(p_title, 500),
    p_report_type,
    p_detail_level,
    p_actual_source_document_ids,
    p_requested_document_ids,
    p_actual_source_document_ids,
    true,
    p_source_write_generations,
    coalesce(p_abnormal_only, false),
    p_content,
    p_summary_preview,
    null,
    null,
    null
  )
  returning * into v_report;

  return next v_report;
end;
$$;

create or replace function public.delete_owner_report(
  p_profile_id uuid,
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_document_id uuid;
  v_document public.documents%rowtype;
begin
  select * into v_report
  from public.reports
  where id = p_report_id
    and profile_id = p_profile_id;
  if v_report.id is null then
    raise exception using message = 'report_not_found';
  end if;

  for v_document_id in
    select ids.document_id
    from unnest(coalesce(v_report.actual_source_document_ids, '{}'::uuid[])) as ids(document_id)
    order by ids.document_id
  loop
    select * into v_document
    from public.documents
    where id = v_document_id
      and profile_id = p_profile_id
    for update;
  end loop;

  select * into v_report
  from public.reports
  where id = p_report_id
    and profile_id = p_profile_id
  for update;
  if v_report.id is null then
    raise exception using message = 'report_not_found';
  end if;

  delete from public.reports where id = p_report_id and profile_id = p_profile_id;
end;
$$;

create or replace function public.persist_profile_health_synthesis(
  p_profile_id uuid,
  p_source_document_ids uuid[],
  p_source_write_generations jsonb,
  p_input_hash text,
  p_model text,
  p_synthesis_text text,
  p_generated_at timestamptz
)
returns table (
  synthesis_id uuid,
  profile_id uuid,
  synthesis_text text,
  source_document_ids uuid[],
  input_hash text,
  model text,
  generated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_synthesis public.profile_health_synthesis%rowtype;
begin
  if p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'synthesis_input_hash_invalid';
  end if;
  if p_model is null or length(btrim(p_model)) = 0 then
    raise exception using message = 'synthesis_model_required';
  end if;
  if p_synthesis_text is null or length(btrim(p_synthesis_text)) = 0 then
    raise exception using message = 'synthesis_text_required';
  end if;

  perform public.eh104_lock_validate_source_documents(
    p_profile_id,
    p_source_document_ids,
    p_source_write_generations
  );

  select * into v_synthesis
  from public.profile_health_synthesis
  where profile_id = p_profile_id
    and input_hash = p_input_hash
  for update;

  insert into public.profile_health_synthesis (
    profile_id,
    synthesis_text,
    source_document_ids,
    input_hash,
    model,
    generated_at
  )
  values (
    p_profile_id,
    p_synthesis_text,
    p_source_document_ids,
    p_input_hash,
    p_model,
    coalesce(p_generated_at, now())
  )
  on conflict (profile_id, input_hash) do update
  set synthesis_text = excluded.synthesis_text,
      source_document_ids = excluded.source_document_ids,
      model = excluded.model,
      generated_at = excluded.generated_at
  returning * into v_synthesis;

  insert into public.profile_health_synthesis_state (
    profile_id,
    current_synthesis_id,
    stale,
    invalidated_at,
    updated_at
  )
  values (
    p_profile_id,
    v_synthesis.id,
    false,
    null,
    coalesce(p_generated_at, now())
  )
  on conflict (profile_id) do update
  set current_synthesis_id = excluded.current_synthesis_id,
      stale = false,
      invalidated_at = null,
      updated_at = excluded.updated_at;

  return query select
    v_synthesis.id,
    v_synthesis.profile_id,
    v_synthesis.synthesis_text,
    v_synthesis.source_document_ids,
    v_synthesis.input_hash,
    v_synthesis.model,
    v_synthesis.generated_at;
end;
$$;

update public.ai_invocations
set error_code = 'llm_provider_unavailable'
where error_code is not null
  and error_code not in (
    'ocr_provider_unavailable',
    'ocr_timeout',
    'ocr_invalid_response',
    'ocr_input_rejected',
    'ocr_page_mismatch',
    'llm_timeout',
    'llm_rate_limited',
    'llm_auth_failed',
    'llm_invalid_response',
    'llm_input_rejected',
    'llm_provider_unavailable'
  );

alter table public.ai_invocations
  drop constraint if exists ai_invocations_error_code_check;

alter table public.ai_invocations
  add constraint ai_invocations_error_code_check
  check (
    error_code is null or error_code in (
      'ocr_provider_unavailable',
      'ocr_timeout',
      'ocr_invalid_response',
      'ocr_input_rejected',
      'ocr_page_mismatch',
      'llm_timeout',
      'llm_rate_limited',
      'llm_auth_failed',
      'llm_invalid_response',
      'llm_input_rejected',
      'llm_provider_unavailable'
    )
  );

revoke all on table public.reports from public, anon, authenticated, service_role;
revoke all on table public.profile_health_synthesis from public, anon, authenticated, service_role;
revoke all on table public.profile_health_synthesis_state from public, anon, authenticated, service_role;

grant select on table public.reports to service_role;
grant select on table public.profile_health_synthesis to service_role;
grant select on table public.profile_health_synthesis_state to service_role;

revoke all on function public.create_validated_report(uuid, text, text, text, uuid[], uuid[], jsonb, boolean, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_validated_report(uuid, text, text, text, uuid[], uuid[], jsonb, boolean, jsonb, text)
  to service_role;
revoke all on function public.delete_owner_report(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_owner_report(uuid, uuid)
  to service_role;
revoke all on function public.persist_profile_health_synthesis(uuid, uuid[], jsonb, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.persist_profile_health_synthesis(uuid, uuid[], jsonb, text, text, text, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
