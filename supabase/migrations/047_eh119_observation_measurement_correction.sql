-- EH-119: let a reviewer restate what was read from the document.
--
-- Two things were missing, and either one alone is useless.
--
-- 1. There was no write path for a measurement. The observation row is created
--    by `insert ... on conflict (source_extracted_biomarker_id) do nothing`, and
--    `promote_observation_normalization_revision_v2` projects only
--    `analyte_key`, `measurement_definition_key`, `normalization_revision_id`
--    and `resolution_status`. Every value, unit, reference bound and date in
--    `p_observation` was therefore honoured on the first write for a row and
--    silently discarded on every write after it: a correction would have
--    returned success and changed nothing.
--
-- 2. `correction` is defined as selecting a concrete definition
--    (`correction_requires_reviewed_concrete_definition`), which is exactly what
--    a reviewer must not be pushed into when the document states no specimen.
--    After #106 the reference document is 44 partial rows and 0 resolved, so the
--    only correction the product supported was the one that could not be made.
--
-- The correction is modelled as an edit to the resolver's INPUT. The reviewer
-- restates evidence; the application re-resolves raw evidence plus that
-- restatement and persists whatever the resolver concludes. Nothing here lets a
-- caller assert an outcome, an analyte or a definition.
--
-- What this migration does NOT do, deliberately:
--
--   * It does not touch `enforce_observation_provenance_write_once`. The raw,
--     source and version columns stay write-once, which is what proves
--     "corrections never overwrite raw fields" — the correctable set is exactly
--     the columns that trigger has always left alone.
--   * It does not relax `correction_requires_reviewed_concrete_definition`,
--     `resolved_normalization_requires_concrete_identity` or
--     `incomplete_normalization_cannot_have_concrete_identity`.
--   * It does not touch `eh104_validate_normalization_revision_verification`.
--     A measurement correction that stays incomplete is `pending`, which that
--     trigger already accepts; inventing a "corrected but unverified" status
--     would be EH-120's workflow decision, not this one.
--   * It does not replace the EH-115 wrapper. The wrapper forwards
--     `p_observation` verbatim (039:280-294), so the override rides inside that
--     payload and no signature moves. Replacing the wrapper would revert the
--     decision-trace enforcement, as 045 and 046 both note.
--   * It does not remove the EH-115 wrapper. The original thirteen-argument
--     wrapper remains unchanged; a fourteen-argument overload accepts an
--     explicit override and both paths retain decision-trace enforcement.
--   * It extends the promotion primitive with an optional effective-measurement
--     payload. The four-argument identity-only contract remains available, and
--     the writer's five-argument path projects the measurement under the same
--     lock and CAS instead of using a second update.
--
-- Covered by QA-Db_tests/eh119_observation_measurement_correction.sql and
-- the correction cases added to supabase/tests/writer_rpc_seam.sql.

-- ── the override column ──────────────────────────────────────────────────────

alter table public.observation_normalization_revisions
  add column if not exists measurement_override jsonb;

comment on column public.observation_normalization_revisions.measurement_override is
  'EH-119 user restatement of the reported measurement, absolute against raw extraction. Null when the revision reports the extraction as read. Never contains raw, source, provenance or identity fields.';

-- Shape only. The function must stay IMMUTABLE to be usable in a CHECK, so it
-- cannot compare against `current_date`. It validates the ISO Gregorian date
-- arithmetically; the writer additionally enforces that the date is not future.
create or replace function public.eh119_is_measurement_override(p_override jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(
    jsonb_typeof(p_override) = 'object'
    and p_override <> '{}'::jsonb
    -- Key presence is the signal: it is what distinguishes "the reviewer
    -- restated the unit" from "the reviewer did not touch the unit". The
    -- allowlist is also what keeps a raw, source, version or identity field
    -- from ever reaching this column.
    and not exists (
      select 1
      from jsonb_object_keys(p_override) as override_key(key)
      where override_key.key not in (
        'value',
        'value_text',
        'value_kind',
        'ordinal',
        'unit',
        'ref_low',
        'ref_high',
        'observed_at'
      )
    )
    and (
      not (p_override ? 'value')
      or jsonb_typeof(p_override -> 'value') in ('number', 'null')
    )
    and (
      not (p_override ? 'value_text')
      or jsonb_typeof(p_override -> 'value_text') in ('string', 'null')
    )
    and (
      not (p_override ? 'ordinal')
      or jsonb_typeof(p_override -> 'ordinal') in ('number', 'null')
    )
    and (
      not (p_override ? 'ref_low')
      or jsonb_typeof(p_override -> 'ref_low') in ('number', 'null')
    )
    and (
      not (p_override ? 'ref_high')
      or jsonb_typeof(p_override -> 'ref_high') in ('number', 'null')
    )
    and (
      not (p_override ? 'value_kind')
      or (
        jsonb_typeof(p_override -> 'value_kind') = 'string'
        and (p_override ->> 'value_kind') in ('numeric', 'qualitative', 'ordinal', 'text')
      )
    )
    and (
      not (p_override ? 'unit')
      or (
        jsonb_typeof(p_override -> 'unit') = 'string'
        and btrim(p_override ->> 'unit') <> ''
      )
    )
    and (
      not (p_override ? 'observed_at')
      or (
        jsonb_typeof(p_override -> 'observed_at') = 'string'
        and (p_override ->> 'observed_at') ~ '^\d{4}-\d{2}-\d{2}$'
        -- Keep this IMMUTABLE: validate the Gregorian calendar without a
        -- DateStyle-sensitive text-to-date cast.
        and substring(p_override ->> 'observed_at', 1, 4)::integer between 1 and 9999
        and substring(p_override ->> 'observed_at', 6, 2)::integer between 1 and 12
        and substring(p_override ->> 'observed_at', 9, 2)::integer between 1 and
          case substring(p_override ->> 'observed_at', 6, 2)::integer
            when 2 then
              28 + case
                when (
                  substring(p_override ->> 'observed_at', 1, 4)::integer % 400 = 0
                  or (
                    substring(p_override ->> 'observed_at', 1, 4)::integer % 4 = 0
                    and substring(p_override ->> 'observed_at', 1, 4)::integer % 100 <> 0
                  )
                ) then 1
                else 0
              end
            when 4 then 30
            when 6 then 30
            when 9 then 30
            when 11 then 30
            else 31
          end
      )
    )
    -- Mirrors observations_value_presence_check so a restatement cannot create
    -- an observation the table would reject.
    and (
      (p_override ->> 'value_kind') is distinct from 'numeric'
      or jsonb_typeof(p_override -> 'value') = 'number'
    )
    and (
      not (p_override ? 'value_kind')
      or (p_override ->> 'value_kind') = 'numeric'
      or (
        jsonb_typeof(p_override -> 'value_text') = 'string'
        and btrim(p_override ->> 'value_text') <> ''
      )
    )
    and (
      jsonb_typeof(p_override -> 'ref_low') is distinct from 'number'
      or jsonb_typeof(p_override -> 'ref_high') is distinct from 'number'
      or (p_override ->> 'ref_low')::numeric <= (p_override ->> 'ref_high')::numeric
    ),
    false
  );
$$;

comment on function public.eh119_is_measurement_override(jsonb) is
  'EH-119 measurement override shape contract: object, at least one correctable key, no unknown key, value/value_kind coherence, ordered reference bounds. Date semantics are enforced by the writer, not here, so this stays IMMUTABLE.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'observation_normalization_revisions_measurement_override_valid'
      and conrelid = 'public.observation_normalization_revisions'::regclass
  ) then
    alter table public.observation_normalization_revisions
      add constraint observation_normalization_revisions_measurement_override_valid
      check (
        measurement_override is null
        or public.eh119_is_measurement_override(measurement_override)
      );
  end if;
end;
$$;

-- ── the atomic measurement projection ───────────────────────────────────────
--
-- The four-argument promotion RPC is retained for existing callers. The
-- five-argument overload carries the writer's effective measurement and owns
-- its projection under the same observation lock and CAS as the identity
-- projection. A null payload means "legacy identity-only promotion".
create or replace function public.promote_observation_normalization_revision_v2(
  p_revision_id uuid,
  p_observation_id uuid,
  p_expected_active_revision_id uuid,
  p_actor_id uuid default null,
  p_observation_payload jsonb default null
)
returns public.observation_normalization_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_extracted_biomarker_id uuid;
  extracted public.document_extracted_biomarkers;
  target public.observation_normalization_revisions;
  active_revision public.observation_normalization_revisions;
  observation public.observations;
  projected_value numeric;
  projected_value_text text;
  projected_value_kind text;
  projected_ordinal integer;
  projected_unit text;
  projected_ref_low numeric;
  projected_ref_high numeric;
  projected_observed_at date;
  affected_observations integer;
begin
  select revision.extracted_biomarker_id
  into target_extracted_biomarker_id
  from public.observation_normalization_revisions as revision
  where revision.id = p_revision_id;

  if target_extracted_biomarker_id is null then
    raise exception using message = 'normalization_revision_not_found';
  end if;

  select *
  into extracted
  from public.document_extracted_biomarkers
  where id = target_extracted_biomarker_id
  for update;

  if extracted.id is null then
    raise exception using message = 'extracted_biomarker_not_found';
  end if;

  select *
  into observation
  from public.observations
  where id = p_observation_id
  for update;

  if observation.id is null then
    raise exception using message = 'observation_not_found';
  end if;

  if p_observation_payload is not null then
    if jsonb_typeof(p_observation_payload) is distinct from 'object' then
      raise exception using message = 'invalid_normalization_writer_payload';
    end if;
    projected_value := nullif(p_observation_payload ->> 'value', '')::numeric;
    projected_value_kind :=
      coalesce(nullif(btrim(p_observation_payload ->> 'value_kind'), ''), 'text');
    projected_value_text := nullif(p_observation_payload ->> 'value_text', '');
    projected_ordinal := nullif(p_observation_payload ->> 'ordinal', '')::integer;
    projected_unit := coalesce(p_observation_payload ->> 'unit', '');
    projected_ref_low := nullif(p_observation_payload ->> 'ref_low', '')::numeric;
    projected_ref_high := nullif(p_observation_payload ->> 'ref_high', '')::numeric;
    projected_observed_at := (p_observation_payload ->> 'observed_at')::date;
  else
    projected_value := observation.value;
    projected_value_kind := observation.value_kind;
    projected_value_text := observation.value_text;
    projected_ordinal := observation.ordinal;
    projected_unit := observation.unit;
    projected_ref_low := observation.ref_low;
    projected_ref_high := observation.ref_high;
    projected_observed_at := observation.observed_at;
  end if;

  perform 1
  from public.observation_normalization_revisions as revision
  where revision.extracted_biomarker_id = extracted.id
    and (revision.is_active or revision.id = p_revision_id)
  order by revision.id
  for update;

  select *
  into target
  from public.observation_normalization_revisions
  where id = p_revision_id;

  if target.id is null then
    raise exception using message = 'normalization_revision_not_found';
  end if;

  if target.extracted_biomarker_id is distinct from extracted.id then
    raise exception using message = 'revision_extracted_biomarker_mismatch';
  end if;

  if observation.source_extracted_biomarker_id is distinct from extracted.id then
    raise exception using message = 'observation_source_mismatch';
  end if;

  if observation.profile_id is distinct from extracted.profile_id
    or observation.document_id is distinct from extracted.document_id then
    raise exception using message = 'observation_source_owner_mismatch';
  end if;

  if target.observation_id is not null
    and target.observation_id is distinct from observation.id then
    raise exception using message = 'revision_observation_binding_conflict';
  end if;

  select *
  into active_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = extracted.id
    and is_active;

  if target.is_active
    and target.observation_id = observation.id
    and observation.normalization_revision_id = target.id
    and observation.source_extracted_biomarker_id = target.extracted_biomarker_id
    and observation.analyte_key is not distinct from target.analyte_key
    and observation.measurement_definition_key is not distinct from target.measurement_definition_key
    and observation.resolution_status is not distinct from target.resolver_result
    and observation.value is not distinct from projected_value
    and observation.value_text is not distinct from projected_value_text
    and observation.value_kind is not distinct from projected_value_kind
    and observation.ordinal is not distinct from projected_ordinal
    and observation.unit is not distinct from projected_unit
    and observation.ref_low is not distinct from projected_ref_low
    and observation.ref_high is not distinct from projected_ref_high
    and observation.observed_at is not distinct from projected_observed_at then
    return target;
  end if;

  if target.is_active then
    raise exception using message = 'active_revision_projection_mismatch';
  end if;

  if active_revision.id is distinct from p_expected_active_revision_id then
    raise exception using message = 'stale_revision_conflict';
  end if;

  update public.observation_normalization_revisions
  set is_active = false
  where extracted_biomarker_id = extracted.id
    and is_active
    and id <> target.id;

  update public.observation_normalization_revisions
  set is_active = true,
      observation_id = observation.id,
      promoted_at = now(),
      promoted_by = p_actor_id
  where id = target.id
  returning * into target;

  update public.observations
  set analyte_key = target.analyte_key,
      measurement_definition_key = target.measurement_definition_key,
      normalization_revision_id = target.id,
      resolution_status = target.resolver_result,
      value = projected_value,
      value_text = projected_value_text,
      value_kind = projected_value_kind,
      ordinal = projected_ordinal,
      unit = projected_unit,
      ref_low = projected_ref_low,
      ref_high = projected_ref_high,
      observed_at = projected_observed_at
  where id = observation.id;

  get diagnostics affected_observations = row_count;
  if affected_observations <> 1 then
    raise exception using message = 'observation_projection_update_failed';
  end if;

  return target;
end;
$$;

-- Existing four-argument callers retain their exact identity-only behaviour,
-- while sharing the new lock/CAS implementation.
create or replace function public.promote_observation_normalization_revision_v2(
  p_revision_id uuid,
  p_observation_id uuid,
  p_expected_active_revision_id uuid,
  p_actor_id uuid default null
)
returns public.observation_normalization_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  promoted public.observation_normalization_revisions;
begin
  select *
  into promoted
  from public.promote_observation_normalization_revision_v2(
    p_revision_id,
    p_observation_id,
    p_expected_active_revision_id,
    p_actor_id,
    null::jsonb
  );
  return promoted;
end;
$$;

revoke all on function public.promote_observation_normalization_revision_v2(
  uuid, uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.promote_observation_normalization_revision_v2(
  uuid, uuid, uuid, uuid, jsonb
) to service_role;

-- ── the writer ───────────────────────────────────────────────────────────────

-- The 046 delegate had thirteen arguments. Drop that overload before creating
-- the fourteen-argument delegate; otherwise the unchanged EH-115 wrapper would
-- keep resolving to the old body.
drop function if exists public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
);

create or replace function public.write_observation_normalization_revision_v2_legacy(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_write_kind text,
  p_actor_id uuid,
  p_request_hash text,
  p_measurement_override jsonb default null,
  p_expected_active_revision_id uuid default null,
  p_mapping_change_classification text default 'additive',
  p_correction_reason text default null,
  p_reversal_of_revision_id uuid default null,
  p_supersedes_revision_id uuid default null,
  p_extraction_version text default null,
  p_reviewed_measurement_definition boolean default false
)
returns table (
  observation_id uuid,
  revision_id uuid,
  verification_status text,
  resolver_result text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_observation public.observations;
  target_revision public.observation_normalization_revisions;
  promoted_revision public.observation_normalization_revisions;
  target_verification_status text;
  target_resolver_result text;
  target_definition_key text;
  target_analyte_key text;
  target_mapping_confidence numeric;
  target_mapping_confidence_band text;
  target_resolver_evidence jsonb;
  target_catalog_manifest_version text;
  target_catalog_manifest_digest text;
  target_resolver_version text;
  target_normalization_version text;
  target_normalized_unit text;
  target_unit_dimension text;
  target_input_evidence_hash text;
  target_expected_active_revision_id uuid;
  target_supersedes_revision_id uuid;
  target_measurement_override jsonb;
  target_observed_at date;
  projected_measurements integer;
  revision_was_reused boolean := false;
begin
  -- EH-119: `value_correction` restates the reported measurement. It may end in
  -- any resolver outcome, because the outcome is re-derived from the corrected
  -- input rather than chosen by the caller.
  if p_write_kind not in ('acceptance', 'correction', 'value_correction') then
    raise exception using message = 'invalid_normalization_write_kind';
  end if;

  if p_actor_id is null then
    raise exception using message = 'normalization_writer_actor_required';
  end if;

  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_normalization_writer_request_hash';
  end if;

  if jsonb_typeof(p_observation) is distinct from 'object'
    or jsonb_typeof(p_resolution) is distinct from 'object' then
    raise exception using message = 'invalid_normalization_writer_payload';
  end if;

  -- The wrapper overload passes the explicit parameter. The unchanged EH-115
  -- thirteen-argument wrapper reaches the same delegate with its default and
  -- carries the override in `p_observation` instead.
  target_measurement_override := coalesce(
    p_measurement_override,
    nullif(p_observation -> 'measurement_override', 'null'::jsonb)
  );

  if target_measurement_override is not null
    and not public.eh119_is_measurement_override(target_measurement_override) then
    raise exception using message = 'invalid_measurement_override';
  end if;

  if p_observation ? 'measurement_override'
    and coalesce(p_observation -> 'measurement_override', 'null'::jsonb)
      is distinct from coalesce(target_measurement_override, 'null'::jsonb) then
    raise exception using message = 'measurement_override_projection_mismatch';
  end if;
  if target_measurement_override ? 'observed_at' then
    begin
      target_observed_at := (target_measurement_override ->> 'observed_at')::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        raise exception using message = 'invalid_measurement_override';
    end;

    if target_observed_at > current_date then
      raise exception using message = 'measurement_override_observed_at_in_future';
    end if;
  end if;

  -- EH-119: every correcting write kind must say why. Reason, actor and time
  -- are the audit record EH-121 will read, and `created_by` / `created_at` /
  -- `correction_reason` are outside the EH-104 pending decision-metadata guard,
  -- so an incomplete correction can still be attributed.
  if p_write_kind in ('correction', 'value_correction')
    and coalesce(btrim(p_correction_reason), '') = '' then
    raise exception using message = 'measurement_correction_requires_reason';
  end if;

  target_resolver_result := nullif(btrim(p_resolution ->> 'resolver_result'), '');
  target_definition_key := nullif(btrim(p_resolution ->> 'measurement_definition_key'), '');
  target_analyte_key := nullif(btrim(p_resolution ->> 'analyte_key'), '');
  target_mapping_confidence := nullif(p_resolution ->> 'mapping_confidence', '')::numeric;
  target_mapping_confidence_band := nullif(btrim(p_resolution ->> 'mapping_confidence_band'), '');
  target_resolver_evidence := coalesce(p_resolution -> 'resolver_evidence', '[]'::jsonb);
  target_catalog_manifest_version := nullif(btrim(p_resolution ->> 'catalog_manifest_version'), '');
  target_catalog_manifest_digest := nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), '');
  target_resolver_version := nullif(btrim(p_resolution ->> 'resolver_version'), '');
  target_normalization_version := nullif(btrim(p_resolution ->> 'normalization_version'), '');
  target_normalized_unit := nullif(btrim(p_resolution ->> 'normalized_unit'), '');
  target_unit_dimension := nullif(btrim(p_resolution ->> 'unit_dimension'), '');
  target_input_evidence_hash := nullif(btrim(p_resolution ->> 'input_evidence_hash'), '');

  if target_resolver_result is null
    or target_resolver_result not in ('resolved', 'partial', 'ambiguous', 'unmapped')
    or target_mapping_confidence is null
    or target_mapping_confidence < 0
    or target_mapping_confidence > 1
    or target_mapping_confidence_band is null
    or target_mapping_confidence_band not in ('high', 'medium', 'low')
    or target_input_evidence_hash is null
    or target_catalog_manifest_version is null
    or target_catalog_manifest_digest is null
    or target_resolver_version is null
    or target_normalization_version is null
    -- #117: `resolver_evidence` carries the v2 decision trace, an OBJECT with
    -- `candidates`. This demanded an array, inherited from migration 021 when
    -- the column really did hold a flat evidence list, so every acceptance the
    -- TypeScript writer attempted was rejected. The read path traverses
    -- `.outcome` and `.selectedCandidateKey`, so the object is the correct
    -- shape; the legacy array stays acceptable for rows written before it.
    or jsonb_typeof(target_resolver_evidence) not in ('array', 'object')
    or (
      jsonb_typeof(target_resolver_evidence) = 'object'
      and jsonb_typeof(target_resolver_evidence -> 'candidates') is distinct from 'array'
    ) then
    raise exception using message = 'invalid_normalization_resolution_payload';
  end if;

  if target_resolver_result = 'resolved' then
    if target_definition_key is null or target_analyte_key is null then
      raise exception using message = 'resolved_normalization_requires_concrete_identity';
    end if;
    if p_reviewed_measurement_definition is not true then
      raise exception using message = 'unreviewed_measurement_definition';
    end if;
  -- #120: the two identity links are not one rule. `measurement_definition_key`
  -- is the concrete claim and still requires `resolved`. `analyte_key` is the
  -- weaker tier: the resolver emits it whenever its viable candidates converge
  -- on a single analyte, which is the normal state of a row whose specimen axis
  -- was never printed. Gating both at the same threshold rejected every such
  -- row, so a document could only be accepted in the part the resolver
  -- understood least. The resolved branch above is unchanged, so the concrete
  -- identity invariant is untouched.
  elsif target_definition_key is not null then
    raise exception using message = 'incomplete_normalization_cannot_have_concrete_identity';
  end if;

  -- EH-119: unchanged, and deliberately still scoped to `correction`. A mapping
  -- correction is the act of selecting a concrete definition, so it must still
  -- land on `resolved`. `value_correction` is a different act and is not a
  -- route around this guard: it cannot supply a definition key on an incomplete
  -- outcome either, because the branch above rejects that for every write kind.
  if p_write_kind = 'correction' and target_resolver_result <> 'resolved' then
    raise exception using message = 'correction_requires_reviewed_concrete_definition';
  end if;

  -- EH-119: derived, never asserted. `eh104_validate_normalization_revision_verification`
  -- requires `resolved` plus a definition key for any status other than
  -- `pending`, and forbids decision metadata on `pending`, so this is the only
  -- derivation that satisfies the EH-104 trigger without relaxing it.
  target_verification_status := case
    when p_write_kind = 'correction' then 'manually_corrected'
    when p_write_kind = 'value_correction' and target_resolver_result = 'resolved' then 'manually_corrected'
    when target_resolver_result = 'resolved' then 'user_verified'
    else 'pending'
  end;

  if p_reversal_of_revision_id is not null and not exists (
    select 1
    from public.observation_normalization_revisions
    where id = p_reversal_of_revision_id
      and extracted_biomarker_id = p_extracted_biomarker_id
  ) then
    raise exception using message = 'reversal_revision_source_mismatch';
  end if;

  if p_supersedes_revision_id is not null and not exists (
    select 1
    from public.observation_normalization_revisions
    where id = p_supersedes_revision_id
      and extracted_biomarker_id = p_extracted_biomarker_id
  ) then
    raise exception using message = 'superseded_revision_source_mismatch';
  end if;

  -- The initial insert is deliberately source-only. The v2 primitive below is
  -- the only code path that writes the active normalization projection.
  insert into public.observations (
    profile_id,
    document_id,
    source_extracted_biomarker_id,
    name,
    value,
    value_kind,
    value_text,
    ordinal,
    unit,
    ref_low,
    ref_high,
    observed_at,
    specimen,
    modifier,
    raw_name,
    raw_value_text,
    raw_reference_text,
    raw_unit,
    source_page,
    source_text,
    bounding_box,
    confidence,
    reported_alt_value,
    reported_alt_unit,
    extraction_version,
    provenance_schema_version,
    catalog_manifest_version,
    catalog_manifest_digest,
    resolver_version,
    normalization_version,
    observation_kind
  )
  values (
    (p_observation ->> 'profile_id')::uuid,
    (p_observation ->> 'document_id')::uuid,
    p_extracted_biomarker_id,
    coalesce(nullif(btrim(p_observation ->> 'name'), ''), 'Unnamed laboratory result'),
    nullif(p_observation ->> 'value', '')::numeric,
    coalesce(nullif(btrim(p_observation ->> 'value_kind'), ''), 'text'),
    nullif(p_observation ->> 'value_text', ''),
    nullif(p_observation ->> 'ordinal', '')::integer,
    coalesce(p_observation ->> 'unit', ''),
    nullif(p_observation ->> 'ref_low', '')::numeric,
    nullif(p_observation ->> 'ref_high', '')::numeric,
    (p_observation ->> 'observed_at')::date,
    coalesce(nullif(btrim(p_observation ->> 'specimen'), ''), 'unspecified'),
    coalesce(nullif(btrim(p_observation ->> 'modifier'), ''), 'none'),
    nullif(p_observation ->> 'raw_name', ''),
    nullif(p_observation ->> 'raw_value_text', ''),
    nullif(p_observation ->> 'raw_reference_text', ''),
    nullif(p_observation ->> 'raw_unit', ''),
    nullif(p_observation ->> 'source_page', '')::integer,
    nullif(p_observation ->> 'source_text', ''),
    p_observation -> 'bounding_box',
    nullif(p_observation ->> 'confidence', '')::numeric,
    nullif(p_observation ->> 'reported_alt_value', '')::numeric,
    nullif(p_observation ->> 'reported_alt_unit', ''),
    nullif(p_observation ->> 'extraction_version', ''),
    coalesce(nullif(btrim(p_observation ->> 'provenance_schema_version'), ''), '1'),
    target_catalog_manifest_version,
    target_catalog_manifest_digest,
    target_resolver_version,
    target_normalization_version,
    'lab'
  )
  on conflict (source_extracted_biomarker_id)
    where source_extracted_biomarker_id is not null
    do nothing
  returning * into target_observation;

  if target_observation.id is null then
    select *
    into target_observation
    from public.observations
    where source_extracted_biomarker_id = p_extracted_biomarker_id;
  end if;

  if target_observation.id is null then
    raise exception using message = 'observation_write_failed';
  end if;

  select *
  into target_revision
  from public.observation_normalization_revisions
  where extracted_biomarker_id = p_extracted_biomarker_id
    and writer_request_hash = p_request_hash;

  if target_revision.id is not null then
    revision_was_reused := true;
    target_expected_active_revision_id := target_revision.supersedes_revision_id;
  else
    target_supersedes_revision_id := coalesce(
      p_supersedes_revision_id,
      p_expected_active_revision_id
    );

    insert into public.observation_normalization_revisions (
      extracted_biomarker_id,
      input_evidence_hash,
      measurement_definition_key,
      analyte_key,
      resolver_result,
      mapping_confidence,
      mapping_confidence_band,
      resolver_evidence,
      catalog_manifest_version,
      catalog_manifest_digest,
      resolver_version,
      normalization_version,
      extraction_version,
      verification_status,
      verification_decided_at,
      verification_actor_type,
      verification_actor_id,
      mapping_change_classification,
      created_by,
      correction_reason,
      reversal_of_revision_id,
      supersedes_revision_id,
      writer_request_hash,
      measurement_override
    )
    values (
      p_extracted_biomarker_id,
      target_input_evidence_hash,
      target_definition_key,
      target_analyte_key,
      target_resolver_result,
      target_mapping_confidence,
      target_mapping_confidence_band,
      target_resolver_evidence,
      target_catalog_manifest_version,
      target_catalog_manifest_digest,
      target_resolver_version,
      target_normalization_version,
      p_extraction_version,
      target_verification_status,
      case when target_verification_status = 'pending' then null else now() end,
      case when target_verification_status = 'pending' then null else 'user' end,
      case when target_verification_status = 'pending' then null else p_actor_id end,
      p_mapping_change_classification,
      p_actor_id,
      p_correction_reason,
      p_reversal_of_revision_id,
      target_supersedes_revision_id,
      p_request_hash,
      target_measurement_override
    )
    on conflict (extracted_biomarker_id, writer_request_hash)
      where writer_request_hash is not null
      do nothing
    returning * into target_revision;

    if target_revision.id is null then
      select *
      into target_revision
      from public.observation_normalization_revisions
      where extracted_biomarker_id = p_extracted_biomarker_id
        and writer_request_hash = p_request_hash;
      revision_was_reused := true;
      target_expected_active_revision_id := target_revision.supersedes_revision_id;
    else
      target_expected_active_revision_id := coalesce(
        p_expected_active_revision_id,
        target_supersedes_revision_id
      );
    end if;
  end if;

  -- Do not lock, validate ownership, synchronize projections, or handle CAS
  -- here. Those remain the v2 primitive's exact responsibility and errors.
  select *
  into promoted_revision
  from public.promote_observation_normalization_revision_v2(
    target_revision.id,
    target_observation.id,
    target_expected_active_revision_id,
    p_actor_id,
    p_observation
  );


  update public.document_extracted_biomarkers
  set status = 'accepted',
      analyte_key = target_analyte_key,
      measurement_definition_key = target_definition_key,
      resolver_result = target_resolver_result,
      resolution_status = target_resolver_result,
      mapping_confidence = target_mapping_confidence,
      mapping_confidence_band = target_mapping_confidence_band,
      resolver_evidence = target_resolver_evidence,
      normalized_unit = target_normalized_unit,
      unit_dimension = target_unit_dimension,
      catalog_manifest_version = target_catalog_manifest_version,
      catalog_manifest_digest = target_catalog_manifest_digest,
      resolver_version = target_resolver_version,
      normalization_version = target_normalization_version,
      extraction_version = p_extraction_version,
      verification_status = target_verification_status
  where id = p_extracted_biomarker_id;

  return query
  select
    target_observation.id,
    promoted_revision.id,
    promoted_revision.verification_status,
    promoted_revision.resolver_result,
    revision_was_reused;
end;
$$;

-- The original EH-115 wrapper remains the thirteen-argument function. This
-- overload lets the application pass the override as an explicit RPC
-- parameter while retaining the old contract for every existing caller.
create or replace function public.write_observation_normalization_revision_v2(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_write_kind text,
  p_actor_id uuid,
  p_request_hash text,
  p_measurement_override jsonb default null,
  p_expected_active_revision_id uuid default null,
  p_mapping_change_classification text default 'additive',
  p_correction_reason text default null,
  p_reversal_of_revision_id uuid default null,
  p_supersedes_revision_id uuid default null,
  p_extraction_version text default null,
  p_reviewed_measurement_definition boolean default false
)
returns table (
  observation_id uuid,
  revision_id uuid,
  verification_status text,
  resolver_result text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  write_result record;
  trace jsonb;
  trace_schema_version text;
begin
  trace := p_resolution -> 'resolver_decision_trace';
  trace_schema_version := nullif(btrim(p_resolution ->> 'resolver_trace_schema_version'), '');

  if not public.eh115_validate_resolver_decision_trace(trace, trace_schema_version) then
    raise exception using message = 'invalid_resolver_decision_trace';
  end if;

  if trace ->> 'outcome' is distinct from nullif(btrim(p_resolution ->> 'resolver_result'), '')
    or trace ->> 'inputEvidenceHash' is distinct from nullif(btrim(p_resolution ->> 'input_evidence_hash'), '')
    or trace ->> 'catalogManifestVersion' is distinct from nullif(btrim(p_resolution ->> 'catalog_manifest_version'), '')
    or trace ->> 'catalogManifestDigest' is distinct from nullif(btrim(p_resolution ->> 'catalog_manifest_digest'), '')
    or trace ->> 'resolverVersion' is distinct from nullif(btrim(p_resolution ->> 'resolver_version'), '') then
    raise exception using message = 'resolver_decision_trace_resolution_mismatch';
  end if;

  select *
  into write_result
  from public.write_observation_normalization_revision_v2_legacy(
    p_extracted_biomarker_id,
    p_observation,
    p_resolution,
    p_write_kind,
    p_actor_id,
    p_request_hash,
    p_measurement_override,
    p_expected_active_revision_id,
    p_mapping_change_classification,
    p_correction_reason,
    p_reversal_of_revision_id,
    p_supersedes_revision_id,
    p_extraction_version,
    p_reviewed_measurement_definition
  );

  update public.observation_normalization_revisions
  set resolver_decision_trace = trace,
      resolver_trace_schema_version = trace_schema_version
  where id = write_result.revision_id
    and extracted_biomarker_id = p_extracted_biomarker_id;

  if not found then
    raise exception using message = 'resolver_decision_trace_revision_not_found';
  end if;

  return query
  select
    write_result.observation_id,
    write_result.revision_id,
    write_result.verification_status,
    write_result.resolver_result,
    write_result.was_reused;
end;
$$;

-- Keep the old delegate signature callable by the unchanged EH-115 wrapper.
-- It intentionally supplies no explicit parameter; the fourteen-argument
-- implementation still reads the override embedded in `p_observation`.
create or replace function public.write_observation_normalization_revision_v2_legacy(
  p_extracted_biomarker_id uuid,
  p_observation jsonb,
  p_resolution jsonb,
  p_write_kind text,
  p_actor_id uuid,
  p_request_hash text,
  p_expected_active_revision_id uuid default null,
  p_mapping_change_classification text default 'additive',
  p_correction_reason text default null,
  p_reversal_of_revision_id uuid default null,
  p_supersedes_revision_id uuid default null,
  p_extraction_version text default null,
  p_reviewed_measurement_definition boolean default false
)
returns table (
  observation_id uuid,
  revision_id uuid,
  verification_status text,
  resolver_result text,
  was_reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.write_observation_normalization_revision_v2_legacy(
    p_extracted_biomarker_id,
    p_observation,
    p_resolution,
    p_write_kind,
    p_actor_id,
    p_request_hash,
    null::jsonb,
    p_expected_active_revision_id,
    p_mapping_change_classification,
    p_correction_reason,
    p_reversal_of_revision_id,
    p_supersedes_revision_id,
    p_extraction_version,
    p_reviewed_measurement_definition
  );
end;
$$;

revoke all on function public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.write_observation_normalization_revision_v2_legacy(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.write_observation_normalization_revision_v2(
  uuid, jsonb, jsonb, text, uuid, text, jsonb, uuid, text, text, uuid, uuid, text, boolean
) to service_role;

notify pgrst, 'reload schema';
