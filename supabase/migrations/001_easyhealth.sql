-- EasyHealth hackathon MVP schema

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  circle_wallet_id text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  error_message text,
  lab_name text,
  observed_at date,
  created_at timestamptz not null default now()
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  biomarker_key text not null,
  name text not null,
  value numeric not null,
  unit text not null,
  ref_low numeric,
  ref_high numeric,
  observed_at date not null,
  created_at timestamptz not null default now(),
  unique (profile_id, biomarker_key, observed_at)
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  endpoint text not null,
  payer text,
  amount_usdc text not null,
  network text not null,
  gateway_tx text,
  created_at timestamptz not null default now()
);

create index observations_profile_key_date on public.observations (profile_id, biomarker_key, observed_at);
create index documents_profile_id on public.documents (profile_id);

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.observations enable row level security;
alter table public.payment_receipts enable row level security;

-- Service role bypasses RLS; app uses service role on server routes after session check
create policy "service_all_profiles" on public.profiles for all to service_role using (true) with check (true);
create policy "service_all_documents" on public.documents for all to service_role using (true) with check (true);
create policy "service_all_observations" on public.observations for all to service_role using (true) with check (true);
create policy "service_all_receipts" on public.payment_receipts for all to service_role using (true) with check (true);

-- Storage bucket (create via dashboard or API): lab-documents, private
