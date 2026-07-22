-- EH-105: occurrence-aware source lineage for instrumental observations.
--
-- This is intentionally separate from the laboratory Registry 2.0 lineage.
-- It does not alter EH-104's deferred Phase B laboratory guards or its
-- normalization-promotion RPC lifecycle.

create table if not exists public.document_extracted_instrumental_measures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  processing_job_id uuid references public.document_processing_jobs(id) on delete set null,
  key_hint text,
  name text not null,
  raw_name text not null,
  value numeric not null,
  raw_value_text text not null,
  unit text not null,
  raw_unit text not null,
  observed_at date not null,
  source_page integer,
  source_text text,
  source_locator text not null,
  occurrence_index integer not null check (occurrence_index >= 0),
  bounding_box jsonb,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  modality text,
  body_region text,
  processing_version text,
  extraction_model text,
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default true,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint document_extracted_instrumental_measures_snapshot_locator_occurrence_unique
    unique (document_id, snapshot_hash, source_locator, occurrence_index),
  constraint document_extracted_instrumental_measures_id_profile_document_unique
    unique (id, profile_id, document_id)
);

comment on table public.document_extracted_instrumental_measures is
  'EH-105 immutable source occurrences for instrumental numeric measures. Reprocessing supersedes current source rows instead of deleting them.';
comment on column public.document_extracted_instrumental_measures.key_hint is
  'Non-authoritative extraction-model hint. It is never an observation identity.';
comment on column public.document_extracted_instrumental_measures.source_locator is
  'Stable within an extraction snapshot; paired with occurrence_index to identify repeated source occurrences.';
comment on column public.document_extracted_instrumental_measures.snapshot_hash is
  'SHA-256 fingerprint of the worker canonical instrumental extraction payload.';

create index if not exists document_extracted_instrumental_measures_document_current
  on public.document_extracted_instrumental_measures (document_id, is_current, created_at desc);
create index if not exists document_extracted_instrumental_measures_profile_document
  on public.document_extracted_instrumental_measures (profile_id, document_id);

alter table public.document_extracted_instrumental_measures enable row level security;

create policy "service_all_document_extracted_instrumental_measures"
  on public.document_extracted_instrumental_measures
  for all
  to service_role
  using (true)
  with check (true);

alter table public.observations
  add column if not exists source_instrumental_measure_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.observations'::regclass
      and conname = 'observations_instrumental_source_owner_fk'
  ) then
    alter table public.observations
      add constraint observations_instrumental_source_owner_fk
      foreign key (source_instrumental_measure_id, profile_id, document_id)
      references public.document_extracted_instrumental_measures (id, profile_id, document_id)
      on delete cascade;
  end if;
end;
$$;

create unique index if not exists observations_source_instrumental_measure_unique
  on public.observations (source_instrumental_measure_id)
  where source_instrumental_measure_id is not null;

-- Existing disposable development data can contain pre-EH-105 instrumental
-- rows without source lineage. NOT VALID preserves migration compatibility
-- while enforcing the contract for every new write.
-- reset/reprocess is the supported path for those legacy rows.
alter table public.observations
  drop constraint if exists observations_instrumental_lineage_check;

alter table public.observations
  add constraint observations_instrumental_lineage_check
  check (
    (
      observation_kind = 'instrumental'
      and source_instrumental_measure_id is not null
      and source_extracted_biomarker_id is null
      and normalization_revision_id is null
      and analyte_key is null
      and measurement_definition_key is null
    )
    or (
      observation_kind = 'lab'
      and source_instrumental_measure_id is null
    )
  ) not valid;

create or replace function public.replace_document_instrumental_observations(
  p_document_id uuid,
  p_job_id uuid,
  p_snapshot_hash text,
  p_study_date date,
  p_modality text,
  p_body_region text,
  p_processing_version text,
  p_extraction_model text,
  p_measures jsonb
)
returns table (
  source_instrumental_measure_id uuid,
  observation_id uuid,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_job public.document_processing_jobs%rowtype;
  v_measure jsonb;
  v_source public.document_extracted_instrumental_measures%rowtype;
  v_source_id uuid;
  v_observation public.observations%rowtype;
  v_snapshot_exists boolean := false;
  v_measure_count integer := 0;
  v_existing_measure_count integer := 0;
  v_source_locator text;
  v_occurrence_index integer;
  v_source_page integer;
  v_confidence numeric;
  v_bounding_box jsonb;
begin
  if p_snapshot_hash is null or p_snapshot_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'invalid_instrumental_snapshot_hash';
  end if;

  if p_study_date is null then
    raise exception using message = 'instrumental_study_date_required';
  end if;

  if jsonb_typeof(p_measures) <> 'array' then
    raise exception using message = 'instrumental_measures_must_be_array';
  end if;

  select *
  into v_document
  from public.documents
  where id = p_document_id
  for update;

  if v_document.id is null then
    raise exception using message = 'instrumental_document_not_found';
  end if;

  if v_document.document_type is distinct from 'instrumental_report' then
    raise exception using message = 'instrumental_document_type_mismatch';
  end if;

  select *
  into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.id is null then
    raise exception using message = 'instrumental_job_not_found';
  end if;

  if v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'instrumental_job_document_profile_mismatch';
  end if;

  if v_job.status is distinct from 'processing' then
    raise exception using message = 'instrumental_job_not_processing';
  end if;

  for v_measure in select value from jsonb_array_elements(p_measures)
  loop
    v_measure_count := v_measure_count + 1;

    if jsonb_typeof(v_measure) <> 'object'
      or jsonb_typeof(v_measure -> 'value') <> 'number'
      or coalesce(nullif(btrim(v_measure ->> 'name'), ''), '') = ''
      or coalesce(nullif(btrim(v_measure ->> 'raw_name'), ''), '') = ''
      or coalesce(nullif(btrim(v_measure ->> 'raw_value_text'), ''), '') = ''
      or coalesce(nullif(btrim(v_measure ->> 'source_locator'), ''), '') = ''
      or jsonb_typeof(v_measure -> 'occurrence_index') <> 'number'
      or (v_measure ->> 'occurrence_index') !~ '^[0-9]+$'
      or (
        v_measure ? 'source_page'
        and jsonb_typeof(v_measure -> 'source_page') <> 'null'
        and (
          jsonb_typeof(v_measure -> 'source_page') <> 'number'
          or (v_measure ->> 'source_page') !~ '^[1-9][0-9]*$'
        )
      )
      or (
        v_measure ? 'confidence'
        and jsonb_typeof(v_measure -> 'confidence') <> 'null'
        and (
          jsonb_typeof(v_measure -> 'confidence') <> 'number'
          or case
            when jsonb_typeof(v_measure -> 'confidence') = 'number'
              then (v_measure ->> 'confidence')::numeric < 0
                or (v_measure ->> 'confidence')::numeric > 1
            else false
          end
        )
      ) then
      raise exception using message = 'invalid_instrumental_measure_payload';
    end if;
  end loop;

  if exists (
    select 1
    from (
      select
        btrim(value ->> 'source_locator') as source_locator,
        (value ->> 'occurrence_index')::integer as occurrence_index,
        count(*) as occurrence_count
      from jsonb_array_elements(p_measures)
      group by btrim(value ->> 'source_locator'), (value ->> 'occurrence_index')::integer
      having count(*) > 1
    ) as duplicate_occurrences
  ) then
    raise exception using message = 'duplicate_instrumental_source_occurrence';
  end if;

  -- The document lock serializes replacement calls. Lock source rows after it
  -- in stable UUID order so source state cannot race with materialization.
  perform 1
  from public.document_extracted_instrumental_measures
  where document_id = v_document.id
  order by id
  for update;

  select exists (
    select 1
    from public.document_extracted_instrumental_measures
    where document_id = v_document.id
      and snapshot_hash = p_snapshot_hash
  ) into v_snapshot_exists;

  select count(*)
  into v_existing_measure_count
  from public.document_extracted_instrumental_measures
  where document_id = v_document.id
    and snapshot_hash = p_snapshot_hash;

  if v_snapshot_exists and v_existing_measure_count <> v_measure_count then
    raise exception using message = 'instrumental_snapshot_payload_conflict';
  end if;

  for v_measure in select value from jsonb_array_elements(p_measures)
  loop
    v_source_locator := btrim(v_measure ->> 'source_locator');
    v_occurrence_index := (v_measure ->> 'occurrence_index')::integer;
    v_source_page := case
      when jsonb_typeof(v_measure -> 'source_page') = 'number'
        then (v_measure ->> 'source_page')::integer
      else null
    end;
    v_confidence := case
      when jsonb_typeof(v_measure -> 'confidence') = 'number'
        then (v_measure ->> 'confidence')::numeric
      else null
    end;
    -- Keep CASE out of IF conditions: PL/pgSQL treats CASE THEN as IF THEN.
    v_bounding_box := case
      when jsonb_typeof(v_measure -> 'bounding_box') = 'object'
        then v_measure -> 'bounding_box'
      else null
    end;
    v_source_id := null;

    insert into public.document_extracted_instrumental_measures (
      document_id,
      profile_id,
      processing_job_id,
      key_hint,
      name,
      raw_name,
      value,
      raw_value_text,
      unit,
      raw_unit,
      observed_at,
      source_page,
      source_text,
      source_locator,
      occurrence_index,
      bounding_box,
      confidence,
      modality,
      body_region,
      processing_version,
      extraction_model,
      snapshot_hash,
      is_current,
      superseded_at
    )
    values (
      v_document.id,
      v_document.profile_id,
      v_job.id,
      nullif(btrim(v_measure ->> 'key_hint'), ''),
      btrim(v_measure ->> 'name'),
      btrim(v_measure ->> 'raw_name'),
      (v_measure ->> 'value')::numeric,
      btrim(v_measure ->> 'raw_value_text'),
      btrim(v_measure ->> 'unit'),
      btrim(v_measure ->> 'raw_unit'),
      p_study_date,
      v_source_page,
      nullif(btrim(v_measure ->> 'source_text'), ''),
      v_source_locator,
      v_occurrence_index,
      v_bounding_box,
      v_confidence,
      nullif(btrim(p_modality), ''),
      nullif(btrim(p_body_region), ''),
      nullif(btrim(p_processing_version), ''),
      nullif(btrim(p_extraction_model), ''),
      p_snapshot_hash,
      true,
      null
    )
    on conflict (document_id, snapshot_hash, source_locator, occurrence_index) do nothing
    returning id into v_source_id;

    if v_source_id is null then
      select *
      into v_source
      from public.document_extracted_instrumental_measures
      where document_id = v_document.id
        and snapshot_hash = p_snapshot_hash
        and source_locator = v_source_locator
        and occurrence_index = v_occurrence_index
      for update;

      if v_source.profile_id is distinct from v_document.profile_id
        or v_source.key_hint is distinct from nullif(btrim(v_measure ->> 'key_hint'), '')
        or v_source.name is distinct from btrim(v_measure ->> 'name')
        or v_source.raw_name is distinct from btrim(v_measure ->> 'raw_name')
        or v_source.value is distinct from (v_measure ->> 'value')::numeric
        or v_source.raw_value_text is distinct from btrim(v_measure ->> 'raw_value_text')
        or v_source.unit is distinct from btrim(v_measure ->> 'unit')
        or v_source.raw_unit is distinct from btrim(v_measure ->> 'raw_unit')
        or v_source.observed_at is distinct from p_study_date
        or v_source.source_page is distinct from v_source_page
        or v_source.source_text is distinct from nullif(btrim(v_measure ->> 'source_text'), '')
        or v_source.bounding_box is distinct from v_bounding_box
        or v_source.confidence is distinct from v_confidence
        or v_source.modality is distinct from nullif(btrim(p_modality), '')
        or v_source.body_region is distinct from nullif(btrim(p_body_region), '')
        or v_source.processing_version is distinct from nullif(btrim(p_processing_version), '')
        or v_source.extraction_model is distinct from nullif(btrim(p_extraction_model), '') then
        raise exception using message = 'instrumental_snapshot_payload_conflict';
      end if;

      v_source_id := v_source.id;
    end if;

    insert into public.observations (
      profile_id,
      document_id,
      source_instrumental_measure_id,
      name,
      value,
      value_kind,
      value_text,
      unit,
      raw_name,
      raw_value_text,
      raw_unit,
      ref_low,
      ref_high,
      observed_at,
      source_page,
      source_text,
      bounding_box,
      confidence,
      extraction_version,
      observation_kind
    )
    values (
      v_document.profile_id,
      v_document.id,
      v_source_id,
      btrim(v_measure ->> 'name'),
      (v_measure ->> 'value')::numeric,
      'numeric',
      btrim(v_measure ->> 'raw_value_text'),
      btrim(v_measure ->> 'unit'),
      btrim(v_measure ->> 'raw_name'),
      btrim(v_measure ->> 'raw_value_text'),
      btrim(v_measure ->> 'raw_unit'),
      null,
      null,
      p_study_date,
      v_source_page,
      nullif(btrim(v_measure ->> 'source_text'), ''),
      v_bounding_box,
      v_confidence,
      nullif(btrim(p_processing_version), ''),
      'instrumental'
    )
    on conflict (source_instrumental_measure_id) where source_instrumental_measure_id is not null do nothing;

    select *
    into v_observation
    from public.observations
    where source_instrumental_measure_id = v_source_id
    for update;

    if v_observation.id is null
      or v_observation.profile_id is distinct from v_document.profile_id
      or v_observation.document_id is distinct from v_document.id
      or v_observation.observation_kind is distinct from 'instrumental'
      or v_observation.source_extracted_biomarker_id is not null
      or v_observation.normalization_revision_id is not null
      or v_observation.analyte_key is not null
      or v_observation.measurement_definition_key is not null then
      raise exception using message = 'instrumental_observation_lineage_conflict';
    end if;
  end loop;

  -- New source/observation rows exist before this state transition. Any
  -- exception above rolls back both them and the prior current snapshot.
  update public.document_extracted_instrumental_measures
  set is_current = false,
      superseded_at = now()
  where document_id = v_document.id
    and is_current
    and snapshot_hash is distinct from p_snapshot_hash;

  update public.document_extracted_instrumental_measures
  set is_current = true,
      superseded_at = null
  where document_id = v_document.id
    and snapshot_hash = p_snapshot_hash;

  return query
  select
    source.id,
    observation.id,
    v_snapshot_exists
  from public.document_extracted_instrumental_measures as source
  join public.observations as observation
    on observation.source_instrumental_measure_id = source.id
  where source.document_id = v_document.id
    and source.snapshot_hash = p_snapshot_hash
  order by source.source_locator, source.occurrence_index, source.id;
end;
$$;

revoke all on function public.replace_document_instrumental_observations(
  uuid, uuid, text, date, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_document_instrumental_observations(
  uuid, uuid, text, date, text, text, text, text, jsonb
) to service_role;
