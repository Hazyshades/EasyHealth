-- EH-122: durable, minimal metadata for document-scoped batch verification.
--
-- Normalization revisions and observation_change_events remain the audit truth.
-- These tables bind a caller operation id to its exact request and retain only
-- identifiers, hashes and state codes needed for idempotent replay and reversal.

create table public.batch_verification_operations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  operation_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  aggregate_status text not null check (
    aggregate_status in ('executing', 'completed', 'partially_completed', 'no_op', 'failed', 'reversed', 'partially_reversed')
  ),
  reversal_reason text,
  reversal_requested_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (profile_id, operation_id)
);

create index batch_verification_operations_document_idx
  on public.batch_verification_operations (document_id, created_at desc);

create table public.batch_verification_operation_rows (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.batch_verification_operations(id) on delete cascade,
  extracted_biomarker_id uuid not null references public.document_extracted_biomarkers(id) on delete cascade,
  expected_source_snapshot text,
  expected_active_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  prior_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  resulting_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  reversal_revision_id uuid references public.observation_normalization_revisions(id) on delete set null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  outcome_code text not null,
  reversal_outcome_code text,
  created_at timestamptz not null default now(),
  unique (operation_id, extracted_biomarker_id),
  unique (operation_id, request_hash)
);

create index batch_verification_operation_rows_resulting_revision_idx
  on public.batch_verification_operation_rows (resulting_revision_id)
  where resulting_revision_id is not null;

alter table public.batch_verification_operations enable row level security;
alter table public.batch_verification_operation_rows enable row level security;

create policy "service_all_batch_verification_operations"
  on public.batch_verification_operations
  for all to service_role using (true) with check (true);

create policy "service_all_batch_verification_operation_rows"
  on public.batch_verification_operation_rows
  for all to service_role using (true) with check (true);

revoke all on public.batch_verification_operations from public, anon, authenticated;
revoke all on public.batch_verification_operation_rows from public, anon, authenticated;
grant select, insert, update on public.batch_verification_operations to service_role;
grant select, insert, update on public.batch_verification_operation_rows to service_role;

comment on table public.batch_verification_operations is
  'EH-122 idempotency and aggregate-state metadata. Contains no raw document evidence, resolver trace or patient-entered content.';
comment on table public.batch_verification_operation_rows is
  'EH-122 row outcomes linking source/revision identifiers by an operation. Contains no raw document evidence, resolver trace or patient-entered content.';