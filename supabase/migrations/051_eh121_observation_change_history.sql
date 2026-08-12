-- EH-121: append-only observation change history.
--
-- Three append-only stores already hold every auditable change to an
-- observation: `observation_normalization_revisions` (acceptance, correction,
-- reversal, verification), `document_extracted_biomarkers.is_current` /
-- `superseded_at` (reprocessing retired the source row), and
-- `registry_reprocess_batch_rows` (an applied registry reprocess diff). They
-- disagree on shape, key and ordering, and none of them is readable as a
-- timeline.
--
-- This migration materializes one canonical ledger over those stores. It is
-- populated exclusively by database triggers, so no application write path can
-- bypass the audit and no second observation writer is introduced. The ledger
-- carries identifiers, enumerated state, 64-hex evidence hashes, version
-- strings and the operator-authored correction reason. It never carries raw
-- labels, raw values, reference text, source text, bounding boxes or a copy of
-- `resolver_decision_trace` — a reader that needs the trace follows
-- `source_revision_id`.

-- ── 1. Enums ─────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'observation_change_event_kind') then
    create type public.observation_change_event_kind as enum (
      'observation_accepted',
      'mapping_corrected',
      'correction_reverted',
      'verification_changed',
      'extraction_superseded',
      'reprocess_applied'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'observation_change_event_origin') then
    create type public.observation_change_event_origin as enum ('capture', 'backfill');
  end if;
end;
$$;

-- ── 2. Ledger ────────────────────────────────────────────────────────────────

create table if not exists public.observation_change_events (
  id uuid primary key default gen_random_uuid(),
  event_kind public.observation_change_event_kind not null,
  origin public.observation_change_event_origin not null default 'capture',

  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  -- `observation_id`, `source_reprocess_row_id` and `actor_id` are deliberate
  -- weak references. A foreign key with `on delete set null` would UPDATE an
  -- audit row when the referenced row disappears, and audit rows are never
  -- updated. Observations are deleted by the worker on reprocess and reprocess
  -- batches are disposable, so the audit must outlive both.
  observation_id uuid,
  extracted_biomarker_id uuid
    references public.document_extracted_biomarkers(id) on delete cascade,

  source_revision_id uuid
    references public.observation_normalization_revisions(id) on delete cascade,
  source_prior_revision_id uuid
    references public.observation_normalization_revisions(id) on delete cascade,
  source_reprocess_row_id uuid,

  actor_type text not null default 'system',
  actor_id uuid,
  correction_reason text,

  prior_measurement_definition_key text,
  prior_analyte_key text,
  prior_resolver_result text,
  prior_verification_status text,
  prior_mapping_confidence_band text,
  prior_input_evidence_hash text,

  next_measurement_definition_key text,
  next_analyte_key text,
  next_resolver_result text,
  next_verification_status text,
  next_mapping_confidence_band text,
  next_input_evidence_hash text,
  next_mapping_change_classification text,

  catalog_manifest_version text,
  catalog_manifest_digest text,
  resolver_version text,
  normalization_version text,
  extraction_version text,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint observation_change_events_actor_type_check
    check (actor_type in ('user', 'system')),
  constraint observation_change_events_system_actor_check
    check (actor_type = 'user' or actor_id is null),
  constraint observation_change_events_user_actor_check
    check (actor_type = 'system' or actor_id is not null),
  constraint observation_change_events_prior_resolver_result_check
    check (prior_resolver_result is null
      or prior_resolver_result in ('resolved', 'ambiguous', 'partial', 'unmapped')),
  constraint observation_change_events_next_resolver_result_check
    check (next_resolver_result is null
      or next_resolver_result in ('resolved', 'ambiguous', 'partial', 'unmapped')),
  constraint observation_change_events_prior_verification_status_check
    check (prior_verification_status is null
      or prior_verification_status in ('pending', 'auto_verified', 'user_verified', 'manually_corrected')),
  constraint observation_change_events_next_verification_status_check
    check (next_verification_status is null
      or next_verification_status in ('pending', 'auto_verified', 'user_verified', 'manually_corrected')),
  constraint observation_change_events_prior_confidence_band_check
    check (prior_mapping_confidence_band is null
      or prior_mapping_confidence_band in ('high', 'medium', 'low')),
  constraint observation_change_events_next_confidence_band_check
    check (next_mapping_confidence_band is null
      or next_mapping_confidence_band in ('high', 'medium', 'low')),
  constraint observation_change_events_prior_evidence_hash_check
    check (prior_input_evidence_hash is null or prior_input_evidence_hash ~ '^[0-9a-f]{64}$'),
  constraint observation_change_events_next_evidence_hash_check
    check (next_input_evidence_hash is null or next_input_evidence_hash ~ '^[0-9a-f]{64}$'),
  constraint observation_change_events_subject_check
    check (extracted_biomarker_id is not null or observation_id is not null)
);

-- Idempotent capture: one event per source fact, whichever trigger path fires.
create unique index if not exists observation_change_events_revision_unique
  on public.observation_change_events (source_revision_id)
  where source_revision_id is not null;

create unique index if not exists observation_change_events_supersession_unique
  on public.observation_change_events (extracted_biomarker_id)
  where event_kind = 'extraction_superseded';

create unique index if not exists observation_change_events_reprocess_row_unique
  on public.observation_change_events (source_reprocess_row_id)
  where source_reprocess_row_id is not null;

create index if not exists observation_change_events_document_idx
  on public.observation_change_events (document_id, occurred_at desc, created_at desc);

create index if not exists observation_change_events_observation_idx
  on public.observation_change_events (observation_id, occurred_at desc)
  where observation_id is not null;

create index if not exists observation_change_events_extracted_idx
  on public.observation_change_events (extracted_biomarker_id, occurred_at desc)
  where extracted_biomarker_id is not null;

alter table public.observation_change_events enable row level security;

drop policy if exists "service_all_observation_change_events"
  on public.observation_change_events;
create policy "service_all_observation_change_events"
  on public.observation_change_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.observation_change_events from public, anon, authenticated;
grant select, insert on public.observation_change_events to service_role;

comment on table public.observation_change_events is
  'EH-121 append-only observation change history. Written only by capture triggers on observation_normalization_revisions, document_extracted_biomarkers and registry_reprocess_batch_rows. Contains identifiers, enum state, 64-hex evidence hashes, version strings and operator-authored correction reasons; never raw document text and never a copy of resolver_decision_trace.';

-- ── 3. Append-only guard ─────────────────────────────────────────────────────

create or replace function public.eh121_reject_observation_change_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    raise exception using message = 'observation_change_events_append_only';
  end if;

  -- DELETE is allowed only where the subject itself is being erased: the
  -- controlled EH-104 lineage purge, or a cascade from deleting the document
  -- or the profile. Both parents are already gone by the time their cascade
  -- reaches this row, which is what distinguishes erasure from tampering.
  if current_setting('easyhealth.purge_lineage', true) = 'on' then
    return old;
  end if;

  if not exists (select 1 from public.documents where id = old.document_id)
    or not exists (select 1 from public.profiles where id = old.profile_id) then
    return old;
  end if;

  raise exception using message = 'observation_change_events_append_only';
end;
$$;

drop trigger if exists observation_change_events_append_only
  on public.observation_change_events;
create trigger observation_change_events_append_only
  before update or delete on public.observation_change_events
  for each row
  execute function public.eh121_reject_observation_change_event_mutation();

-- ── 4. Shared helpers ────────────────────────────────────────────────────────

-- Evidence is referenced by hash, never by value. A source hash that does not
-- match the contract is recorded as absent rather than smuggled into the ledger.
create or replace function public.eh121_evidence_hash(p_hash text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_hash ~ '^[0-9a-f]{64}$' then p_hash else null end;
$$;

comment on function public.eh121_evidence_hash(text) is
  'EH-121: pass through a 64-hex evidence hash, otherwise null.';

create or replace function public.eh121_classify_revision_event(
  p_reversal_of_revision_id uuid,
  p_prior_revision_id uuid,
  p_prior_measurement_definition_key text,
  p_prior_analyte_key text,
  p_next_measurement_definition_key text,
  p_next_analyte_key text
)
returns public.observation_change_event_kind
language sql
immutable
set search_path = public
as $$
  select case
    when p_reversal_of_revision_id is not null then 'correction_reverted'
    when p_prior_revision_id is null then 'observation_accepted'
    when p_prior_measurement_definition_key is distinct from p_next_measurement_definition_key
      or p_prior_analyte_key is distinct from p_next_analyte_key then 'mapping_corrected'
    else 'verification_changed'
  end::public.observation_change_event_kind;
$$;

comment on function public.eh121_classify_revision_event(uuid, uuid, text, text, text, text) is
  'EH-121 event-kind precedence: reversal, then acceptance, then mapping change, then verification change.';

-- ── 5. Capture: normalization revisions ──────────────────────────────────────

create or replace function public.eh121_capture_revision_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior public.observation_normalization_revisions%rowtype;
  extracted public.document_extracted_biomarkers%rowtype;
  resolved_actor_id uuid;
  resolved_actor_type text;
begin
  -- A revision is auditable once it becomes the active projection: that is when
  -- the observation binding exists. Inserts that arrive already active and the
  -- promotion update are both covered; the unique index keeps it to one event.
  if not new.is_active then
    return null;
  end if;

  if TG_OP = 'UPDATE' and old.is_active then
    return null;
  end if;

  select * into extracted
  from public.document_extracted_biomarkers
  where id = new.extracted_biomarker_id;

  if not found then
    return null;
  end if;

  if new.supersedes_revision_id is not null then
    select * into prior
    from public.observation_normalization_revisions
    where id = new.supersedes_revision_id;
  end if;

  resolved_actor_id := coalesce(new.verification_actor_id, new.created_by, new.promoted_by);
  resolved_actor_type := case
    when new.verification_actor_type = 'user' and resolved_actor_id is not null then 'user'
    when new.verification_actor_type = 'system' then 'system'
    when resolved_actor_id is not null then 'user'
    else 'system'
  end;

  insert into public.observation_change_events (
    event_kind,
    origin,
    profile_id,
    document_id,
    observation_id,
    extracted_biomarker_id,
    source_revision_id,
    source_prior_revision_id,
    actor_type,
    actor_id,
    correction_reason,
    prior_measurement_definition_key,
    prior_analyte_key,
    prior_resolver_result,
    prior_verification_status,
    prior_mapping_confidence_band,
    prior_input_evidence_hash,
    next_measurement_definition_key,
    next_analyte_key,
    next_resolver_result,
    next_verification_status,
    next_mapping_confidence_band,
    next_input_evidence_hash,
    next_mapping_change_classification,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    extraction_version,
    occurred_at
  )
  values (
    public.eh121_classify_revision_event(
      new.reversal_of_revision_id,
      prior.id,
      prior.measurement_definition_key,
      prior.analyte_key,
      new.measurement_definition_key,
      new.analyte_key
    ),
    'capture',
    extracted.profile_id,
    extracted.document_id,
    new.observation_id,
    new.extracted_biomarker_id,
    new.id,
    prior.id,
    resolved_actor_type,
    case when resolved_actor_type = 'user' then resolved_actor_id else null end,
    new.correction_reason,
    prior.measurement_definition_key,
    prior.analyte_key,
    prior.resolver_result,
    prior.verification_status,
    prior.mapping_confidence_band,
    public.eh121_evidence_hash(prior.input_evidence_hash),
    new.measurement_definition_key,
    new.analyte_key,
    new.resolver_result,
    new.verification_status,
    new.mapping_confidence_band,
    public.eh121_evidence_hash(new.input_evidence_hash),
    new.mapping_change_classification,
    new.catalog_manifest_version,
    new.catalog_manifest_digest,
    new.resolver_version,
    new.normalization_version,
    new.extraction_version,
    coalesce(new.promoted_at, new.created_at, now())
  )
  on conflict do nothing;

  return null;
end;
$$;

drop trigger if exists eh121_capture_revision_change
  on public.observation_normalization_revisions;
create trigger eh121_capture_revision_change
  after insert or update on public.observation_normalization_revisions
  for each row
  execute function public.eh121_capture_revision_change();

-- ── 6. Capture: extraction supersession ──────────────────────────────────────

create or replace function public.eh121_capture_extraction_supersession()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bound_observation_id uuid;
begin
  if old.is_current is not true or new.is_current is not false then
    return null;
  end if;

  select id into bound_observation_id
  from public.observations
  where source_extracted_biomarker_id = new.id;

  insert into public.observation_change_events (
    event_kind,
    origin,
    profile_id,
    document_id,
    observation_id,
    extracted_biomarker_id,
    actor_type,
    occurred_at
  )
  values (
    'extraction_superseded',
    'capture',
    new.profile_id,
    new.document_id,
    bound_observation_id,
    new.id,
    'system',
    coalesce(new.superseded_at, now())
  )
  on conflict do nothing;

  return null;
end;
$$;

drop trigger if exists eh121_capture_extraction_supersession
  on public.document_extracted_biomarkers;
create trigger eh121_capture_extraction_supersession
  after update of is_current on public.document_extracted_biomarkers
  for each row
  execute function public.eh121_capture_extraction_supersession();

-- ── 7. Capture: applied registry reprocess rows ──────────────────────────────

create or replace function public.eh121_capture_reprocess_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  applied public.observation_normalization_revisions%rowtype;
  bound_observation_id uuid;
begin
  if new.apply_state <> 'applied' or old.apply_state = 'applied' then
    return null;
  end if;

  if new.applied_revision_id is not null then
    select * into applied
    from public.observation_normalization_revisions
    where id = new.applied_revision_id;
  end if;

  bound_observation_id := applied.observation_id;
  if bound_observation_id is null then
    select id into bound_observation_id
    from public.observations
    where source_extracted_biomarker_id = new.extracted_biomarker_id;
  end if;

  insert into public.observation_change_events (
    event_kind,
    origin,
    profile_id,
    document_id,
    observation_id,
    extracted_biomarker_id,
    source_revision_id,
    source_prior_revision_id,
    source_reprocess_row_id,
    actor_type,
    prior_measurement_definition_key,
    prior_analyte_key,
    prior_resolver_result,
    prior_verification_status,
    prior_mapping_confidence_band,
    prior_input_evidence_hash,
    next_measurement_definition_key,
    next_analyte_key,
    next_resolver_result,
    next_verification_status,
    next_mapping_confidence_band,
    next_input_evidence_hash,
    next_mapping_change_classification,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    extraction_version,
    occurred_at
  )
  values (
    'reprocess_applied',
    'capture',
    new.profile_id,
    new.document_id,
    bound_observation_id,
    new.extracted_biomarker_id,
    null,
    new.prior_revision_id,
    new.id,
    'system',
    new.prior_measurement_definition_key,
    new.prior_analyte_key,
    new.prior_resolver_result,
    new.prior_verification_status,
    new.prior_mapping_confidence_band,
    public.eh121_evidence_hash(new.prior_input_evidence_hash),
    new.next_measurement_definition_key,
    new.next_analyte_key,
    new.next_resolver_result,
    applied.verification_status,
    new.next_mapping_confidence_band,
    public.eh121_evidence_hash(new.next_input_evidence_hash),
    new.next_mapping_change_classification,
    applied.catalog_manifest_version,
    applied.catalog_manifest_digest,
    applied.resolver_version,
    applied.normalization_version,
    applied.extraction_version,
    coalesce(new.applied_at, now())
  )
  on conflict do nothing;

  return null;
end;
$$;

drop trigger if exists eh121_capture_reprocess_apply
  on public.registry_reprocess_batch_rows;
create trigger eh121_capture_reprocess_apply
  after update on public.registry_reprocess_batch_rows
  for each row
  execute function public.eh121_capture_reprocess_apply();

-- ── 8. Backfill ──────────────────────────────────────────────────────────────
--
-- An empty ledger would assert that nothing ever happened to documents
-- processed before EH-121. Reconstructed rows keep the source row's own
-- timestamp and are marked `backfill` so an auditor can tell them from a live
-- capture.

insert into public.observation_change_events (
  event_kind,
  origin,
  profile_id,
  document_id,
  observation_id,
  extracted_biomarker_id,
  source_revision_id,
  source_prior_revision_id,
  actor_type,
  actor_id,
  correction_reason,
  prior_measurement_definition_key,
  prior_analyte_key,
  prior_resolver_result,
  prior_verification_status,
  prior_mapping_confidence_band,
  prior_input_evidence_hash,
  next_measurement_definition_key,
  next_analyte_key,
  next_resolver_result,
  next_verification_status,
  next_mapping_confidence_band,
  next_input_evidence_hash,
  next_mapping_change_classification,
  catalog_manifest_version,
  catalog_manifest_digest,
  resolver_version,
  normalization_version,
  extraction_version,
  occurred_at
)
select
  public.eh121_classify_revision_event(
    revision.reversal_of_revision_id,
    prior.id,
    prior.measurement_definition_key,
    prior.analyte_key,
    revision.measurement_definition_key,
    revision.analyte_key
  ),
  'backfill',
  extracted.profile_id,
  extracted.document_id,
  revision.observation_id,
  revision.extracted_biomarker_id,
  revision.id,
  prior.id,
  case
    when coalesce(revision.verification_actor_id, revision.created_by, revision.promoted_by) is not null
      and revision.verification_actor_type is distinct from 'system'
    then 'user'
    else 'system'
  end,
  case
    when coalesce(revision.verification_actor_id, revision.created_by, revision.promoted_by) is not null
      and revision.verification_actor_type is distinct from 'system'
    then coalesce(revision.verification_actor_id, revision.created_by, revision.promoted_by)
    else null
  end,
  revision.correction_reason,
  prior.measurement_definition_key,
  prior.analyte_key,
  prior.resolver_result,
  prior.verification_status,
  prior.mapping_confidence_band,
  public.eh121_evidence_hash(prior.input_evidence_hash),
  revision.measurement_definition_key,
  revision.analyte_key,
  revision.resolver_result,
  revision.verification_status,
  revision.mapping_confidence_band,
  public.eh121_evidence_hash(revision.input_evidence_hash),
  revision.mapping_change_classification,
  revision.catalog_manifest_version,
  revision.catalog_manifest_digest,
  revision.resolver_version,
  revision.normalization_version,
  revision.extraction_version,
  coalesce(revision.promoted_at, revision.created_at)
from public.observation_normalization_revisions as revision
join public.document_extracted_biomarkers as extracted
  on extracted.id = revision.extracted_biomarker_id
left join public.observation_normalization_revisions as prior
  on prior.id = revision.supersedes_revision_id
on conflict do nothing;

insert into public.observation_change_events (
  event_kind,
  origin,
  profile_id,
  document_id,
  observation_id,
  extracted_biomarker_id,
  actor_type,
  occurred_at
)
select
  'extraction_superseded',
  'backfill',
  extracted.profile_id,
  extracted.document_id,
  (
    select observation.id
    from public.observations as observation
    where observation.source_extracted_biomarker_id = extracted.id
    limit 1
  ),
  extracted.id,
  'system',
  extracted.superseded_at
from public.document_extracted_biomarkers as extracted
where extracted.is_current = false
  and extracted.superseded_at is not null
on conflict do nothing;

insert into public.observation_change_events (
  event_kind,
  origin,
  profile_id,
  document_id,
  observation_id,
  extracted_biomarker_id,
  source_prior_revision_id,
  source_reprocess_row_id,
  actor_type,
  prior_measurement_definition_key,
  prior_analyte_key,
  prior_resolver_result,
  prior_verification_status,
  prior_mapping_confidence_band,
  prior_input_evidence_hash,
  next_measurement_definition_key,
  next_analyte_key,
  next_resolver_result,
  next_verification_status,
  next_mapping_confidence_band,
  next_input_evidence_hash,
  next_mapping_change_classification,
  catalog_manifest_version,
  catalog_manifest_digest,
  resolver_version,
  normalization_version,
  extraction_version,
  occurred_at
)
select
  'reprocess_applied',
  'backfill',
  batch_row.profile_id,
  batch_row.document_id,
  coalesce(
    applied.observation_id,
    (
      select observation.id
      from public.observations as observation
      where observation.source_extracted_biomarker_id = batch_row.extracted_biomarker_id
      limit 1
    )
  ),
  batch_row.extracted_biomarker_id,
  batch_row.prior_revision_id,
  batch_row.id,
  'system',
  batch_row.prior_measurement_definition_key,
  batch_row.prior_analyte_key,
  batch_row.prior_resolver_result,
  batch_row.prior_verification_status,
  batch_row.prior_mapping_confidence_band,
  public.eh121_evidence_hash(batch_row.prior_input_evidence_hash),
  batch_row.next_measurement_definition_key,
  batch_row.next_analyte_key,
  batch_row.next_resolver_result,
  applied.verification_status,
  batch_row.next_mapping_confidence_band,
  public.eh121_evidence_hash(batch_row.next_input_evidence_hash),
  batch_row.next_mapping_change_classification,
  applied.catalog_manifest_version,
  applied.catalog_manifest_digest,
  applied.resolver_version,
  applied.normalization_version,
  applied.extraction_version,
  coalesce(batch_row.applied_at, batch_row.created_at)
from public.registry_reprocess_batch_rows as batch_row
left join public.observation_normalization_revisions as applied
  on applied.id = batch_row.applied_revision_id
where batch_row.apply_state = 'applied'
on conflict do nothing;

notify pgrst, 'reload schema';
