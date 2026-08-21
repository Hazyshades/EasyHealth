-- EH-163 follow-up: durable, privacy-safe regional Mistral model readiness evidence.
-- This table is worker-global (not document/profile scoped) and stores no provider
-- response, API key, document content, or patient identifier.

create table if not exists public.ai_provider_model_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'mistral'),
  region text not null check (region in ('eu', 'us')),
  requested_model text not null
    check (length(btrim(requested_model)) between 1 and 200),
  model_present boolean not null,
  success boolean not null,
  error_code text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  worker_instance_id text not null
    check (length(btrim(worker_instance_id)) between 1 and 200),
  adapter_version text not null
    check (length(btrim(adapter_version)) between 1 and 80),
  checked_at timestamptz not null default now(),
  constraint ai_provider_model_checks_result_check check (
    (success and model_present and error_code is null)
    or (
      not success
      and not model_present
      and error_code in (
        'ocr_provider_unavailable',
        'ocr_timeout',
        'ocr_input_rejected'
      )
    )
  )
);

create index if not exists ai_provider_model_checks_lookup_idx
  on public.ai_provider_model_checks (provider, region, checked_at desc);

comment on table public.ai_provider_model_checks is
  'EH-163 append-only, service-only regional Mistral models.list readiness evidence. Never stores raw catalogs, secrets, documents, or patient data.';
comment on column public.ai_provider_model_checks.model_present is
  'Whether the configured requested_model ID or alias was present in the regional models.list response.';
comment on column public.ai_provider_model_checks.error_code is
  'Stable privacy-safe provider code only; raw SDK/network error text is prohibited.';

alter table public.ai_provider_model_checks enable row level security;

revoke all on public.ai_provider_model_checks from public, anon, authenticated;
grant select, insert on public.ai_provider_model_checks to service_role;

drop policy if exists "service_select_ai_provider_model_checks"
  on public.ai_provider_model_checks;
create policy "service_select_ai_provider_model_checks"
  on public.ai_provider_model_checks
  for select
  to service_role
  using (true);

drop policy if exists "service_insert_ai_provider_model_checks"
  on public.ai_provider_model_checks;
create policy "service_insert_ai_provider_model_checks"
  on public.ai_provider_model_checks
  for insert
  to service_role
  with check (true);

create or replace function public.reject_ai_provider_model_check_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception using message = 'ai_provider_model_checks_append_only';
end;
$$;

revoke all on function public.reject_ai_provider_model_check_mutation() from public, anon, authenticated;
grant execute on function public.reject_ai_provider_model_check_mutation() to service_role;

drop trigger if exists ai_provider_model_checks_append_only
  on public.ai_provider_model_checks;
create trigger ai_provider_model_checks_append_only
before update or delete on public.ai_provider_model_checks
for each row
execute function public.reject_ai_provider_model_check_mutation();
