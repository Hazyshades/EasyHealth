-- Supabase Auth identity for EasyHealth human app
-- BREAKING: resets wallet-era demo data; profiles.id aligns with auth.users.id

-- 1. Wipe demo app data (cascade from profiles)
truncate table public.profiles cascade;

-- 2. Retire wallet columns as auth keys
alter table public.profiles drop constraint if exists profiles_wallet_address_key;
alter table public.profiles alter column wallet_address drop not null;
alter table public.profiles drop column if exists wallet_address;
alter table public.profiles drop column if exists circle_wallet_id;

-- 3. Email as contact identity (unique when present)
create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null and length(trim(email)) > 0;

-- 4. Optional: purge storage objects for lab-documents (run via dashboard or script if needed)
-- Storage wipe is not pure SQL on hosted Supabase without storage schema privileges.
-- See docs/07-ops/local-dev.md for purge steps.
