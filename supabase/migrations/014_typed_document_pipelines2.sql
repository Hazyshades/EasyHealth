-- Typed document pipelines phase 2: extended types, mismatch detection, instrumental observations

alter table public.documents drop constraint if exists documents_document_type_check;

alter table public.documents
  add constraint documents_document_type_check
  check (document_type in (
    'lab_result',
    'instrumental_report',
    'consultation_note',
    'discharge_summary',
    'prescription',
    'referral',
    'dicom'
  ));

alter table public.documents
  add column if not exists detected_document_type text,
  add column if not exists type_mismatch_warning boolean not null default false,
  add column if not exists type_mismatch_reason text;

alter table public.document_extracted_clinical_notes
  add column if not exists note_kind text not null default 'consultation'
    check (note_kind in ('consultation', 'discharge'));

alter table public.document_extracted_clinical_notes
  rename column documented_diagnoses to documented_problems;

alter table public.document_extracted_clinical_notes
  add column if not exists admission_date date,
  add column if not exists discharge_date date,
  add column if not exists hospital_course text,
  add column if not exists discharge_diagnoses jsonb default '[]'::jsonb,
  add column if not exists discharge_medications jsonb default '[]'::jsonb,
  add column if not exists follow_up_instructions text;

create table if not exists public.document_extracted_prescriptions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  prescriber_name text,
  prescribed_at date,
  medications jsonb not null default '[]'::jsonb,
  extraction_method text default 'llm',
  processing_version text,
  extraction_model text,
  status text not null default 'accepted'
    check (status in ('pending_review', 'needs_review', 'accepted', 'rejected', 'auto_accepted')),
  created_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists document_extracted_prescriptions_profile_id
  on public.document_extracted_prescriptions (profile_id);

create table if not exists public.document_extracted_referrals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  referring_provider text,
  referred_to_specialty text,
  referred_to_provider text,
  referral_date date,
  reason_for_referral text,
  clinical_summary text,
  urgency text,
  extraction_method text default 'llm',
  processing_version text,
  extraction_model text,
  status text not null default 'accepted'
    check (status in ('pending_review', 'needs_review', 'accepted', 'rejected', 'auto_accepted')),
  created_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists document_extracted_referrals_profile_id
  on public.document_extracted_referrals (profile_id);

alter table public.observations
  add column if not exists observation_kind text not null default 'lab'
    check (observation_kind in ('lab', 'instrumental'));

alter table public.document_extracted_prescriptions enable row level security;
alter table public.document_extracted_referrals enable row level security;

create policy "service_all_document_extracted_prescriptions"
  on public.document_extracted_prescriptions for all to service_role using (true) with check (true);

create policy "service_all_document_extracted_referrals"
  on public.document_extracted_referrals for all to service_role using (true) with check (true);
