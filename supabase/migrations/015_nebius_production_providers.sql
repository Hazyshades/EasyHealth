-- Nebius Fast / Nebius Quality providers + AI invocation observability metadata

alter table public.profiles drop constraint if exists profiles_ai_provider_check;

alter table public.profiles
  add constraint profiles_ai_provider_check
  check (ai_provider in ('openai', 'deepseek', 'owl_alpha', 'nebius_fast', 'nebius_quality'));

create table if not exists public.ai_invocations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  stage text not null,
  provider text not null,
  model_id text not null,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  success boolean not null default true,
  error_code text,
  provider_switch boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ai_invocations_profile_created_idx
  on public.ai_invocations (profile_id, created_at desc);

create index if not exists ai_invocations_document_idx
  on public.ai_invocations (document_id);

alter table public.ai_invocations enable row level security;

create policy "service_all_ai_invocations"
  on public.ai_invocations
  for all
  to service_role
  using (true)
  with check (true);
