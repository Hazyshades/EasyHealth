-- Persisted health reports (Phase 1)

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  report_type text not null
    check (report_type in ('general_practice', 'cardiology', 'endocrinology')),
  detail_level text not null
    check (detail_level in ('compact', 'standard', 'detailed', 'full')),
  document_ids uuid[] null,
  content jsonb not null,
  summary_preview text not null,
  created_at timestamptz not null default now()
);

create index reports_profile_created on public.reports (profile_id, created_at desc);

alter table public.reports enable row level security;

create policy "service_all_reports" on public.reports for all to service_role using (true) with check (true);
