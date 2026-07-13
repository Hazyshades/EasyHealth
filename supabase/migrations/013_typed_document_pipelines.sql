-- Typed document pipelines: rename document_type values, file_kind, structured extractions, synthesis cache

-- Drop legacy check BEFORE renaming values (old constraint only allows lab/imaging/consultation/dicom)
alter table public.documents drop constraint if exists documents_document_type_check;

-- Migrate existing document_type values
update public.documents set document_type = 'lab_result' where document_type = 'lab';
update public.documents set document_type = 'instrumental_report' where document_type = 'imaging';
update public.documents set document_type = 'consultation_note' where document_type = 'consultation';

alter table public.documents
  add constraint documents_document_type_check
  check (document_type in ('lab_result', 'instrumental_report', 'consultation_note', 'dicom'));

alter table public.documents
  alter column document_type set default 'lab_result';

alter table public.documents
  add column if not exists file_kind text not null default 'unknown'
    check (file_kind in ('pdf', 'image', 'unknown')),
  add column if not exists document_summary text,
  add column if not exists modality text,
  add column if not exists document_subtype text;

create table if not exists public.document_extracted_findings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  modality text,
  body_region text,
  finding_text text not null,
  impression text,
  source_page int,
  source_text text,
  confidence numeric,
  extraction_method text default 'llm',
  processing_version text,
  extraction_model text,
  status text not null default 'accepted'
    check (status in ('pending_review', 'needs_review', 'accepted', 'rejected', 'auto_accepted')),
  created_at timestamptz not null default now()
);

create index if not exists document_extracted_findings_document_id
  on public.document_extracted_findings (document_id);

create table if not exists public.document_extracted_clinical_notes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider_name text,
  visit_date date,
  chief_complaint text,
  history_summary text,
  exam_findings text,
  documented_diagnoses jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  follow_up_plan text,
  extraction_method text default 'llm',
  processing_version text,
  extraction_model text,
  status text not null default 'accepted'
    check (status in ('pending_review', 'needs_review', 'accepted', 'rejected', 'auto_accepted')),
  created_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists document_extracted_clinical_notes_profile_id
  on public.document_extracted_clinical_notes (profile_id);

create table if not exists public.profile_health_synthesis (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  synthesis_text text not null,
  source_document_ids uuid[] not null default '{}',
  input_hash text not null,
  model text,
  generated_at timestamptz not null default now()
);

alter table public.document_extracted_findings enable row level security;
alter table public.document_extracted_clinical_notes enable row level security;
alter table public.profile_health_synthesis enable row level security;

create policy "service_all_document_extracted_findings"
  on public.document_extracted_findings for all to service_role using (true) with check (true);

create policy "service_all_document_extracted_clinical_notes"
  on public.document_extracted_clinical_notes for all to service_role using (true) with check (true);

create policy "service_all_profile_health_synthesis"
  on public.profile_health_synthesis for all to service_role using (true) with check (true);
