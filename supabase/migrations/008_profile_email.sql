-- Google / Circle social login email for menu label fallback

alter table public.profiles
  add column if not exists email text;
