alter table public.payment_receipts
  add column if not exists status text not null default 'settled'
  check (status in ('settled', 'consumed', 'failed'));

create table if not exists public.payment_entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  receipt_id uuid not null references public.payment_receipts(id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'redeemed', 'expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_entitlements_profile_endpoint_status
  on public.payment_entitlements (profile_id, endpoint, status);

alter table public.payment_entitlements enable row level security;

create policy "service_all_entitlements" on public.payment_entitlements
  for all to service_role using (true) with check (true);
