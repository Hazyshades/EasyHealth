-- Per-profile AI provider preference (ChatGPT vs DeepSeek)

alter table public.profiles
  add column if not exists ai_provider text not null default 'openai'
    check (ai_provider in ('openai', 'deepseek', 'owl_alpha'));
