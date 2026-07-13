-- Document intelligence pipeline: processing metadata, pages, jobs, extracted biomarkers

alter table public.documents
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists original_storage_path text,
  add column if not exists normalized_storage_path text,
  add column if not exists thumbnail_storage_path text,
  add column if not exists page_count int,
  add column if not exists processing_status text,
  add column if not exists processing_error text,
  add column if not exists ocr_status text default 'pending',
  add column if not exists extraction_status text default 'pending',
  add column if not exists processing_version text,
  add column if not exists extraction_model text,
  add column if not exists processed_at timestamptz;

-- Backfill original_storage_path from legacy storage_path
update public.documents
set original_storage_path = storage_path
where original_storage_path is null and storage_path is not null;

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  page_number int not null,
  width int,
  height int,
  preview_storage_path text not null,
  ocr_text text,
  ocr_json_storage_path text,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create index if not exists document_pages_document_id on public.document_pages (document_id);

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists document_processing_jobs_status on public.document_processing_jobs (status, created_at);

create table if not exists public.document_extracted_biomarkers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  biomarker_key text,
  biomarker_name text not null,
  raw_name text,
  value_numeric numeric,
  value_text text,
  unit text,
  reference_range text,
  collected_at date,
  reported_at date,
  source_page int,
  source_text text,
  bounding_box jsonb,
  confidence numeric,
  extraction_method text,
  processing_version text,
  extraction_model text,
  status text not null default 'needs_review'
    check (status in ('pending_review', 'needs_review', 'accepted', 'rejected', 'auto_accepted')),
  created_at timestamptz not null default now()
);

create index if not exists document_extracted_biomarkers_document_id
  on public.document_extracted_biomarkers (document_id);

alter table public.observations
  add column if not exists source_extracted_biomarker_id uuid
    references public.document_extracted_biomarkers(id) on delete set null;

alter table public.document_pages enable row level security;
alter table public.document_processing_jobs enable row level security;
alter table public.document_extracted_biomarkers enable row level security;

create policy "service_all_document_pages" on public.document_pages for all to service_role using (true) with check (true);
create policy "service_all_document_processing_jobs" on public.document_processing_jobs for all to service_role using (true) with check (true);
create policy "service_all_document_extracted_biomarkers" on public.document_extracted_biomarkers for all to service_role using (true) with check (true);
