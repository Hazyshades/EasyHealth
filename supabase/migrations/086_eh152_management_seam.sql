-- EH-152 consumes owner-scoped EH-151 RPC seams. Extend those seams with
-- safe display/retention metadata and an explicit replacement replay marker.

drop function if exists public.list_report_shares_for_owner(uuid, uuid);

create function public.list_report_shares_for_owner(
  p_profile_id uuid,
  p_report_id uuid default null
)
returns table (
  share_id uuid,
  report_id uuid,
  report_title text,
  expires_at timestamptz,
  revoked_at timestamptz,
  download_policy text,
  allowed_export_formats text[],
  document_ids uuid[],
  created_at timestamptz,
  last_accessed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    links.id,
    links.report_id,
    reports.title,
    links.expires_at,
    links.revoked_at,
    links.download_policy,
    links.allowed_export_formats,
    coalesce(
      array_agg(scope.document_id order by scope.document_id)
        filter (where scope.document_id is not null),
      '{}'::uuid[]
    ),
    links.created_at,
    links.last_accessed_at
  from public.report_share_links as links
  join public.reports as reports
    on reports.id = links.report_id
   and reports.profile_id = links.profile_id
  left join public.report_share_documents as scope
    on scope.share_id = links.id
  where links.profile_id = p_profile_id
    and (p_report_id is null or links.report_id = p_report_id)
  group by
    links.id,
    links.report_id,
    reports.title,
    links.expires_at,
    links.revoked_at,
    links.download_policy,
    links.allowed_export_formats,
    links.created_at,
    links.last_accessed_at
  order by links.created_at desc;
$$;

drop function if exists public.list_report_share_access_events_for_owner(uuid, uuid);

create function public.list_report_share_access_events_for_owner(
  p_profile_id uuid,
  p_share_id uuid
)
returns table (
  event_id uuid,
  occurred_at timestamptz,
  result text,
  resource_kind text,
  client_class text,
  retention_expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    events.id,
    events.occurred_at,
    events.result,
    events.resource_kind,
    events.client_class,
    events.retention_expires_at
  from public.report_share_access_events as events
  join public.report_share_links as links on links.id = events.share_id
  where links.profile_id = p_profile_id
    and events.share_id = p_share_id
    and events.retention_expires_at > clock_timestamp()
  order by events.occurred_at desc, events.id desc;
$$;

drop function if exists public.replace_report_share(uuid, uuid, text, text, text);

create function public.replace_report_share(
  p_profile_id uuid,
  p_predecessor_share_id uuid,
  p_idempotency_key text,
  p_token_digest text,
  p_token_key_version text
)
returns table (
  operation_id uuid,
  successor_share_id uuid,
  operation_status text,
  replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_operation public.share_replacement_operations%rowtype;
  v_predecessor public.report_share_links%rowtype;
  v_successor_id uuid;
begin
  if p_profile_id is null
    or p_predecessor_share_id is null
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9._~-]{1,128}$'
    or p_token_digest is null
    or p_token_digest !~ '^[0-9a-f]{64}$'
    or p_token_key_version is null
    or p_token_key_version !~ '^[A-Za-z0-9._~-]{1,32}$' then
    raise exception using message = 'share_replacement_invalid';
  end if;

  select * into v_predecessor
  from public.report_share_links
  where id = p_predecessor_share_id
    and profile_id = p_profile_id
  for update;
  if v_predecessor.id is null then
    raise exception using message = 'share_replacement_conflict';
  end if;

  select * into v_operation
  from public.share_replacement_operations
  where profile_id = p_profile_id
    and predecessor_share_id = p_predecessor_share_id
    and idempotency_key = p_idempotency_key;
  if v_operation.id is not null then
    return query select
      v_operation.id,
      v_operation.successor_share_id,
      v_operation.operation_status,
      true;
    return;
  end if;

  if v_predecessor.revoked_at is not null
    or v_predecessor.expires_at <= clock_timestamp() then
    raise exception using message = 'share_replacement_conflict';
  end if;

  insert into public.share_replacement_operations (
    profile_id,
    predecessor_share_id,
    idempotency_key
  )
  values (p_profile_id, p_predecessor_share_id, p_idempotency_key)
  returning * into v_operation;

  insert into public.report_share_links (
    profile_id,
    report_id,
    predecessor_share_id,
    token_digest,
    token_key_version,
    pin_hash,
    pin_salt,
    expires_at,
    download_policy,
    allowed_export_formats
  )
  values (
    v_predecessor.profile_id,
    v_predecessor.report_id,
    v_predecessor.id,
    p_token_digest,
    p_token_key_version,
    v_predecessor.pin_hash,
    v_predecessor.pin_salt,
    v_predecessor.expires_at,
    v_predecessor.download_policy,
    v_predecessor.allowed_export_formats
  )
  returning id into v_successor_id;

  insert into public.report_share_documents (share_id, document_id)
  select v_successor_id, document_id
  from public.report_share_documents
  where share_id = v_predecessor.id;

  update public.report_share_links
  set revoked_at = clock_timestamp()
  where id = v_predecessor.id;

  update public.share_replacement_operations
  set successor_share_id = v_successor_id,
      operation_status = 'committed',
      committed_at = clock_timestamp()
  where id = v_operation.id;

  return query select v_operation.id, v_successor_id, 'committed'::text, false;
end;
$$;

revoke all on function public.list_report_shares_for_owner(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.list_report_shares_for_owner(uuid, uuid)
  to service_role;
revoke all on function public.list_report_share_access_events_for_owner(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.list_report_share_access_events_for_owner(uuid, uuid)
  to service_role;
revoke all on function public.replace_report_share(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.replace_report_share(uuid, uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
