-- Platform Tour terminal decisions are versioned independently from workflow completion.
alter table public.profiles
  add column if not exists onboarding_tour_version text not null default '1';

-- The old checklist step state is no longer part of the onboarding contract.
update public.profiles
set dashboard_preferences = dashboard_preferences - 'wizard_steps_visited'
where dashboard_preferences ? 'wizard_steps_visited';
