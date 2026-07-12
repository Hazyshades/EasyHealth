-- Append-only telemetry for the Registry 2.0 shadow rollout.

create table if not exists public.measurement_resolution_shadow_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extracted_biomarker_id uuid references public.document_extracted_biomarkers(id) on delete set null,
  event_type text not null check (event_type in ('resolution', 'manual_correction', 'promotion_rejected', 'processing_error')),
  legacy_biomarker_key text,
  measurement_definition_key text,
  resolver_result text,
  mapping_confidence_band text,
  score_impacting_difference boolean not null default false,
  promotion_rejection_reason text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists measurement_shadow_events_created_idx
  on public.measurement_resolution_shadow_events (created_at desc);
create index if not exists measurement_shadow_events_document_idx
  on public.measurement_resolution_shadow_events (document_id, extracted_biomarker_id, created_at desc);

alter table public.measurement_resolution_shadow_events enable row level security;

drop policy if exists "service_all_measurement_resolution_shadow_events" on public.measurement_resolution_shadow_events;
create policy "service_all_measurement_resolution_shadow_events"
  on public.measurement_resolution_shadow_events
  for all to service_role using (true) with check (true);
