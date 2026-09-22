-- EH-104 authoritative tombstone outbox, cleanup queue, and retained receipt.
-- The operation row intentionally has no foreign key to documents so it survives
-- hard purge. It contains no document content, filename, or raw storage path.

alter table public.reports
  add column if not exists actual_source_document_ids uuid[] not null default '{}',
  add column if not exists source_scope_known boolean not null default true,
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidation_reason text,
  add column if not exists invalidated_by_deletion_operation_id uuid;

update public.reports
set actual_source_document_ids = coalesce(document_ids, '{}'::uuid[]),
    source_scope_known = document_ids is not null
where actual_source_document_ids = '{}'::uuid[]
  and (document_ids is not null or source_scope_known is true);

create index if not exists reports_profile_invalidation_idx
  on public.reports (profile_id, invalidated_at, created_at desc);
create index if not exists reports_actual_source_document_ids_idx
  on public.reports using gin (actual_source_document_ids);

create table if not exists public.document_deletion_operations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tombstone_write_generation bigint not null check (tombstone_write_generation >= 0),
  status text not null default 'queued' check (
    status in (
      'queued',
      'waiting_for_writers',
      'cleaning_storage',
      'verifying_storage',
      'purging_database',
      'retryable_error',
      'completed'
    )
  ),
  cleanup_lease_token uuid,
  cleanup_lease_expires_at timestamptz,
  cleanup_worker_id text,
  retry_count integer not null default 0 check (retry_count >= 0),
  next_retry_at timestamptz not null default now(),
  last_error_code text,
  purge_manifest_digest text check (
    purge_manifest_digest is null or purge_manifest_digest ~ '^[0-9a-f]{64}$'
  ),
  stable_empty_count integer not null default 0 check (stable_empty_count >= 0),
  last_empty_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  receipt_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_deletion_operations_terminal_consistency check (
    (status = 'completed') = (completed_at is not null)
  )
);

create unique index if not exists document_deletion_operations_document_unique
  on public.document_deletion_operations (document_id);
create index if not exists document_deletion_operations_claim_idx
  on public.document_deletion_operations (status, next_retry_at, cleanup_lease_expires_at, requested_at);
create index if not exists document_deletion_operations_profile_idx
  on public.document_deletion_operations (profile_id, requested_at desc);

alter table public.document_deletion_operations enable row level security;
revoke all on public.document_deletion_operations from public, anon, authenticated;
grant select on public.document_deletion_operations to service_role;

-- Root deletion is a database-finalizer operation, never a direct service-role
-- table mutation.
revoke delete on public.documents from public, anon, authenticated, service_role;

create or replace function public.eh123_reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('eh104.deletion_purge', true) = 'on'
    or current_setting('easyhealth.purge_lineage', true) = 'on' then
    return old;
  end if;
  if tg_op = 'update' then
    raise exception using message = 'eh123_append_only';
  end if;
  if not exists (select 1 from public.profiles where id = old.profile_id) then
    return old;
  end if;
  raise exception using message = 'eh123_append_only';
end;
$$;


create or replace function public.request_document_deletion(
  p_profile_id uuid,
  p_document_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  requested_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_operation public.document_deletion_operations%rowtype;
  v_operation_id uuid;
  v_generation bigint;
  v_invalidation_at timestamptz := clock_timestamp();
begin
  select * into v_document
  from public.documents
  where id = p_document_id
    and profile_id = p_profile_id
  for update;

  if v_document.id is null then
    select * into v_operation
    from public.document_deletion_operations
    where document_id = p_document_id
      and profile_id = p_profile_id;
    if v_operation.id is null then
      raise exception using message = 'document_not_found';
    end if;
    perform set_config('eh104.tombstone', 'off', true);
    return query select
      v_operation.id,
      v_operation.status,
      v_operation.requested_at,
      v_operation.completed_at;
    return;
  end if;

  select * into v_operation
  from public.document_deletion_operations
  where document_id = p_document_id
  for update;
  if v_operation.id is not null then
    perform set_config('eh104.tombstone', 'off', true);
    return query select
      v_operation.id,
      v_operation.status,
      v_operation.requested_at,
      v_operation.completed_at;
    return;
  end if;

  if v_document.lifecycle_state is distinct from 'active' then
    raise exception using message = 'document_deletion_operation_missing';
  end if;

  v_generation := v_document.write_generation + 1;
  perform set_config('eh104.tombstone', 'on', true);
  update public.documents
  set lifecycle_state = 'deleting',
      write_generation = v_generation,
      processing_status = 'deleting'
  where id = v_document.id;

  update public.document_processing_jobs
  set status = 'failed',
      error = 'document_deletion_requested',
      finished_at = now()
  where document_id = v_document.id
    and status = 'queued';

  update public.document_processing_attempts
  set cancellation_requested = true,
      cancellation_requested_at = now()
  where document_id = v_document.id
    and state = 'active';


  delete from public.profile_health_synthesis
  where profile_id = v_document.profile_id
    and (
      source_document_ids is null
      or cardinality(source_document_ids) = 0
      or p_document_id = any(source_document_ids)
    );
  insert into public.profile_health_synthesis_state (
    profile_id,
    current_synthesis_id,
    stale,
    invalidated_at,
    updated_at
  )
  values (
    v_document.profile_id,
    null,
    true,
    now(),
    now()
  )
  on conflict (profile_id) do update
  set current_synthesis_id = null,
      stale = true,
      invalidated_at = now(),
      updated_at = now();

  -- Invalidate generated text as a whole. A source-unknown legacy report is
  -- conservatively invalidated for every deletion in the profile.
  update public.reports
  set invalidated_at = v_invalidation_at,
      invalidation_reason = 'document_deletion'
  where profile_id = v_document.profile_id
    and invalidated_at is null
    and (
      not source_scope_known
      or coalesce(cardinality(actual_source_document_ids), 0) = 0
      or p_document_id = any(actual_source_document_ids)
    );


  insert into public.assessment_recalculation_jobs (
    profile_id,
    output_kind,
    status,
    queued_at,
    updated_at
  )
  values (
    v_document.profile_id,
    'health_profile',
    'queued',
    now(),
    now()
  )
  on conflict (profile_id, output_kind) do update
  set status = case
      when public.assessment_recalculation_jobs.status = 'processing'
        then 'processing'::public.assessment_recalculation_status
      else 'queued'::public.assessment_recalculation_status
    end,
    queued_at = now(),
    updated_at = now();

  -- Profile-level report/synthesis traces have no exact source linkage and are
  -- therefore not eligible for selective retention after a tombstone.
  delete from public.ai_invocations
  where profile_id = v_document.profile_id
    and document_id is null
    and (stage ilike '%report%' or stage ilike '%synthesis%');

  insert into public.document_deletion_operations (
    document_id,
    profile_id,
    tombstone_write_generation,
    status
  )
  values (
    v_document.id,
    v_document.profile_id,
    v_generation,
    'queued'
  )
  returning id into v_operation_id;

  update public.reports
  set invalidated_by_deletion_operation_id = v_operation_id
  where profile_id = v_document.profile_id
    and invalidated_by_deletion_operation_id is null
    and (
      not source_scope_known
      or coalesce(cardinality(actual_source_document_ids), 0) = 0
      or v_document.id = any(actual_source_document_ids)
    );

  perform set_config('eh104.tombstone', 'off', true);
  return query
  select
    v_operation_id,
    'queued'::text,
    now(),
    null::timestamptz;
end;
$$;

revoke all on function public.request_document_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.request_document_deletion(uuid, uuid)
  to service_role;

create or replace function public.get_document_deletion_operation(
  p_profile_id uuid,
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  retryable boolean,
  requested_at timestamptz,
  completed_at timestamptz,
  receipt_expires_at timestamptz,
  last_error_code text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    operation.id,
    operation.status,
    operation.status in ('queued', 'waiting_for_writers', 'cleaning_storage', 'verifying_storage', 'retryable_error'),
    operation.requested_at,
    operation.completed_at,
    operation.receipt_expires_at,
    operation.last_error_code
  from public.document_deletion_operations as operation
  where operation.profile_id = p_profile_id
    and operation.id = p_operation_id;
end;
$$;

revoke all on function public.get_document_deletion_operation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_document_deletion_operation(uuid, uuid)
  to service_role;

create or replace function public.claim_document_deletion_operation(
  p_worker_id text
)
returns table (
  operation_id uuid,
  document_id uuid,
  profile_id uuid,
  tombstone_write_generation bigint,
  operation_status text,
  cleanup_lease_token uuid,
  cleanup_lease_expires_at timestamptz,
  stable_empty_count integer,
  last_empty_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.document_deletion_operations%rowtype;
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '5 minutes';
begin
  select operation.* into v_operation
  from public.document_deletion_operations as operation
  where operation.status in ('queued', 'waiting_for_writers', 'cleaning_storage', 'verifying_storage', 'retryable_error')
    and operation.next_retry_at <= now()
    and (operation.cleanup_lease_expires_at is null or operation.cleanup_lease_expires_at <= now())
  order by operation.requested_at, operation.id
  for update skip locked
  limit 1;

  if v_operation.id is null then
    return;
  end if;

  update public.document_deletion_operations
  set cleanup_lease_token = v_token,
      cleanup_lease_expires_at = v_expires,
      cleanup_worker_id = left(coalesce(p_worker_id, 'document-cleanup'), 200),
      status = case when status = 'queued' then 'waiting_for_writers' else status end,
      updated_at = now()
  where id = v_operation.id;

  return query
  select
    v_operation.id,
    v_operation.document_id,
    v_operation.profile_id,
    v_operation.tombstone_write_generation,
    case when v_operation.status = 'queued' then 'waiting_for_writers' else v_operation.status end,
    v_token,
    v_expires,
    v_operation.stable_empty_count,
    v_operation.last_empty_at;
end;
$$;

create or replace function public.heartbeat_document_deletion_operation(
  p_operation_id uuid,
  p_cleanup_lease_token uuid,
  p_extend_seconds integer default 300
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  if p_extend_seconds < 30 or p_extend_seconds > 900 then
    raise exception using message = 'invalid_deletion_lease_extension';
  end if;
  update public.document_deletion_operations
  set cleanup_lease_expires_at = now() + make_interval(secs => p_extend_seconds),
      updated_at = now()
  where id = p_operation_id
    and cleanup_lease_token = p_cleanup_lease_token
    and cleanup_lease_expires_at > now()
    and status <> 'completed'
  returning cleanup_lease_expires_at into v_expires;
  if v_expires is null then
    raise exception using message = 'deletion_cleanup_lease_invalid';
  end if;
  return v_expires;
end;
$$;

revoke all on function public.heartbeat_document_deletion_operation(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.heartbeat_document_deletion_operation(uuid, uuid, integer)
  to service_role;

create or replace function public.transition_document_deletion_operation(
  p_operation_id uuid,
  p_cleanup_lease_token uuid,
  p_expected_status text,
  p_next_status text,
  p_manifest_digest text default null,
  p_empty_listing_count integer default null,
  p_last_empty_at timestamptz default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.document_deletion_operations%rowtype;
begin
  if p_next_status not in ('waiting_for_writers', 'cleaning_storage', 'verifying_storage', 'retryable_error') then
    raise exception using message = 'invalid_deletion_operation_transition';
  end if;
  if p_manifest_digest is not null and p_manifest_digest !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_deletion_manifest_digest';
  end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_:-]{1,80}$' then
    raise exception using message = 'invalid_deletion_error_code';
  end if;

  select * into v_operation
  from public.document_deletion_operations
  where id = p_operation_id
  for update;
  if v_operation.id is null then
    raise exception using message = 'deletion_operation_not_found';
  end if;
  if v_operation.cleanup_lease_token is distinct from p_cleanup_lease_token
    or v_operation.cleanup_lease_expires_at is null
    or v_operation.cleanup_lease_expires_at <= now() then
    raise exception using message = 'deletion_cleanup_lease_invalid';
  end if;
  if v_operation.status is distinct from p_expected_status then
    raise exception using message = 'deletion_operation_state_conflict';
  end if;

  update public.document_deletion_operations
  set status = p_next_status,
      purge_manifest_digest = coalesce(p_manifest_digest, purge_manifest_digest),
      stable_empty_count = coalesce(p_empty_listing_count, stable_empty_count),
      last_empty_at = coalesce(p_last_empty_at, last_empty_at),
      last_error_code = case when p_next_status = 'retryable_error' then p_error_code else null end,
      retry_count = case when p_next_status = 'retryable_error' then retry_count + 1 else retry_count end,
      next_retry_at = case
        when p_next_status = 'retryable_error'
          then now() + make_interval(secs => least(3600, greatest(5, (retry_count + 1) * 15)))
        else now()
      end,
      cleanup_lease_token = null,
      cleanup_lease_expires_at = null,
      updated_at = now()
  where id = p_operation_id;
end;
$$;

create or replace function public.finalize_document_deletion(
  p_operation_id uuid,
  p_cleanup_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation public.document_deletion_operations%rowtype;
  v_document public.documents%rowtype;
  v_now timestamptz := now();
begin
  select * into v_operation
  from public.document_deletion_operations
  where id = p_operation_id;
  if v_operation.id is null then
    raise exception using message = 'deletion_operation_not_found';
  end if;

  select * into v_document
  from public.documents
  where id = v_operation.document_id
    and profile_id = v_operation.profile_id
  for update;

  select * into v_operation
  from public.document_deletion_operations
  where id = p_operation_id
  for update;

  if v_operation.cleanup_lease_token is distinct from p_cleanup_lease_token
    or v_operation.cleanup_lease_expires_at is null
    or v_operation.cleanup_lease_expires_at <= v_now then
    raise exception using message = 'deletion_cleanup_lease_invalid';
  end if;
  if v_operation.status is distinct from 'verifying_storage'
    or v_operation.stable_empty_count < 2
    or v_operation.last_empty_at is null
    or v_operation.last_empty_at > v_now - interval '5 seconds' then
    raise exception using message = 'deletion_storage_verification_incomplete';
  end if;
  if v_document.id is null then
    update public.document_deletion_operations
    set status = 'completed',
        completed_at = coalesce(completed_at, v_now),
        cleanup_lease_token = null,
        cleanup_lease_expires_at = null,
        updated_at = v_now
    where id = p_operation_id;
    return;
  end if;

  if v_document.lifecycle_state is distinct from 'deleting'
    or v_document.write_generation is distinct from v_operation.tombstone_write_generation then
    raise exception using message = 'deletion_document_fence_conflict';
  end if;

  if exists (
    select 1
    from public.document_processing_attempts
    where document_id = v_document.id
      and state = 'active'
      and (
        lease_token is null
        or lease_expires_at is null
        or lease_expires_at > v_now
      )
  ) then
    raise exception using message = 'deletion_writers_not_quiesced';
  end if;

  update public.document_processing_attempts
  set state = 'cancelled',
      terminal_at = v_now,
      terminal_reason = 'document_deletion_finalized',
      lease_expires_at = null,
      lease_released_at = v_now
  where document_id = v_document.id
    and state = 'active';

  if exists (
    select 1
    from public.document_storage_write_intents
    where document_id = v_document.id
      and state in ('pending', 'exchanged')
      and (
        deadline_at > v_now
        or coalesce(upload_window_until, deadline_at) > v_now
      )
  ) then
    raise exception using message = 'deletion_storage_intents_not_quiesced';
  end if;

  update public.document_storage_write_intents
  set state = case when state in ('pending', 'exchanged') then 'expired' else state end,
      terminal_at = case when state in ('pending', 'exchanged') then v_now else terminal_at end,
      terminal_reason = case when state in ('pending', 'exchanged') then 'document_deletion_finalized' else terminal_reason end
  where document_id = v_document.id;

  update public.document_deletion_operations
  set status = 'purging_database',
      updated_at = v_now
  where id = p_operation_id;
  perform set_config('easyhealth.purge_lineage', 'on', true);
  perform set_config('eh104.deletion_purge', 'on', true);
  perform set_config('easyhealth.eh116_allow_batch_row_delete', 'on', true);

  delete from public.document_storage_upload_tickets
  where intent_id in (
    select id from public.document_storage_write_intents where document_id = v_document.id
  );
  delete from public.document_storage_write_intents
  where document_id = v_document.id;

  delete from public.profile_health_synthesis
  where profile_id = v_document.profile_id
    and p_operation_id is not null
    and (
      source_document_ids is null
      or cardinality(source_document_ids) = 0
      or v_document.id = any(source_document_ids)
    );
  delete from public.reports
  where invalidated_by_deletion_operation_id = p_operation_id;
  delete from public.health_profile_assessment_event_receipts
  where assessment_version_id in (
    select id
    from public.health_profile_assessment_versions
    where profile_id = v_document.profile_id
      and v_document.id = any(source_document_ids)
  );
  delete from public.health_profile_assessment_versions
  where profile_id = v_document.profile_id
    and v_document.id = any(source_document_ids);
  delete from public.ai_invocations
  where profile_id = v_document.profile_id
    and document_id = v_document.id;

  delete from public.medical_events
  where source_document_id = v_document.id;
  delete from public.document_duplicate_audit_events
  where left_document_id = v_document.id
    or right_document_id = v_document.id
    or archived_document_id = v_document.id;
  delete from public.document_duplicate_candidates
  where left_document_id = v_document.id
    or right_document_id = v_document.id;
  delete from public.observation_change_events
  where document_id = v_document.id;
  delete from public.assessment_dependency_events
  where document_id = v_document.id;
  delete from public.eh120_lifecycle_transition_operations
  where document_id = v_document.id;
  delete from public.document_extracted_finding_versions
  where document_id = v_document.id;
  delete from public.document_extracted_clinical_notes
  where document_id = v_document.id;
  delete from public.document_extracted_prescriptions
  where document_id = v_document.id;
  delete from public.document_extracted_referrals
  where document_id = v_document.id;
  delete from public.observations
  where document_id = v_document.id;
  delete from public.registry_reprocess_batch_rows
  where document_id = v_document.id;
  delete from public.registry_reprocess_batches
  where scope_document_id = v_document.id;
  delete from public.observation_normalization_revisions
  where extracted_biomarker_id in (
    select id
    from public.document_extracted_biomarkers
    where document_id = v_document.id
  );
  delete from public.document_extracted_instrumental_measures
  where document_id = v_document.id;
  delete from public.document_extracted_biomarkers
  where document_id = v_document.id;
  delete from public.document_pages
  where document_id = v_document.id;
  delete from public.document_instrumental_current_publication
  where document_id = v_document.id;
  delete from public.document_instrumental_publications
  where document_id = v_document.id;
  delete from public.document_instrumental_snapshot_contents
  where document_id = v_document.id;
  delete from public.document_processing_attempts
  where document_id = v_document.id;
  delete from public.document_processing_jobs
  where document_id = v_document.id;
  delete from public.documents
  where id = v_document.id
    and profile_id = v_document.profile_id
    and lifecycle_state = 'deleting'
    and write_generation = v_operation.tombstone_write_generation;

  if not found then
    raise exception using message = 'deletion_document_purge_conflict';
  end if;

  update public.document_deletion_operations
  set status = 'completed',
      completed_at = v_now,
      cleanup_lease_token = null,
      cleanup_lease_expires_at = null,
      updated_at = v_now
  where id = p_operation_id;
  perform set_config('easyhealth.purge_lineage', 'off', true);
  perform set_config('eh104.deletion_purge', 'off', true);
  perform set_config('easyhealth.eh116_allow_batch_row_delete', 'off', true);
end;
$$;

create index if not exists document_deletion_operations_receipt_expiry_idx
  on public.document_deletion_operations (receipt_expires_at, id)
  where status = 'completed';

create or replace function public.prune_expired_document_deletion_receipts(
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using message = 'invalid_deletion_receipt_limit';
  end if;

  with expired as (
    select id
    from public.document_deletion_operations
    where status = 'completed'
      and receipt_expires_at <= now()
    order by receipt_expires_at, id
    for update skip locked
    limit p_limit
  )
  delete from public.document_deletion_operations as operation
  using expired
  where operation.id = expired.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_expired_document_deletion_receipts(integer)
  from public, anon, authenticated;
grant execute on function public.prune_expired_document_deletion_receipts(integer)
  to service_role;

revoke all on function public.claim_document_deletion_operation(text)
  from public, anon, authenticated;
grant execute on function public.claim_document_deletion_operation(text)
  to service_role;
revoke all on function public.transition_document_deletion_operation(uuid, uuid, text, text, text, integer, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.transition_document_deletion_operation(uuid, uuid, text, text, text, integer, timestamptz, text)
  to service_role;
revoke all on function public.finalize_document_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_document_deletion(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
