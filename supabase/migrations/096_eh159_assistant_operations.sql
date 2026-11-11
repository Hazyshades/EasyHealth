-- EH-159: assistant quota reservation, privacy-safe observability, and feedback.

alter table public.ai_invocations
  add column if not exists request_id uuid;

create index if not exists ai_invocations_request_id_idx
  on public.ai_invocations (request_id, created_at desc);

create table if not exists public.assistant_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('personal_facts', 'grounded_summary', 'general_education', 'refusal')),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  provider text,
  model_id text,
  input_tokens integer,
  output_tokens integer,
  reserved_cost_usd numeric(12,8) not null default 0.10000000,
  estimated_cost_usd numeric(12,8),
  latency_ms integer,
  structured_source_count integer not null default 0,
  semantic_source_count integer not null default 0,
  limitation_codes text[] not null default '{}'::text[],
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists assistant_request_events_profile_created_idx
  on public.assistant_request_events (profile_id, created_at desc);
create index if not exists assistant_request_events_profile_status_idx
  on public.assistant_request_events (profile_id, status, created_at desc);

create table if not exists public.assistant_feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.assistant_request_events(request_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating text not null check (rating in ('positive', 'negative')),
  category text check (category in ('answer_quality', 'missing_evidence', 'safety', 'latency', 'other')),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (request_id, profile_id)
);

alter table public.assistant_request_events enable row level security;
alter table public.assistant_feedback enable row level security;

revoke all on table public.assistant_request_events from public, anon, authenticated;
revoke all on table public.assistant_feedback from public, anon, authenticated;
grant all on table public.assistant_request_events to service_role;
grant all on table public.assistant_feedback to service_role;

create or replace function public.reserve_assistant_request(
  p_profile_id uuid,
  p_request_id uuid,
  p_mode text,
  p_daily_limit integer default 20,
  p_monthly_cost_limit numeric default 5.00000000,
  p_reserved_cost numeric default 0.10000000
)
returns table (
  allowed boolean,
  request_id uuid,
  daily_remaining integer,
  monthly_cost_remaining numeric,
  reset_at timestamptz,
  denial_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_count integer;
  v_monthly_cost numeric;
  v_daily_reset timestamptz := date_trunc('day', now()) + interval '1 day';
  v_monthly_reset timestamptz := date_trunc('month', now()) + interval '1 month';
  v_remaining numeric;
begin
  if p_profile_id is null or p_request_id is null then
    raise exception using message = 'assistant_quota_request_invalid';
  end if;
  if p_mode not in ('personal_facts', 'grounded_summary', 'general_education', 'refusal') then
    raise exception using message = 'assistant_quota_mode_invalid';
  end if;
  if p_daily_limit < 1 or p_monthly_cost_limit <= 0 or p_reserved_cost <= 0 then
    raise exception using message = 'assistant_quota_policy_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 159));

  select count(*)::integer
    into v_daily_count
  from public.assistant_request_events
  where profile_id = p_profile_id
    and created_at >= date_trunc('day', now())
    and status in ('reserved', 'completed');

  select coalesce(sum(coalesce(estimated_cost_usd, reserved_cost_usd)), 0)::numeric
    into v_monthly_cost
  from public.assistant_request_events
  where profile_id = p_profile_id
    and created_at >= date_trunc('month', now())
    and status in ('reserved', 'completed');

  if v_daily_count >= p_daily_limit then
    return query select false, p_request_id, 0, greatest(p_monthly_cost_limit - v_monthly_cost, 0), v_daily_reset, 'assistant_quota_daily_exceeded';
    return;
  end if;

  if v_monthly_cost + p_reserved_cost > p_monthly_cost_limit then
    v_remaining := greatest(p_monthly_cost_limit - v_monthly_cost, 0);
    return query select false, p_request_id, greatest(p_daily_limit - v_daily_count, 0), v_remaining, v_monthly_reset, 'assistant_quota_cost_exceeded';
    return;
  end if;

  insert into public.assistant_request_events (
    request_id,
    profile_id,
    mode,
    reserved_cost_usd
  ) values (
    p_request_id,
    p_profile_id,
    p_mode,
    p_reserved_cost
  );

  return query
  select
    true,
    p_request_id,
    greatest(p_daily_limit - v_daily_count - 1, 0),
    greatest(p_monthly_cost_limit - v_monthly_cost - p_reserved_cost, 0),
    least(v_daily_reset, v_monthly_reset),
    null::text;
end;
$$;

create or replace function public.complete_assistant_request(
  p_request_id uuid,
  p_status text,
  p_provider text,
  p_model_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric,
  p_latency_ms integer,
  p_structured_source_count integer,
  p_semantic_source_count integer,
  p_limitation_codes text[],
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('completed', 'failed') then
    raise exception using message = 'assistant_event_status_invalid';
  end if;

  update public.assistant_request_events
  set status = p_status,
      provider = p_provider,
      model_id = p_model_id,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      estimated_cost_usd = p_estimated_cost_usd,
      latency_ms = p_latency_ms,
      structured_source_count = greatest(coalesce(p_structured_source_count, 0), 0),
      semantic_source_count = greatest(coalesce(p_semantic_source_count, 0), 0),
      limitation_codes = coalesce(p_limitation_codes, '{}'::text[]),
      error_code = p_error_code,
      completed_at = now()
  where request_id = p_request_id;

  if not found then
    raise exception using message = 'assistant_event_not_found';
  end if;
end;
$$;

create or replace function public.record_assistant_feedback(
  p_profile_id uuid,
  p_request_id uuid,
  p_rating text,
  p_category text,
  p_comment text
)
returns public.assistant_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feedback public.assistant_feedback;
begin
  if p_rating not in ('positive', 'negative') then
    raise exception using message = 'assistant_feedback_rating_invalid';
  end if;
  if p_category is not null and p_category not in ('answer_quality', 'missing_evidence', 'safety', 'latency', 'other') then
    raise exception using message = 'assistant_feedback_category_invalid';
  end if;
  if not exists (
    select 1
    from public.assistant_request_events
    where request_id = p_request_id
      and profile_id = p_profile_id
  ) then
    raise exception using message = 'assistant_feedback_request_not_found';
  end if;

  insert into public.assistant_feedback (profile_id, request_id, rating, category, comment)
  values (p_profile_id, p_request_id, p_rating, p_category, nullif(btrim(p_comment), ''))
  on conflict (request_id, profile_id)
  do update set rating = excluded.rating,
                category = excluded.category,
                comment = excluded.comment,
                created_at = now()
  returning * into v_feedback;

  return v_feedback;
end;
$$;

revoke all on function public.reserve_assistant_request(uuid, uuid, text, integer, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.complete_assistant_request(uuid, text, text, text, integer, integer, numeric, integer, integer, integer, text[], text)
  from public, anon, authenticated;
revoke all on function public.record_assistant_feedback(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_assistant_request(uuid, uuid, text, integer, numeric, numeric) to service_role;
grant execute on function public.complete_assistant_request(uuid, text, text, text, integer, integer, numeric, integer, integer, integer, text[], text) to service_role;
grant execute on function public.record_assistant_feedback(uuid, uuid, text, text, text) to service_role;

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
      'llm_provider_unavailable',
      'assistant_quota_daily_exceeded',
      'assistant_quota_cost_exceeded',
      'assistant_provider_unavailable',
      'assistant_invalid_response',
      'assistant_unsafe_request',
      'assistant_source_unavailable',
      'assistant_embedding_provider_unavailable',
      'assistant_reindex_failed',
      'assistant_reindex_source_stale',
      'assistant_embedding_count_mismatch',
      'assistant_feedback_invalid'
    )
  );

notify pgrst, 'reload schema';
