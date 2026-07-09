-- Lab unit display preference: US conventional vs SI (display-only conversion)

alter table public.profiles
  add column if not exists lab_unit_system text not null default 'si';

alter table public.profiles
  drop constraint if exists profiles_lab_unit_system_check;

alter table public.profiles
  add constraint profiles_lab_unit_system_check
  check (lab_unit_system in ('us', 'si'));

comment on column public.profiles.lab_unit_system is
  'Preferred lab unit presentation: us (conventional) or si. Does not rewrite stored observations.';
