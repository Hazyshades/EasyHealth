-- Profile onboarding: name, consent, wizard state, dashboard preferences

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists health_data_consent_at timestamptz,
  add column if not exists ai_consent_at timestamptz,
  add column if not exists consent_preferences jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_dismissed_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists dashboard_preferences jsonb not null default '{}'::jsonb;

-- Existing users: backfill first_name from display_name so they skip the profile gate
update public.profiles
set first_name = display_name
where first_name is null
  and display_name is not null
  and trim(display_name) <> '';
