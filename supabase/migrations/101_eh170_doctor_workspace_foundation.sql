-- EH-170: clinician workspace entities and private consultation artifacts.
-- Patient ownership remains public.profiles.id, aligned with auth.users.id.

create or replace function public.eh170_unique_text_array(p_values text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select cardinality(coalesce(p_values, '{}'::text[])) = cardinality(
    array(
      select distinct value
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    )
  );
$$;

revoke all on function public.eh170_unique_text_array(text[])
  from public, anon, authenticated, service_role;


grant execute on function public.eh170_unique_text_array(text[])
  to postgres;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  clinician_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'clinician'
    check (role in ('owner', 'admin', 'clinician')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, clinician_profile_id),
  check (accepted_at is null or accepted_at >= invited_at),
  check (revoked_at is null or revoked_at >= invited_at),
  check (status <> 'active' or accepted_at is not null),
  check (status <> 'revoked' or revoked_at is not null)
);

create table if not exists public.patient_access_grants (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_profile_id uuid not null references public.profiles(id) on delete cascade,
  clinician_profile_id uuid not null references public.profiles(id) on delete cascade,
  scopes text[] not null default array['health_profile']::text[],
  requested_scopes text[] not null default array['health_profile']::text[],
  state text not null default 'pending'
    check (state in ('pending', 'active', 'expired', 'revoked', 'declined')),
  issued_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (cardinality(scopes) > 0),
  check (public.eh170_unique_text_array(scopes)),
  check (scopes <@ array['health_profile', 'observations', 'reports', 'documents', 'consultations']::text[]),
  check (cardinality(requested_scopes) > 0),
  check (public.eh170_unique_text_array(requested_scopes)),
  check (requested_scopes <@ array['health_profile', 'observations', 'reports', 'documents', 'consultations']::text[]),
  check (scopes <@ requested_scopes),
  check (approved_at is null or approved_at >= created_at),
  check (expires_at is null or expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (state <> 'active' or approved_at is not null),
  check (state <> 'revoked' or revoked_at is not null),
  check (state <> 'expired' or expires_at is not null)
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_profile_id uuid not null references public.profiles(id) on delete cascade,
  clinician_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'reviewed', 'closed', 'cancelled')),
  title text not null default 'Consultation'
    check (length(btrim(title)) between 1 and 240),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  check (ended_at is null or started_at is null or ended_at >= started_at),
  check (closed_at is null or closed_at >= created_at),
  check (status <> 'closed' or closed_at is not null)
);

create table if not exists public.consultation_sources (
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  source_kind text not null
    check (source_kind in ('observation', 'document', 'report', 'consultation_note')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (consultation_id, source_kind, source_id)
);

create table if not exists public.consultation_recording_consents (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_profile_id uuid not null references public.profiles(id) on delete cascade,
  clinician_profile_id uuid not null references public.profiles(id) on delete restrict,
  state text not null default 'active'
    check (state in ('active', 'revoked', 'expired')),
  purpose text not null default 'consultation_recording'
    check (purpose = 'consultation_recording'),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > granted_at),
  check (revoked_at is null or revoked_at >= granted_at),
  check (state <> 'revoked' or revoked_at is not null),
  check (state <> 'expired' or expires_at is not null)
);

create table if not exists public.recording_sessions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_profile_id uuid not null references public.profiles(id) on delete cascade,
  clinician_profile_id uuid not null references public.profiles(id) on delete restrict,
  consent_id uuid not null references public.consultation_recording_consents(id) on delete restrict,
  status text not null default 'consent_checked'
    check (status in (
      'consent_checked',
      'recording',
      'uploading',
      'uploaded',
      'transcribing',
      'transcript_ready',
      'note_draft',
      'clinician_reviewed',
      'completed',
      'cancelled',
      'failed',
      'deleted'
    )),
  storage_path text,
  source_language text,
  failure_code text,
  source_audio_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  uploaded_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (storage_path is null or length(btrim(storage_path)) between 1 and 512),
  check (source_audio_deleted_at is null or source_audio_deleted_at >= created_at),
  check (status not in ('uploaded', 'transcribing', 'transcript_ready', 'note_draft', 'clinician_reviewed', 'completed') or storage_path is not null),
  check (status <> 'failed' or failure_code is not null),
  check (status <> 'completed' or completed_at is not null)
);

create table if not exists public.transcript_drafts (
  id uuid primary key default gen_random_uuid(),
  recording_session_id uuid not null unique references public.recording_sessions(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed', 'deleted')),
  transcript_text text,
  source_language text,
  provider text,
  model text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'ready' or transcript_text is not null),
  check (status <> 'failed' or failure_code is not null)
);

create table if not exists public.consultation_note_revisions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_profile_id uuid not null references public.profiles(id) on delete cascade,
  recording_session_id uuid references public.recording_sessions(id) on delete set null,
  transcript_draft_id uuid references public.transcript_drafts(id) on delete set null,
  revision_number integer not null check (revision_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'superseded', 'deleted')),
  content jsonb not null default '{}'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  authored_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (consultation_id, revision_number),
  check (status <> 'reviewed' or (reviewed_by_profile_id is not null and reviewed_at is not null)),
  check (reviewed_at is null or reviewed_at >= created_at),
  check (jsonb_typeof(content) = 'object'),
  check (jsonb_typeof(source_references) = 'array')
);

create table if not exists public.clinical_access_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  patient_profile_id uuid references public.profiles(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  grant_id uuid references public.patient_access_grants(id) on delete set null,
  resource_kind text not null
    check (resource_kind in (
      'clinic',
      'patient_profile',
      'health_profile',
      'observation',
      'document',
      'report',
      'consultation',
      'recording',
      'transcript',
      'note',
      'grant',
      'consent'
    )),
  operation text not null
    check (operation in ('read', 'create', 'update', 'review', 'export', 'approve', 'revoke', 'expire', 'delete')),
  result text not null
    check (result in ('allowed', 'denied', 'expired', 'revoked', 'unavailable')),
  scope text
    check (scope is null or scope in ('health_profile', 'observations', 'reports', 'documents', 'consultations')),
  occurred_at timestamptz not null default now(),
  retention_expires_at timestamptz
);

create index if not exists clinic_memberships_clinician_idx
  on public.clinic_memberships (clinician_profile_id, status, clinic_id);
create index if not exists patient_access_grants_patient_idx
  on public.patient_access_grants (patient_profile_id, state, expires_at);
create index if not exists patient_access_grants_clinician_idx
  on public.patient_access_grants (clinician_profile_id, state, expires_at);
create index if not exists patient_access_grants_clinic_idx
  on public.patient_access_grants (clinic_id, patient_profile_id, clinician_profile_id);
create unique index if not exists patient_access_grants_active_unique
  on public.patient_access_grants (clinic_id, patient_profile_id, clinician_profile_id)
  where state in ('pending', 'active');
create index if not exists consultations_patient_idx
  on public.consultations (patient_profile_id, created_at desc);
create index if not exists consultations_clinician_idx
  on public.consultations (clinician_profile_id, status, created_at desc);
create index if not exists consultation_sources_source_idx
  on public.consultation_sources (source_kind, source_id);
create index if not exists recording_sessions_patient_idx
  on public.recording_sessions (patient_profile_id, created_at desc);
create index if not exists recording_sessions_status_idx
  on public.recording_sessions (status, updated_at);
create index if not exists transcript_drafts_consultation_idx
  on public.transcript_drafts (consultation_id, created_at desc);
create index if not exists consultation_note_revisions_patient_idx
  on public.consultation_note_revisions (patient_profile_id, consultation_id, revision_number desc);
create index if not exists clinical_access_events_patient_idx
  on public.clinical_access_events (patient_profile_id, occurred_at desc);
create index if not exists clinical_access_events_retention_idx
  on public.clinical_access_events (retention_expires_at, occurred_at);

alter table public.clinics enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.patient_access_grants enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_sources enable row level security;
alter table public.consultation_recording_consents enable row level security;
alter table public.recording_sessions enable row level security;
alter table public.transcript_drafts enable row level security;
alter table public.consultation_note_revisions enable row level security;
alter table public.clinical_access_events enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doctor-recordings',
  'doctor-recordings',
  false,
  52428800,
  array[
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/webm'
  ]
)
on conflict (id) do nothing;

create policy "service_role_doctor_recordings_all"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'doctor-recordings')
  with check (bucket_id = 'doctor-recordings');

notify pgrst, 'reload schema';
