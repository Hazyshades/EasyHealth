-- EH-160: explicit closed-beta access, revocation, and synthetic sample-data markers.

alter table public.profiles
  add column if not exists closed_beta_enabled boolean not null default false,
  add column if not exists closed_beta_enabled_at timestamptz,
  add column if not exists closed_beta_revoked_at timestamptz,
  add column if not exists beta_sample_data_seeded_at timestamptz;

create index if not exists profiles_closed_beta_enabled_idx
  on public.profiles (closed_beta_enabled)
  where closed_beta_enabled = true;

comment on column public.profiles.closed_beta_enabled is
  'Explicit allowlist flag for the closed-beta assistant surface.';
comment on column public.profiles.beta_sample_data_seeded_at is
  'Timestamp for clearly synthetic beta examples; never a health record.';
