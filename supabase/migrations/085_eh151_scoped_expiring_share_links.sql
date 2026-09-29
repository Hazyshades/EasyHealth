-- EH-151 scoped, expiring report shares.
-- Public capability state is reachable only through service-owned transitions.

create or replace function public.eh151_unique_text_array(p_values text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select cardinality(coalesce(p_values, '{}'::text[])) = cardinality(
    array(
      select distinct value
      from unnest(coalesce(p_values, '{}'::text[])) as format_values(value)
    )
  );
$$;

revoke all on function public.eh151_unique_text_array(text[])
  from public, anon, authenticated, service_role;

create table if not exists public.report_share_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  predecessor_share_id uuid references public.report_share_links(id) on delete cascade,
  token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
  token_key_version text not null check (token_key_version ~ '^[A-Za-z0-9._~-]{1,32}$'),
  pin_hash text,
  pin_salt text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  download_policy text not null check (download_policy in ('none', 'report', 'documents')),
  allowed_export_formats text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  constraint report_share_links_pin_pair_check check (
    (pin_hash is null and pin_salt is null)
    or (pin_hash is not null and pin_salt is not null)
  ),
  constraint report_share_links_formats_check check (
    allowed_export_formats <@ array['pdf', 'csv', 'json']::text[]
    and public.eh151_unique_text_array(allowed_export_formats)
  ),
  constraint report_share_links_policy_formats_check check (
    download_policy <> 'none' or cardinality(allowed_export_formats) = 0
  ),
  constraint report_share_links_predecessor_self_check check (
    predecessor_share_id is null or predecessor_share_id <> id
  )
);

create index if not exists report_share_links_profile_idx
  on public.report_share_links (profile_id, created_at desc);
create index if not exists report_share_links_report_idx
  on public.report_share_links (report_id, created_at desc);
create index if not exists report_share_links_expiry_idx
  on public.report_share_links (expires_at, revoked_at);
create unique index if not exists report_share_links_successor_idx
  on public.report_share_links (predecessor_share_id)
  where predecessor_share_id is not null;

create table if not exists public.report_share_documents (
  share_id uuid not null references public.report_share_links(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (share_id, document_id)
);

create index if not exists report_share_documents_document_idx
  on public.report_share_documents (document_id, share_id);

create table if not exists public.report_share_access_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.report_share_links(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  result text not null check (
    result in (
      'allowed',
      'denied',
      'expired',
      'revoked',
      'pin_required',
      'pin_invalid',
      'rate_limited',
      'unavailable'
    )
  ),
  resource_kind text not null check (
    resource_kind in ('page', 'report', 'export', 'document', 'pin')
  ),
  client_class text not null check (
    client_class in ('browser', 'automation', 'other', 'unknown')
  ),
  retention_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists report_share_access_events_retention_idx
  on public.report_share_access_events (retention_expires_at, id);
create index if not exists report_share_access_events_share_idx
  on public.report_share_access_events (share_id, occurred_at desc);

create table if not exists public.share_pin_proofs (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.report_share_links(id) on delete cascade,
  proof_digest text not null unique check (proof_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists share_pin_proofs_expiry_idx
  on public.share_pin_proofs (expires_at, id);
create index if not exists share_pin_proofs_share_idx
  on public.share_pin_proofs (share_id, expires_at desc);

create table if not exists public.share_rate_limit_buckets (
  key_digest text not null check (key_digest ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  count integer not null check (count > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (key_digest, window_started_at)
);

create index if not exists share_rate_limit_buckets_expiry_idx
  on public.share_rate_limit_buckets (expires_at, key_digest);

create table if not exists public.share_replacement_operations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  predecessor_share_id uuid not null references public.report_share_links(id) on delete cascade,
  successor_share_id uuid references public.report_share_links(id) on delete cascade,
  idempotency_key text not null check (
    idempotency_key ~ '^[A-Za-z0-9._~-]{1,128}$'
  ),
  operation_status text not null default 'reserved' check (
    operation_status in ('reserved', 'committed')
  ),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  constraint share_replacement_operations_successor_check check (
    (operation_status = 'committed') = (successor_share_id is not null and committed_at is not null)
  ),
  constraint share_replacement_operations_unique_key
    unique (profile_id, predecessor_share_id, idempotency_key),
  constraint share_replacement_operations_unique_predecessor
    unique (predecessor_share_id)
);

create index if not exists share_replacement_operations_successor_idx
  on public.share_replacement_operations (successor_share_id);

alter table public.report_share_links enable row level security;
alter table public.report_share_documents enable row level security;
alter table public.report_share_access_events enable row level security;
alter table public.share_pin_proofs enable row level security;
alter table public.share_rate_limit_buckets enable row level security;
alter table public.share_replacement_operations enable row level security;

revoke all on table public.report_share_links from public, anon, authenticated, service_role;
revoke all on table public.report_share_documents from public, anon, authenticated, service_role;
revoke all on table public.report_share_access_events from public, anon, authenticated, service_role;
revoke all on table public.share_pin_proofs from public, anon, authenticated, service_role;
revoke all on table public.share_rate_limit_buckets from public, anon, authenticated, service_role;
revoke all on table public.share_replacement_operations from public, anon, authenticated, service_role;

create or replace function public.create_report_share(
  p_profile_id uuid,
  p_report_id uuid,
  p_token_digest text,
  p_token_key_version text,
  p_pin_hash text,
  p_pin_salt text,
  p_expires_at timestamptz,
  p_download_policy text,
  p_allowed_export_formats text[],
  p_document_ids uuid[]
)
returns table (
  share_id uuid,
  expires_at timestamptz,
  download_policy text,
  allowed_export_formats text[]
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_report public.reports%rowtype;
  v_profile_id uuid;
  v_share_id uuid;
  v_document_ids uuid[] := coalesce(p_document_ids, '{}'::uuid[]);
  v_formats text[] := coalesce(p_allowed_export_formats, '{}'::text[]);
  v_document_id uuid;
begin
  if p_profile_id is null or p_report_id is null then
    raise exception using message = 'share_owner_required';
  end if;

  select id into v_profile_id
  from public.profiles
  where id = p_profile_id
  for update;
  if v_profile_id is null then
    raise exception using message = 'share_owner_required';
  end if;

  if p_token_digest is null or p_token_digest !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'share_token_digest_invalid';
  end if;
  if p_token_key_version is null or p_token_key_version !~ '^[A-Za-z0-9._~-]{1,32}$' then
    raise exception using message = 'share_token_key_version_invalid';
  end if;
  if p_expires_at is null or p_expires_at <= clock_timestamp() then
    raise exception using message = 'share_expiry_invalid';
  end if;
  if p_download_policy not in ('none', 'report', 'documents') then
    raise exception using message = 'share_download_policy_invalid';
  end if;
  if p_pin_hash is null and p_pin_salt is not null then
    raise exception using message = 'share_pin_invalid';
  end if;
  if p_pin_hash is not null and p_pin_salt is null then
    raise exception using message = 'share_pin_invalid';
  end if;
  if not public.eh151_unique_text_array(v_formats)
    or not (v_formats <@ array['pdf', 'csv', 'json']::text[]) then
    raise exception using message = 'share_export_formats_invalid';
  end if;
  if p_download_policy = 'none' and cardinality(v_formats) <> 0 then
    raise exception using message = 'share_export_formats_invalid';
  end if;
  if exists (
    select 1
    from unnest(v_document_ids) as ids(document_id)
    group by ids.document_id
    having count(*) > 1
  ) then
    raise exception using message = 'share_document_scope_duplicated';
  end if;

  select * into v_report
  from public.reports
  where id = p_report_id
    and profile_id = p_profile_id
  for update;
  if v_report.id is null then
    raise exception using message = 'share_report_not_found';
  end if;
  if v_report.invalidated_at is not null
    or v_report.source_scope_known is not true
    or v_report.actual_source_document_ids is null
    or cardinality(v_report.actual_source_document_ids) = 0
    or v_report.validation_status not in ('valid', 'limited')
    or v_report.validation_version <> 'eh150.v1' then
    raise exception using message = 'share_report_unavailable';
  end if;
  if exists (
    select 1
    from unnest(v_document_ids) as ids(document_id)
    where not (ids.document_id = any(v_report.actual_source_document_ids))
  ) then
    raise exception using message = 'share_document_scope_invalid';
  end if;

  for v_document_id in
    select ids.document_id
    from unnest(v_document_ids) as ids(document_id)
    order by ids.document_id
  loop
    if not exists (
      select 1
      from public.documents
      where id = v_document_id
        and profile_id = p_profile_id
        and lifecycle_state = 'active'
        and upload_state = 'complete'
    ) then
      raise exception using message = 'share_document_unavailable';
    end if;
  end loop;

  insert into public.report_share_links (
    profile_id,
    report_id,
    token_digest,
    token_key_version,
    pin_hash,
    pin_salt,
    expires_at,
    download_policy,
    allowed_export_formats
  )
  values (
    p_profile_id,
    p_report_id,
    p_token_digest,
    p_token_key_version,
    p_pin_hash,
    p_pin_salt,
    p_expires_at,
    p_download_policy,
    v_formats
  )
  returning id into v_share_id;

  insert into public.report_share_documents (share_id, document_id)
  select v_share_id, ids.document_id
  from unnest(v_document_ids) as ids(document_id);

  return query
  select v_share_id, p_expires_at, p_download_policy, v_formats;
end;
$$;

create or replace function public.read_report_share_by_digest(
  p_token_digest text
)
returns table (
  share_id uuid,
  profile_id uuid,
  report_id uuid,
  token_key_version text,
  pin_hash text,
  pin_salt text,
  expires_at timestamptz,
  revoked_at timestamptz,
  download_policy text,
  allowed_export_formats text[],
  document_ids uuid[],
  last_accessed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    links.id,
    links.profile_id,
    links.report_id,
    links.token_key_version,
    links.pin_hash,
    links.pin_salt,
    links.expires_at,
    links.revoked_at,
    links.download_policy,
    links.allowed_export_formats,
    coalesce(
      array_agg(scope.document_id order by scope.document_id)
        filter (where scope.document_id is not null),
      '{}'::uuid[]
    ),
    links.last_accessed_at
  from public.report_share_links as links
  left join public.report_share_documents as scope
    on scope.share_id = links.id
  where links.token_digest = p_token_digest
  group by
    links.id,
    links.profile_id,
    links.report_id,
    links.token_key_version,
    links.pin_hash,
    links.pin_salt,
    links.expires_at,
    links.revoked_at,
    links.download_policy,
    links.allowed_export_formats,
    links.last_accessed_at;
$$;

create or replace function public.touch_report_share_last_accessed(
  p_share_id uuid,
  p_observed_at timestamptz
)
returns table (
  share_id uuid,
  last_accessed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_observed_at timestamptz := coalesce(p_observed_at, clock_timestamp());
  v_last_accessed_at timestamptz;
begin
  if p_share_id is null then
    raise exception using message = 'share_not_found';
  end if;
  update public.report_share_links as links
  set last_accessed_at = greatest(
    coalesce(links.last_accessed_at, '-infinity'::timestamptz),
    v_observed_at
  )
  where links.id = p_share_id
  returning links.last_accessed_at into v_last_accessed_at;
  if not found then
    raise exception using message = 'share_not_found';
  end if;
  return query select p_share_id, v_last_accessed_at;
end;
$$;

create or replace function public.write_report_share_access_event(
  p_share_id uuid,
  p_occurred_at timestamptz,
  p_result text,
  p_resource_kind text,
  p_client_class text,
  p_retention_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurred_at timestamptz := coalesce(p_occurred_at, clock_timestamp());
  v_event_id uuid;
begin
  if p_share_id is null
    or p_result not in ('allowed', 'denied', 'expired', 'revoked', 'pin_required', 'pin_invalid', 'rate_limited', 'unavailable')
    or p_resource_kind not in ('page', 'report', 'export', 'document', 'pin')
    or p_client_class not in ('browser', 'automation', 'other', 'unknown')
    or p_retention_days is null
    or p_retention_days < 1
    or p_retention_days > 90 then
    raise exception using message = 'share_access_event_invalid';
  end if;

  insert into public.report_share_access_events (
    share_id,
    occurred_at,
    result,
    resource_kind,
    client_class,
    retention_expires_at
  )
  values (
    p_share_id,
    v_occurred_at,
    p_result,
    p_resource_kind,
    p_client_class,
    v_occurred_at + make_interval(days => p_retention_days)
  )
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.replace_report_share(
  p_profile_id uuid,
  p_predecessor_share_id uuid,
  p_idempotency_key text,
  p_token_digest text,
  p_token_key_version text
)
returns table (
  operation_id uuid,
  successor_share_id uuid,
  operation_status text
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

  select * into v_operation
  from public.share_replacement_operations
  where profile_id = p_profile_id
    and predecessor_share_id = p_predecessor_share_id
    and idempotency_key = p_idempotency_key;
  if v_operation.id is not null then
    return query select
      v_operation.id,
      v_operation.successor_share_id,
      v_operation.operation_status;
    return;
  end if;

  select * into v_predecessor
  from public.report_share_links
  where id = p_predecessor_share_id
    and profile_id = p_profile_id
  for update;
  if v_predecessor.id is null
    or v_predecessor.revoked_at is not null
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

  return query select v_operation.id, v_successor_id, 'committed'::text;
end;
$$;

create or replace function public.list_report_shares_for_owner(
  p_profile_id uuid,
  p_report_id uuid default null
)
returns table (
  share_id uuid,
  report_id uuid,
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
  left join public.report_share_documents as scope
    on scope.share_id = links.id
  where links.profile_id = p_profile_id
    and (p_report_id is null or links.report_id = p_report_id)
  group by
    links.id,
    links.report_id,
    links.expires_at,
    links.revoked_at,
    links.download_policy,
    links.allowed_export_formats,
    links.created_at,
    links.last_accessed_at
  order by links.created_at desc;
$$;

create or replace function public.list_report_share_access_events_for_owner(
  p_profile_id uuid,
  p_share_id uuid
)
returns table (
  event_id uuid,
  occurred_at timestamptz,
  result text,
  resource_kind text,
  client_class text
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
    events.client_class
  from public.report_share_access_events as events
  join public.report_share_links as links on links.id = events.share_id
  where links.profile_id = p_profile_id
    and events.share_id = p_share_id
  order by events.occurred_at desc, events.id desc;
$$;

create or replace function public.revoke_report_share(
  p_profile_id uuid,
  p_share_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.report_share_links
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where id = p_share_id
    and profile_id = p_profile_id;
  if not found then
    raise exception using message = 'share_not_found';
  end if;
end;
$$;

create or replace function public.create_report_share_pin_proof(
  p_share_id uuid,
  p_proof_digest text,
  p_expires_at timestamptz
)
returns table (
  proof_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof_id uuid;
begin
  if p_share_id is null
    or p_proof_digest is null
    or p_proof_digest !~ '^[0-9a-f]{64}$'
    or p_expires_at is null
    or p_expires_at <= clock_timestamp() then
    raise exception using message = 'share_pin_proof_invalid';
  end if;

  insert into public.share_pin_proofs (
    share_id,
    proof_digest,
    expires_at
  )
  values (p_share_id, p_proof_digest, p_expires_at)
  returning id into v_proof_id;

  return query select v_proof_id, p_expires_at;
end;
$$;

create or replace function public.read_report_share_pin_proof(
  p_share_id uuid,
  p_proof_digest text,
  p_now timestamptz default clock_timestamp()
)
returns table (
  proof_id uuid,
  share_id uuid,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    proofs.id,
    proofs.share_id,
    proofs.expires_at
  from public.share_pin_proofs as proofs
  where proofs.share_id = p_share_id
    and proofs.proof_digest = p_proof_digest
    and proofs.expires_at > p_now;
$$;

create or replace function public.cleanup_report_share_access_events(
  p_now timestamptz default clock_timestamp(),
  p_max_batches integer default 100
)
returns table (
  skipped boolean,
  deleted_count integer,
  remaining_expired_count bigint,
  exhausted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_batch integer := 0;
  v_remaining bigint;
  v_lock_acquired boolean;
begin
  if p_max_batches is null or p_max_batches < 1 or p_max_batches > 100 then
    raise exception using message = 'share_cleanup_batch_limit_invalid';
  end if;
  select pg_try_advisory_xact_lock(hashtextextended('eh151:share-access-events', 151))
  into v_lock_acquired;
  if not v_lock_acquired then
    return query select true, 0, 0::bigint, false;
    return;
  end if;

  for v_iteration in 1..p_max_batches loop
    delete from public.report_share_access_events
    where id in (
      select id
      from public.report_share_access_events
      where retention_expires_at <= p_now
      order by retention_expires_at, id
      limit 500
    );
    get diagnostics v_batch = row_count;
    v_deleted := v_deleted + v_batch;
    exit when v_batch = 0;
  end loop;

  select count(*) into v_remaining
  from public.report_share_access_events
  where retention_expires_at <= p_now;
  return query select false, v_deleted, v_remaining, v_remaining > 0;
end;
$$;

create or replace function public.consume_report_share_rate_limit(
  p_key_digest text,
  p_window_seconds integer,
  p_limit integer,
  p_now timestamptz default clock_timestamp()
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  store_available boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_started_at timestamptz;
  v_expires_at timestamptz;
  v_count integer;
  v_retry_after integer := 0;
begin
  if p_key_digest is null
    or p_key_digest !~ '^[0-9a-f]{64}$'
    or p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400
    or p_limit is null
    or p_limit < 1
    or p_limit > 100000 then
    raise exception using message = 'share_rate_limit_config_invalid';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_started_at + make_interval(secs => p_window_seconds);

  insert into public.share_rate_limit_buckets (
    key_digest,
    window_started_at,
    count,
    expires_at
  )
  values (p_key_digest, v_window_started_at, 1, v_expires_at)
  on conflict (key_digest, window_started_at) do update
  set count = case
      when public.share_rate_limit_buckets.expires_at <= p_now then 1
      else public.share_rate_limit_buckets.count + 1
    end,
    expires_at = case
      when public.share_rate_limit_buckets.expires_at <= p_now then excluded.expires_at
      else public.share_rate_limit_buckets.expires_at
    end
  returning share_rate_limit_buckets.count into v_count;

  if v_count > p_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_expires_at - p_now)))::integer
    );
  end if;
  return query select v_count <= p_limit, v_retry_after, true;
end;
$$;

create or replace function public.cleanup_report_share_rate_limit_buckets(
  p_now timestamptz default clock_timestamp(),
  p_max_batches integer default 20
)
returns table (
  deleted_count integer,
  remaining_expired_count bigint,
  exhausted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_batch integer := 0;
  v_remaining bigint;
begin
  if p_max_batches is null or p_max_batches < 1 or p_max_batches > 20 then
    raise exception using message = 'share_cleanup_batch_limit_invalid';
  end if;
  for v_iteration in 1..p_max_batches loop
    delete from public.share_rate_limit_buckets
    where (key_digest, window_started_at) in (
      select key_digest, window_started_at
      from public.share_rate_limit_buckets
      where expires_at <= p_now
      order by expires_at, key_digest, window_started_at
      limit 500
    );
    get diagnostics v_batch = row_count;
    v_deleted := v_deleted + v_batch;
    exit when v_batch = 0;
  end loop;
  select count(*) into v_remaining
  from public.share_rate_limit_buckets
  where expires_at <= p_now;
  return query select v_deleted, v_remaining, v_remaining > 0;
end;
$$;

create or replace function public.cleanup_report_share_pin_proofs(
  p_now timestamptz default clock_timestamp(),
  p_max_batches integer default 20
)
returns table (
  deleted_count integer,
  remaining_expired_count bigint,
  exhausted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_batch integer := 0;
  v_remaining bigint;
begin
  if p_max_batches is null or p_max_batches < 1 or p_max_batches > 20 then
    raise exception using message = 'share_cleanup_batch_limit_invalid';
  end if;
  for v_iteration in 1..p_max_batches loop
    delete from public.share_pin_proofs
    where id in (
      select id
      from public.share_pin_proofs
      where expires_at <= p_now
      order by expires_at, id
      limit 500
    );
    get diagnostics v_batch = row_count;
    v_deleted := v_deleted + v_batch;
    exit when v_batch = 0;
  end loop;
  select count(*) into v_remaining
  from public.share_pin_proofs
  where expires_at <= p_now;
  return query select v_deleted, v_remaining, v_remaining > 0;
end;
$$;

revoke all on function public.create_report_share(uuid, uuid, text, text, text, text, timestamptz, text, text[], uuid[])
  from public, anon, authenticated;
grant execute on function public.create_report_share(uuid, uuid, text, text, text, text, timestamptz, text, text[], uuid[])
  to service_role;
revoke all on function public.read_report_share_by_digest(text)
  from public, anon, authenticated;
grant execute on function public.read_report_share_by_digest(text)
  to service_role;
revoke all on function public.touch_report_share_last_accessed(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.touch_report_share_last_accessed(uuid, timestamptz)
  to service_role;
revoke all on function public.write_report_share_access_event(uuid, timestamptz, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.write_report_share_access_event(uuid, timestamptz, text, text, text, integer)
  to service_role;
revoke all on function public.create_report_share_pin_proof(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_report_share_pin_proof(uuid, text, timestamptz)
  to service_role;
revoke all on function public.read_report_share_pin_proof(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.read_report_share_pin_proof(uuid, text, timestamptz)
  to service_role;
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
revoke all on function public.revoke_report_share(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_report_share(uuid, uuid)
  to service_role;
revoke all on function public.cleanup_report_share_access_events(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_report_share_access_events(timestamptz, integer)
  to service_role;
revoke all on function public.consume_report_share_rate_limit(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_report_share_rate_limit(text, integer, integer, timestamptz)
  to service_role;
revoke all on function public.cleanup_report_share_rate_limit_buckets(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_report_share_rate_limit_buckets(timestamptz, integer)
  to service_role;
revoke all on function public.cleanup_report_share_pin_proofs(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_report_share_pin_proofs(timestamptz, integer)
  to service_role;

notify pgrst, 'reload schema';
