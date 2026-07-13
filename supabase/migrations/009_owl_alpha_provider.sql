-- Allow Owl Alpha (OpenRouter) as AI provider

alter table public.profiles drop constraint if exists profiles_ai_provider_check;

alter table public.profiles
  add constraint profiles_ai_provider_check
  check (ai_provider in ('openai', 'deepseek', 'owl_alpha'));
