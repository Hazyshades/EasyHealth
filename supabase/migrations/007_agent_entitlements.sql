alter table public.payment_entitlements
  alter column profile_id drop not null;

alter table public.payment_entitlements
  add column if not exists payer text;

create index if not exists payment_entitlements_payer_endpoint_status
  on public.payment_entitlements (payer, endpoint, status);
