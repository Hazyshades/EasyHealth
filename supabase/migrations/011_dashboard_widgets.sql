-- Dashboard widget catalog and data tables for wellness widgets

create table public.dashboard_widget_catalog (
  id text primary key,
  title text not null,
  description text,
  status text not null default 'coming_soon' check (status in ('live', 'coming_soon')),
  sort_order int not null,
  created_at timestamptz not null default now()
);

insert into public.dashboard_widget_catalog (id, title, description, status, sort_order) values
  ('health_assessment', 'Health assessment', 'Upload lab records to see your health profile score.', 'live', 1),
  ('upload_lab', 'Upload lab', 'Upload a lab PDF or image to extract biomarkers.', 'live', 2),
  ('health_reports', 'Health reports', 'Generate educational health reports from your records.', 'live', 3),
  ('medications', 'Medications', 'Track medications and reminders.', 'coming_soon', 4),
  ('water_balance', 'Water balance', 'Track daily water intake.', 'coming_soon', 5),
  ('weight_trend', 'Weight trend', 'Log weight and view trends over time.', 'coming_soon', 6);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
  recorded_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index weight_entries_profile_recorded on public.weight_entries (profile_id, recorded_at desc);

create table public.water_intake_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml int not null check (amount_ml > 0 and amount_ml <= 10000),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index water_intake_logs_profile_logged on public.water_intake_logs (profile_id, logged_at desc);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  dosage text,
  schedule text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medications_profile_id on public.medications (profile_id);

alter table public.dashboard_widget_catalog enable row level security;
alter table public.weight_entries enable row level security;
alter table public.water_intake_logs enable row level security;
alter table public.medications enable row level security;

create policy "service_all_dashboard_widget_catalog" on public.dashboard_widget_catalog for all to service_role using (true) with check (true);
create policy "service_all_weight_entries" on public.weight_entries for all to service_role using (true) with check (true);
create policy "service_all_water_intake_logs" on public.water_intake_logs for all to service_role using (true) with check (true);
create policy "service_all_medications" on public.medications for all to service_role using (true) with check (true);
