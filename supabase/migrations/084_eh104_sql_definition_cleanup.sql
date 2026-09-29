-- EH-104 corrective function definitions.
-- Keep the retired shadow relation out of the current preflight and qualify
-- table columns that collide with RETURNS TABLE output names.

create or replace function public.eh104_resolution_verification_preflight()
returns table (
  finding_code text,
  subject_type text,
  subject_id uuid,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    'invalid_revision_verification_status'::text,
    'normalization_revision'::text,
    revision.id,
    jsonb_build_object('verification_status', revision.verification_status)
  from public.observation_normalization_revisions as revision
  where revision.verification_status is null
    or revision.verification_status not in ('pending', 'auto_verified', 'user_verified', 'manually_corrected')

  union all

  select
    'invalid_extracted_resolver_result'::text,
    'extracted_biomarker'::text,
    extracted.id,
    jsonb_build_object('resolver_result', extracted.resolver_result)
  from public.document_extracted_biomarkers as extracted
  where extracted.resolver_result is not null
    and extracted.resolver_result not in ('resolved', 'partial', 'ambiguous', 'unmapped')

  union all

  select
    'invalid_extracted_verification_status'::text,
    'extracted_biomarker'::text,
    extracted.id,
    jsonb_build_object('verification_status', extracted.verification_status)
  from public.document_extracted_biomarkers as extracted
  where extracted.verification_status is not null
    and extracted.verification_status not in ('pending', 'auto_verified', 'user_verified', 'manually_corrected')

  union all

  select
    'verified_incomplete_revision'::text,
    'normalization_revision'::text,
    revision.id,
    jsonb_build_object(
      'verification_status', revision.verification_status,
      'resolver_result', revision.resolver_result,
      'measurement_definition_key', revision.measurement_definition_key
    )
  from public.observation_normalization_revisions as revision
  where revision.verification_status in ('auto_verified', 'user_verified', 'manually_corrected')
    and (
      revision.resolver_result is distinct from 'resolved'
      or revision.measurement_definition_key is null
    )

  union all

  select
    'half_linked_observation'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'source_extracted_biomarker_id', observation.source_extracted_biomarker_id,
      'normalization_revision_id', observation.normalization_revision_id
    )
  from public.observations as observation
  where (observation.source_extracted_biomarker_id is null)
      <> (observation.normalization_revision_id is null)

  union all

  select
    'revision_source_mismatch'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'source_extracted_biomarker_id', observation.source_extracted_biomarker_id,
      'revision_extracted_biomarker_id', revision.extracted_biomarker_id,
      'normalization_revision_id', revision.id
    )
  from public.observations as observation
  join public.observation_normalization_revisions as revision
    on revision.id = observation.normalization_revision_id
  where observation.source_extracted_biomarker_id is distinct from revision.extracted_biomarker_id

  union all

  select
    'observation_source_owner_mismatch'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'observation_profile_id', observation.profile_id,
      'source_profile_id', extracted.profile_id,
      'observation_document_id', observation.document_id,
      'source_document_id', extracted.document_id
    )
  from public.observations as observation
  join public.observation_normalization_revisions as revision
    on revision.id = observation.normalization_revision_id
  join public.document_extracted_biomarkers as extracted
    on extracted.id = revision.extracted_biomarker_id
  where observation.profile_id is distinct from extracted.profile_id
     or observation.document_id is distinct from extracted.document_id

  union all

  select
    'multiple_active_revisions'::text,
    'extracted_biomarker'::text,
    active_revision.extracted_biomarker_id,
    jsonb_build_object('active_revision_ids', jsonb_agg(active_revision.id order by active_revision.id))
  from public.observation_normalization_revisions as active_revision
  where active_revision.is_active
  group by active_revision.extracted_biomarker_id
  having count(*) > 1

  union all

  select
    'divergent_observation_projection'::text,
    'observation'::text,
    observation.id,
    jsonb_build_object(
      'normalization_revision_id', revision.id,
      'observation_measurement_definition_key', observation.measurement_definition_key,
      'revision_measurement_definition_key', revision.measurement_definition_key,
      'observation_resolution_status', observation.resolution_status,
      'revision_resolver_result', revision.resolver_result
    )
  from public.observations as observation
  join public.observation_normalization_revisions as revision
    on revision.id = observation.normalization_revision_id
   and revision.is_active
  where observation.measurement_definition_key is distinct from revision.measurement_definition_key
    or observation.resolution_status is distinct from revision.resolver_result;

  return query
  select
    'invalid_revision_verification_decision_metadata'::text,
    'normalization_revision'::text,
    revision.id,
    jsonb_build_object(
      'verification_status', revision.verification_status,
      'verification_decided_at', revision.verification_decided_at,
      'verification_actor_type', revision.verification_actor_type,
      'verification_actor_id', revision.verification_actor_id
    )
  from public.observation_normalization_revisions as revision
  where (revision.verification_status = 'pending' and (
      revision.verification_decided_at is not null
      or revision.verification_actor_type is not null
      or revision.verification_actor_id is not null
    ))
    or (revision.verification_status = 'auto_verified' and (
      revision.verification_decided_at is null
      or revision.verification_actor_type is distinct from 'system'
      or revision.verification_actor_id is not null
    ))
    or (revision.verification_status in ('user_verified', 'manually_corrected') and (
      revision.verification_decided_at is null
      or revision.verification_actor_type is distinct from 'user'
      or revision.verification_actor_id is null
    ));
end;
$$;

revoke all on function public.eh104_resolution_verification_preflight()
  from public, anon, authenticated;
grant execute on function public.eh104_resolution_verification_preflight()
  to service_role;

create or replace function public.consume_storage_upload_ticket(
  p_intent_id uuid,
  p_ticket_hash text
)
returns table (
  intent_id uuid,
  bucket text,
  object_path text,
  content_type text,
  write_generation bigint,
  deadline_at timestamptz,
  ticket_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.document_storage_write_intents%rowtype;
  v_document public.documents%rowtype;
  v_ticket public.document_storage_upload_tickets%rowtype;
begin
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id;
  if v_intent.id is null then
    raise exception using message = 'storage_intent_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_intent.document_id
  for update;
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id
  for update;
  select * into v_ticket
  from public.document_storage_upload_tickets as upload_ticket
  where upload_ticket.intent_id = p_intent_id
    and upload_ticket.ticket_hash = p_ticket_hash
  for update;

  if v_ticket.ticket_hash is null then
    raise exception using message = 'storage_ticket_not_found';
  end if;
  if v_ticket.consumed_at is not null then
    raise exception using message = 'storage_ticket_already_consumed';
  end if;
  if v_ticket.expires_at <= now() then
    raise exception using message = 'storage_ticket_expired';
  end if;
  if v_intent.state is distinct from 'pending'
    or v_intent.deadline_at <= now()
    or v_document.id is null
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.write_generation is distinct from v_intent.write_generation then
    raise exception using message = 'storage_intent_fence_rejected';
  end if;

  update public.document_storage_upload_tickets as upload_ticket
  set consumed_at = now()
  where upload_ticket.ticket_hash = p_ticket_hash;
  update public.document_storage_write_intents
  set state = 'exchanged',
      last_exchange_at = now(),
      upload_window_until = v_intent.deadline_at
  where id = p_intent_id;

  return query select
    v_intent.id,
    v_intent.bucket,
    v_intent.object_path,
    v_intent.content_type,
    v_intent.write_generation,
    v_intent.deadline_at,
    v_ticket.expires_at;
end;
$$;

revoke all on function public.consume_storage_upload_ticket(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_storage_upload_ticket(uuid, text)
  to service_role;

create or replace function public.complete_storage_write_intent(
  p_intent_id uuid,
  p_ticket_hash text,
  p_object_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.document_storage_write_intents%rowtype;
  v_document public.documents%rowtype;
  v_ticket public.document_storage_upload_tickets%rowtype;
begin
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id;
  if v_intent.id is null then
    raise exception using message = 'storage_intent_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_intent.document_id
  for update;
  select * into v_intent
  from public.document_storage_write_intents
  where id = p_intent_id
  for update;
  select * into v_ticket
  from public.document_storage_upload_tickets as upload_ticket
  where upload_ticket.intent_id = p_intent_id
    and upload_ticket.ticket_hash = p_ticket_hash;

  if v_ticket.ticket_hash is null or v_ticket.consumed_at is null then
    raise exception using message = 'storage_ticket_not_consumed';
  end if;
  if not p_object_verified then
    raise exception using message = 'storage_object_not_verified';
  end if;
  if v_intent.state is distinct from 'exchanged' then
    raise exception using message = 'storage_intent_not_exchanged';
  end if;
  if v_document.id is null
    or v_document.lifecycle_state is distinct from 'active'
    or v_document.write_generation is distinct from v_intent.write_generation then
    raise exception using message = 'storage_intent_fence_rejected';
  end if;

  if v_intent.principal_kind = 'worker' then
    perform public.eh104_assert_processing_lease(
      v_intent.processing_attempt_id,
      v_intent.lease_token,
      v_intent.write_generation,
      false
    );
  else
    perform set_config('eh104.upload_complete', 'on', true);
    update public.documents
    set upload_state = 'complete'
    where id = v_document.id and upload_state = 'pending';
  end if;

  update public.document_storage_write_intents
  set state = 'completed',
      completed_at = now(),
      upload_window_until = null
  where id = p_intent_id;
  if v_intent.principal_kind = 'owner' then
    perform set_config('eh104.upload_complete', 'off', true);
  end if;
end;
$$;

revoke all on function public.complete_storage_write_intent(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_storage_write_intent(uuid, text, boolean)
  to service_role;

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
  from public.profile_health_synthesis as synthesis
  where synthesis.profile_id = p_profile_id
    and synthesis.input_hash = p_input_hash
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
  on conflict on constraint profile_health_synthesis_profile_input_unique do update
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
  on conflict on constraint profile_health_synthesis_state_pkey do update
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

revoke all on function public.persist_profile_health_synthesis(uuid, uuid[], jsonb, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.persist_profile_health_synthesis(uuid, uuid[], jsonb, text, text, text, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
