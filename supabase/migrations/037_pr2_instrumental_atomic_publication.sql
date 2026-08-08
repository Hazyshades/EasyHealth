-- PR2 (make-instrumental-publication-atomic), publication core:
-- immutable snapshot content, publication attempts/history, authoritative
-- current pointer, database-authoritative canonicalization v2, populated
-- legacy backfill, the findings compatibility view, and the service-only
-- prepare/finalize/cleanup/purge RPCs.
--
-- Replaces EH-105's publish-on-materialize RPC. Publication of measures,
-- findings, impression, summary, document completion, job/attempt completion,
-- and synthesis invalidation now share one finalizer transaction.

-- ---------------------------------------------------------------------------
-- 1. Snapshot content, publication history, current pointer
-- ---------------------------------------------------------------------------

create table if not exists public.document_instrumental_snapshot_contents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  profile_id uuid not null,
  canonicalization_version text not null
    check (canonicalization_version in ('legacy-v1', 'eh105.instrumental-snapshot.v2')),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  canonical_payload jsonb not null,
  study_date date not null,
  modality text,
  body_region text,
  facility_name text,
  impression text,
  processing_version text,
  extraction_model text,
  created_at timestamptz not null default now(),
  constraint document_instrumental_snapshot_contents_dedup_unique
    unique (document_id, canonicalization_version, snapshot_hash),
  constraint document_instrumental_snapshot_contents_id_owner_unique
    unique (id, profile_id, document_id),
  constraint document_instrumental_snapshot_contents_document_owner_fk
    foreign key (document_id, profile_id)
    references public.documents (id, profile_id)
    on delete restrict
);

comment on table public.document_instrumental_snapshot_contents is
  'PR2 immutable instrumental snapshot content, deduplicated by (document, canonicalization version, hash). Content never carries publication state and is never mutated. facility_name is part of the canonical hash; documents.lab_name projects from the current content.';

create index if not exists document_instrumental_snapshot_contents_document
  on public.document_instrumental_snapshot_contents (document_id, created_at desc);

create table if not exists public.document_instrumental_publications (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  profile_id uuid not null,
  snapshot_content_id uuid not null,
  processing_attempt_id uuid,
  captured_write_generation bigint,
  state text not null default 'prepared'
    check (state in ('prepared', 'current', 'superseded', 'abandoned')),
  summary_text text,
  summary_hash text,
  completion_payload jsonb,
  publication_digest text,
  prepared_at timestamptz not null default now(),
  published_at timestamptz,
  superseded_at timestamptz,
  abandoned_at timestamptz,
  constraint document_instrumental_publications_id_owner_unique
    unique (id, profile_id, document_id),
  constraint document_instrumental_publications_document_owner_fk
    foreign key (document_id, profile_id)
    references public.documents (id, profile_id)
    on delete restrict,
  constraint document_instrumental_publications_content_owner_fk
    foreign key (snapshot_content_id, profile_id, document_id)
    references public.document_instrumental_snapshot_contents (id, profile_id, document_id)
    on delete restrict,
  constraint document_instrumental_publications_attempt_owner_fk
    foreign key (processing_attempt_id, profile_id, document_id)
    references public.document_processing_attempts (id, profile_id, document_id)
    on delete restrict,
  -- Only backfilled legacy history may lack attempt ownership.
  constraint document_instrumental_publications_attempt_presence
    check (processing_attempt_id is not null or state in ('current', 'superseded'))
);

comment on table public.document_instrumental_publications is
  'PR2 publication attempts/history for instrumental snapshot content. prepared -> current -> superseded, or prepared -> abandoned; superseded and abandoned are terminal. Summary belongs to the publication event, not to content.';

create unique index if not exists document_instrumental_publications_one_current_per_document
  on public.document_instrumental_publications (document_id)
  where state = 'current';

create unique index if not exists document_instrumental_publications_one_prepared_per_attempt
  on public.document_instrumental_publications (processing_attempt_id)
  where state = 'prepared';

create index if not exists document_instrumental_publications_document_state
  on public.document_instrumental_publications (document_id, state, prepared_at desc);

create index if not exists document_instrumental_publications_content
  on public.document_instrumental_publications (snapshot_content_id);

create table if not exists public.document_instrumental_current_publication (
  document_id uuid primary key,
  profile_id uuid not null,
  publication_id uuid not null unique,
  snapshot_content_id uuid not null,
  write_generation bigint not null default 0 check (write_generation >= 0),
  updated_at timestamptz not null default now(),
  constraint document_instrumental_current_publication_document_owner_fk
    foreign key (document_id, profile_id)
    references public.documents (id, profile_id)
    on delete restrict,
  constraint document_instrumental_current_publication_publication_fk
    foreign key (publication_id, profile_id, document_id)
    references public.document_instrumental_publications (id, profile_id, document_id)
    on delete restrict,
  constraint document_instrumental_current_publication_content_fk
    foreign key (snapshot_content_id, profile_id, document_id)
    references public.document_instrumental_snapshot_contents (id, profile_id, document_id)
    on delete restrict
);

comment on table public.document_instrumental_current_publication is
  'PR2 authoritative one-current pointer per instrumental document. The findings compatibility view and every structured reader resolve current content through this relation.';

alter table public.document_instrumental_snapshot_contents enable row level security;
alter table public.document_instrumental_publications enable row level security;
alter table public.document_instrumental_current_publication enable row level security;

drop policy if exists "service_select_document_instrumental_snapshot_contents"
  on public.document_instrumental_snapshot_contents;
drop policy if exists "service_select_document_instrumental_publications"
  on public.document_instrumental_publications;
drop policy if exists "service_select_document_instrumental_current_publication"
  on public.document_instrumental_current_publication;

create policy "service_select_document_instrumental_snapshot_contents"
  on public.document_instrumental_snapshot_contents for select to service_role using (true);
create policy "service_select_document_instrumental_publications"
  on public.document_instrumental_publications for select to service_role using (true);
create policy "service_select_document_instrumental_current_publication"
  on public.document_instrumental_current_publication for select to service_role using (true);

revoke all on table public.document_instrumental_snapshot_contents from public, anon, authenticated;
revoke all on table public.document_instrumental_publications from public, anon, authenticated;
revoke all on table public.document_instrumental_current_publication from public, anon, authenticated;
grant select on table public.document_instrumental_snapshot_contents to service_role;
grant select on table public.document_instrumental_publications to service_role;
grant select on table public.document_instrumental_current_publication to service_role;

-- Content children: link existing immutable source measures to content.
alter table public.document_extracted_instrumental_measures
  add column if not exists snapshot_content_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.document_extracted_instrumental_measures'::regclass
      and conname = 'document_extracted_instrumental_measures_content_owner_fk'
  ) then
    alter table public.document_extracted_instrumental_measures
      add constraint document_extracted_instrumental_measures_content_owner_fk
      foreign key (snapshot_content_id, profile_id, document_id)
      references public.document_instrumental_snapshot_contents (id, profile_id, document_id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists document_extracted_instrumental_measures_content
  on public.document_extracted_instrumental_measures (snapshot_content_id);

-- ---------------------------------------------------------------------------
-- 2. Canonicalization v2, validation, and database-authoritative hashing
-- ---------------------------------------------------------------------------

create or replace function public.pr2_is_normalized_text(p text)
returns boolean
language sql
immutable
as $$
  select p is not null and btrim(p) = p and p <> '';
$$;

-- Validates the structured snapshot payload for prepare. Rejects rather than
-- normalizes: the caller must send btrim-normalized strings and explicit
-- nulls so worker-side and database-side canonical bytes agree.
create or replace function public.pr2_validate_instrumental_snapshot(p_snapshot jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_measure jsonb;
  v_finding jsonb;
  v_field text;
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object' then
    raise exception using message = 'invalid_instrumental_snapshot_payload';
  end if;

  if p_snapshot ->> 'study_date' is null
    or (p_snapshot ->> 'study_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using message = 'instrumental_study_date_required';
  end if;
  -- Reject impossible calendar dates early.
  perform (p_snapshot ->> 'study_date')::date;

  foreach v_field in array
    array['modality', 'body_region', 'facility_name', 'impression', 'processing_version', 'extraction_model']
  loop
    if p_snapshot ? v_field
      and jsonb_typeof(p_snapshot -> v_field) not in ('null', 'string') then
      raise exception using message = 'invalid_instrumental_snapshot_payload';
    end if;
    if jsonb_typeof(p_snapshot -> v_field) = 'string'
      and not public.pr2_is_normalized_text(p_snapshot ->> v_field) then
      raise exception using message = 'instrumental_snapshot_text_not_normalized';
    end if;
  end loop;

  if jsonb_typeof(p_snapshot -> 'measures') is distinct from 'array'
    or jsonb_typeof(p_snapshot -> 'findings') is distinct from 'array' then
    raise exception using message = 'invalid_instrumental_snapshot_payload';
  end if;

  for v_measure in select value from jsonb_array_elements(p_snapshot -> 'measures')
  loop
    if jsonb_typeof(v_measure) <> 'object'
      or jsonb_typeof(v_measure -> 'value') <> 'number'
      or jsonb_typeof(v_measure -> 'name') <> 'string'
      or not public.pr2_is_normalized_text(v_measure ->> 'name')
      or jsonb_typeof(v_measure -> 'raw_name') <> 'string'
      or not public.pr2_is_normalized_text(v_measure ->> 'raw_name')
      or jsonb_typeof(v_measure -> 'raw_value_text') <> 'string'
      or not public.pr2_is_normalized_text(v_measure ->> 'raw_value_text')
      or jsonb_typeof(v_measure -> 'unit') <> 'string'
      or btrim(v_measure ->> 'unit') is distinct from (v_measure ->> 'unit')
      or jsonb_typeof(v_measure -> 'raw_unit') <> 'string'
      or btrim(v_measure ->> 'raw_unit') is distinct from (v_measure ->> 'raw_unit')
      or jsonb_typeof(v_measure -> 'source_locator') <> 'string'
      or not public.pr2_is_normalized_text(v_measure ->> 'source_locator')
      or jsonb_typeof(v_measure -> 'occurrence_index') <> 'number'
      or (v_measure ->> 'occurrence_index') !~ '^\d+$'
      or jsonb_typeof(v_measure -> 'key_hint') not in ('null', 'string')
      or (jsonb_typeof(v_measure -> 'key_hint') = 'string'
        and not public.pr2_is_normalized_text(v_measure ->> 'key_hint'))
      or jsonb_typeof(v_measure -> 'source_page') not in ('null', 'number')
      or (jsonb_typeof(v_measure -> 'source_page') = 'number'
        and (v_measure ->> 'source_page') !~ '^[1-9]\d*$')
      or jsonb_typeof(v_measure -> 'source_text') not in ('null', 'string')
      or (jsonb_typeof(v_measure -> 'source_text') = 'string'
        and not public.pr2_is_normalized_text(v_measure ->> 'source_text'))
      or jsonb_typeof(v_measure -> 'bounding_box') not in ('null', 'object')
      or jsonb_typeof(v_measure -> 'confidence') not in ('null', 'number')
      or (jsonb_typeof(v_measure -> 'confidence') = 'number'
        and ((v_measure ->> 'confidence')::numeric < 0 or (v_measure ->> 'confidence')::numeric > 1)) then
      raise exception using message = 'invalid_instrumental_measure_payload';
    end if;
  end loop;

  if exists (
    select 1
    from (
      select 1
      from jsonb_array_elements(p_snapshot -> 'measures') as m(value)
      group by m.value ->> 'source_locator', (m.value ->> 'occurrence_index')::integer
      having count(*) > 1
    ) duplicates
  ) then
    raise exception using message = 'duplicate_instrumental_source_occurrence';
  end if;

  for v_finding in select value from jsonb_array_elements(p_snapshot -> 'findings')
  loop
    if jsonb_typeof(v_finding) <> 'object'
      or jsonb_typeof(v_finding -> 'finding_text') <> 'string'
      or not public.pr2_is_normalized_text(v_finding ->> 'finding_text')
      or jsonb_typeof(v_finding -> 'source_page') not in ('null', 'number')
      or (jsonb_typeof(v_finding -> 'source_page') = 'number'
        and (v_finding ->> 'source_page') !~ '^[1-9]\d*$')
      or jsonb_typeof(v_finding -> 'source_text') not in ('null', 'string')
      or (jsonb_typeof(v_finding -> 'source_text') = 'string'
        and not public.pr2_is_normalized_text(v_finding ->> 'source_text'))
      or jsonb_typeof(v_finding -> 'confidence') not in ('null', 'number')
      or (jsonb_typeof(v_finding -> 'confidence') = 'number'
        and ((v_finding ->> 'confidence')::numeric < 0 or (v_finding ->> 'confidence')::numeric > 1)) then
      raise exception using message = 'invalid_instrumental_finding_payload';
    end if;
  end loop;
end;
$$;

-- Canonical v2 payload. Deterministic member order uses byte-wise ("C")
-- collation so the TypeScript mirror can reproduce it exactly. jsonb key
-- ordering and jsonb::text rendering are PostgreSQL-deterministic; the
-- worker mirror replicates that serialization and golden fixtures prove
-- agreement (caller-digest mismatches are rejected in prepare).
create or replace function public.pr2_canonical_instrumental_snapshot(p_snapshot jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'schema', 'eh105.instrumental-snapshot.v2',
    'study_date', p_snapshot ->> 'study_date',
    'modality', p_snapshot -> 'modality',
    'body_region', p_snapshot -> 'body_region',
    'facility_name', p_snapshot -> 'facility_name',
    'impression', p_snapshot -> 'impression',
    'processing_version', p_snapshot -> 'processing_version',
    'extraction_model', p_snapshot -> 'extraction_model',
    'measures', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key_hint', m.value -> 'key_hint',
            'name', m.value -> 'name',
            'raw_name', m.value -> 'raw_name',
            'value', m.value -> 'value',
            'raw_value_text', m.value -> 'raw_value_text',
            'unit', m.value -> 'unit',
            'raw_unit', m.value -> 'raw_unit',
            'source_page', m.value -> 'source_page',
            'source_text', m.value -> 'source_text',
            'source_locator', m.value -> 'source_locator',
            'occurrence_index', m.value -> 'occurrence_index',
            'bounding_box', m.value -> 'bounding_box',
            'confidence', m.value -> 'confidence'
          )
          order by (m.value ->> 'source_locator') collate "C",
            (m.value ->> 'occurrence_index')::integer
        )
        from jsonb_array_elements(p_snapshot -> 'measures') as m(value)
      ),
      '[]'::jsonb
    ),
    'findings', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'finding_text', f.value -> 'finding_text',
            'source_page', f.value -> 'source_page',
            'source_text', f.value -> 'source_text',
            'confidence', f.value -> 'confidence'
          )
          order by (f.value ->> 'finding_text') collate "C",
            (f.value ->> 'source_page')::integer nulls first,
            (f.value ->> 'source_text') collate "C" nulls first,
            (f.value ->> 'confidence') collate "C" nulls first
        )
        from jsonb_array_elements(p_snapshot -> 'findings') as f(value)
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.pr2_instrumental_snapshot_hash(p_canonical jsonb)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(p_canonical::text, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.pr2_instrumental_publication_digest(
  p_publication_id uuid,
  p_snapshot_content_id uuid,
  p_canonicalization_version text,
  p_snapshot_hash text,
  p_summary_text text,
  p_completion jsonb
)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'publication_id', p_publication_id::text,
          'snapshot_content_id', p_snapshot_content_id::text,
          'canonicalization_version', p_canonicalization_version,
          'snapshot_hash', p_snapshot_hash,
          'summary', p_summary_text,
          'completion', coalesce(p_completion, 'null'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Populated-database preflight: abort on anything unprovable
-- ---------------------------------------------------------------------------

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.document_processing_jobs
  where status = 'processing';
  if v_count > 0 then
    raise exception
      'PR2 preflight: % job(s) still processing. Pause and drain instrumental workers before this migration.', v_count;
  end if;

  select count(*) into v_count
  from public.document_extracted_instrumental_measures m
  join public.documents d on d.id = m.document_id
  where m.profile_id is distinct from d.profile_id;
  if v_count > 0 then
    raise exception
      'PR2 preflight: % instrumental measure row(s) with profile ownership mismatch.', v_count;
  end if;

  select count(*) into v_count
  from (
    select m.document_id
    from public.document_extracted_instrumental_measures m
    where m.is_current
    group by m.document_id
    having count(distinct m.snapshot_hash) > 1
  ) ambiguous;
  if v_count > 0 then
    raise exception
      'PR2 preflight: % document(s) with more than one current snapshot hash.', v_count;
  end if;

  select count(*) into v_count
  from (
    select m.document_id
    from public.document_extracted_instrumental_measures m
    group by m.document_id
    having bool_or(m.is_current) = false
  ) headless;
  if v_count > 0 then
    raise exception
      'PR2 preflight: % document(s) with instrumental measures but no current snapshot.', v_count;
  end if;

  select count(*) into v_count
  from (
    select m.document_id, m.snapshot_hash
    from public.document_extracted_instrumental_measures m
    group by m.document_id, m.snapshot_hash
    having count(distinct m.is_current) > 1
      or count(distinct m.observed_at) > 1
      or count(distinct coalesce(m.modality, '')) > 1
      or count(distinct coalesce(m.body_region, '')) > 1
      or count(distinct coalesce(m.processing_version, '')) > 1
      or count(distinct coalesce(m.extraction_model, '')) > 1
  ) inconsistent;
  if v_count > 0 then
    raise exception
      'PR2 preflight: % snapshot group(s) with internally inconsistent measure metadata.', v_count;
  end if;

  select count(*) into v_count
  from public.document_extracted_instrumental_measures m
  where m.is_current
    and not exists (
      select 1 from public.observations o
      where o.source_instrumental_measure_id = m.id
    );
  if v_count > 0 then
    raise exception
      'PR2 preflight: % current instrumental measure(s) without linked observations (pre-EH-105 data). Use the explicitly disposable reset path.', v_count;
  end if;

  select count(*) into v_count
  from public.document_extracted_findings f
  join public.documents d on d.id = f.document_id
  where d.document_type is distinct from 'instrumental_report'
    or f.profile_id is distinct from d.profile_id;
  if v_count > 0 then
    raise exception
      'PR2 preflight: % finding row(s) with non-instrumental or cross-profile ownership.', v_count;
  end if;

  select count(*) into v_count
  from (
    select f.document_id
    from public.document_extracted_findings f
    where f.impression is not null
    group by f.document_id
    having count(distinct f.impression) > 1
  ) multi_impression;
  if v_count > 0 then
    raise exception
      'PR2 preflight: % document(s) with conflicting finding impressions.', v_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Backfill: legacy-v1 content, publication history, current pointer
-- ---------------------------------------------------------------------------

-- 4a. Content rows from measure snapshot groups. The stored EH-105 snapshot
-- hash is the provable identity; the canonical payload records that this is
-- a reconstruction, never a fabricated v2 canonicalization.
insert into public.document_instrumental_snapshot_contents (
  document_id,
  profile_id,
  canonicalization_version,
  snapshot_hash,
  canonical_payload,
  study_date,
  modality,
  body_region,
  facility_name,
  impression,
  processing_version,
  extraction_model,
  created_at
)
select
  g.document_id,
  g.profile_id,
  'legacy-v1',
  g.snapshot_hash,
  jsonb_build_object(
    'schema', 'legacy-v1',
    'reconstructed', true,
    'snapshot_hash', g.snapshot_hash
  ),
  g.study_date,
  g.modality,
  g.body_region,
  case when g.is_current then d.lab_name end,
  case when g.is_current then imp.impression end,
  g.processing_version,
  g.extraction_model,
  g.first_created_at
from (
  select
    m.document_id,
    m.profile_id,
    m.snapshot_hash,
    bool_or(m.is_current) as is_current,
    min(m.observed_at) as study_date,
    min(m.modality) as modality,
    min(m.body_region) as body_region,
    min(m.processing_version) as processing_version,
    min(m.extraction_model) as extraction_model,
    min(m.created_at) as first_created_at
  from public.document_extracted_instrumental_measures m
  group by m.document_id, m.profile_id, m.snapshot_hash
) g
join public.documents d on d.id = g.document_id
left join lateral (
  select max(f.impression) as impression
  from public.document_extracted_findings f
  where f.document_id = g.document_id
    and f.impression is not null
) imp on true;

-- 4b. Findings-only documents (no numeric measures) get reconstructed
-- current content with a deterministic legacy hash.
insert into public.document_instrumental_snapshot_contents (
  document_id,
  profile_id,
  canonicalization_version,
  snapshot_hash,
  canonical_payload,
  study_date,
  modality,
  body_region,
  facility_name,
  impression,
  processing_version,
  extraction_model,
  created_at
)
select
  fg.document_id,
  fg.profile_id,
  'legacy-v1',
  encode(extensions.digest(convert_to('legacy-v1:findings-only:' || fg.document_id::text, 'UTF8'), 'sha256'), 'hex'),
  jsonb_build_object(
    'schema', 'legacy-v1',
    'reconstructed', true,
    'findings_only', true
  ),
  coalesce(d.observed_at, d.processed_at::date, d.created_at::date),
  fg.modality,
  fg.body_region,
  d.lab_name,
  fg.impression,
  fg.processing_version,
  fg.extraction_model,
  fg.first_created_at
from (
  select
    f.document_id,
    f.profile_id,
    min(f.modality) as modality,
    min(f.body_region) as body_region,
    max(f.impression) as impression,
    min(f.processing_version) as processing_version,
    min(f.extraction_model) as extraction_model,
    min(f.created_at) as first_created_at
  from public.document_extracted_findings f
  group by f.document_id, f.profile_id
) fg
join public.documents d on d.id = fg.document_id
where not exists (
  select 1 from public.document_extracted_instrumental_measures m
  where m.document_id = fg.document_id
);

-- 4c. Link measures to their content.
update public.document_extracted_instrumental_measures m
set snapshot_content_id = c.id
from public.document_instrumental_snapshot_contents c
where c.document_id = m.document_id
  and c.canonicalization_version = 'legacy-v1'
  and c.snapshot_hash = m.snapshot_hash
  and m.snapshot_content_id is null;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.document_extracted_instrumental_measures
  where snapshot_content_id is null;
  if v_count > 0 then
    raise exception 'PR2 backfill: % measure row(s) left without snapshot content.', v_count;
  end if;
end;
$$;

alter table public.document_extracted_instrumental_measures
  alter column snapshot_content_id set not null;

-- 4d. Publication history preserving observed state; no fabricated attempts.
insert into public.document_instrumental_publications (
  document_id,
  profile_id,
  snapshot_content_id,
  processing_attempt_id,
  captured_write_generation,
  state,
  summary_text,
  prepared_at,
  published_at,
  superseded_at
)
select
  c.document_id,
  c.profile_id,
  c.id,
  null,
  null,
  case when cur.is_current then 'current' else 'superseded' end,
  case when cur.is_current then d.document_summary end,
  c.created_at,
  c.created_at,
  case when cur.is_current then null else cur.superseded_at end
from public.document_instrumental_snapshot_contents c
join public.documents d on d.id = c.document_id
join lateral (
  select
    coalesce(bool_or(m.is_current), true) as is_current,
    max(m.superseded_at) as superseded_at
  from public.document_extracted_instrumental_measures m
  where m.snapshot_content_id = c.id
) cur on true
where c.canonicalization_version = 'legacy-v1';

-- 4e. Authoritative current pointer at generation 0.
insert into public.document_instrumental_current_publication (
  document_id,
  profile_id,
  publication_id,
  snapshot_content_id,
  write_generation
)
select p.document_id, p.profile_id, p.id, p.snapshot_content_id, 0
from public.document_instrumental_publications p
where p.state = 'current';

-- ---------------------------------------------------------------------------
-- 5. Findings storage rename and the current-only security-invoker view
-- ---------------------------------------------------------------------------

alter table public.document_extracted_findings
  add column if not exists snapshot_content_id uuid,
  add column if not exists ordinal integer;

-- Attach existing rows to their document's current content: the legacy
-- worker rewrote findings on every run, so surviving rows are provably
-- current. Ordinals preserve observed order.
update public.document_extracted_findings f
set snapshot_content_id = cp.snapshot_content_id
from public.document_instrumental_current_publication cp
where cp.document_id = f.document_id
  and f.snapshot_content_id is null;

update public.document_extracted_findings f
set ordinal = ranked.ordinal
from (
  select id, row_number() over (partition by document_id order by created_at, id) - 1 as ordinal
  from public.document_extracted_findings
) ranked
where ranked.id = f.id
  and f.ordinal is null;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.document_extracted_findings
  where snapshot_content_id is null or ordinal is null;
  if v_count > 0 then
    raise exception 'PR2 backfill: % finding row(s) could not be attached to current content.', v_count;
  end if;
end;
$$;

alter table public.document_extracted_findings rename to document_extracted_finding_versions;

alter table public.document_extracted_finding_versions
  alter column snapshot_content_id set not null,
  alter column ordinal set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.document_extracted_finding_versions'::regclass
      and conname = 'document_extracted_finding_versions_content_owner_fk'
  ) then
    alter table public.document_extracted_finding_versions
      add constraint document_extracted_finding_versions_content_owner_fk
      foreign key (snapshot_content_id, profile_id, document_id)
      references public.document_instrumental_snapshot_contents (id, profile_id, document_id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists document_extracted_finding_versions_content_ordinal_unique
  on public.document_extracted_finding_versions (snapshot_content_id, ordinal);

create index if not exists document_extracted_finding_versions_content
  on public.document_extracted_finding_versions (snapshot_content_id);

-- Versioned storage is written only by the SECURITY DEFINER prepare RPC.
drop policy if exists "service_all_document_extracted_findings"
  on public.document_extracted_finding_versions;
create policy "service_select_document_extracted_finding_versions"
  on public.document_extracted_finding_versions for select to service_role using (true);

revoke all on table public.document_extracted_finding_versions from public, anon, authenticated;
revoke insert, update, delete on table public.document_extracted_finding_versions from service_role;
grant select on table public.document_extracted_finding_versions to service_role;

-- Compatibility relation: the legacy PostgREST resource shape, projected
-- from the authoritative current pointer only. security_invoker keeps the
-- caller's privileges and RLS authoritative for the underlying tables.
create view public.document_extracted_findings
with (security_invoker = true)
as
select
  v.id,
  v.document_id,
  v.profile_id,
  v.modality,
  v.body_region,
  v.finding_text,
  v.impression,
  v.source_page,
  v.source_text,
  v.confidence,
  v.extraction_method,
  v.processing_version,
  v.extraction_model,
  'accepted'::text as status,
  v.created_at
from public.document_instrumental_current_publication cp
join public.document_extracted_finding_versions v
  on v.snapshot_content_id = cp.snapshot_content_id
  and v.document_id = cp.document_id
  and v.profile_id = cp.profile_id;

comment on view public.document_extracted_findings is
  'PR2 current-only compatibility relation over document_extracted_finding_versions via the authoritative current-publication pointer. Read-only; removal is deferred to a later gated cleanup after reader cutover.';

revoke all on public.document_extracted_findings from public, anon, authenticated, service_role;
grant select on public.document_extracted_findings to service_role;

-- ---------------------------------------------------------------------------
-- 6. Immutability and transition guards
-- ---------------------------------------------------------------------------

create or replace function public.pr2_reject_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using message = 'instrumental_content_immutable';
end;
$$;

drop trigger if exists document_instrumental_snapshot_contents_immutable
  on public.document_instrumental_snapshot_contents;
create trigger document_instrumental_snapshot_contents_immutable
  before update on public.document_instrumental_snapshot_contents
  for each row execute function public.pr2_reject_mutation();

drop trigger if exists document_extracted_finding_versions_immutable
  on public.document_extracted_finding_versions;
create trigger document_extracted_finding_versions_immutable
  before update on public.document_extracted_finding_versions
  for each row execute function public.pr2_reject_mutation();

create or replace function public.document_instrumental_publications_transition_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.document_id is distinct from old.document_id
    or new.profile_id is distinct from old.profile_id
    or new.snapshot_content_id is distinct from old.snapshot_content_id
    or new.processing_attempt_id is distinct from old.processing_attempt_id
    or new.captured_write_generation is distinct from old.captured_write_generation
    or new.prepared_at is distinct from old.prepared_at then
    raise exception using message = 'instrumental_publication_identity_immutable';
  end if;

  if old.state = 'prepared' and new.state = 'current' then
    return new;
  end if;
  if old.state = 'prepared' and new.state = 'abandoned' then
    return new;
  end if;
  if old.state = 'current' and new.state = 'superseded' then
    return new;
  end if;

  raise exception using message = 'instrumental_publication_invalid_transition';
end;
$$;

drop trigger if exists document_instrumental_publications_transition
  on public.document_instrumental_publications;
create trigger document_instrumental_publications_transition
  before update on public.document_instrumental_publications
  for each row execute function public.document_instrumental_publications_transition_guard();

-- ---------------------------------------------------------------------------
-- 7. Prepare: validate, canonicalize, deduplicate, stage an inactive version
-- ---------------------------------------------------------------------------

create or replace function public.prepare_instrumental_publication(
  p_document_id uuid,
  p_job_id uuid,
  p_processing_attempt_id uuid,
  p_snapshot jsonb,
  p_caller_digest text default null
)
returns table (
  publication_id uuid,
  snapshot_content_id uuid,
  canonicalization_version text,
  snapshot_hash text,
  content_reused boolean,
  publication_reused boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_document public.documents%rowtype;
  v_job public.document_processing_jobs%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
  v_canonical jsonb;
  v_hash text;
  v_content public.document_instrumental_snapshot_contents%rowtype;
  v_publication public.document_instrumental_publications%rowtype;
  v_content_reused boolean := false;
  v_measure jsonb;
  v_finding jsonb;
  v_source_id uuid;
  v_source public.document_extracted_instrumental_measures%rowtype;
  v_observation public.observations%rowtype;
  v_ordinal integer := 0;
  v_study_date date;
begin
  -- Lock DAG: documents -> jobs/attempts -> publication/content rows.
  select * into v_document
  from public.documents
  where id = p_document_id
  for update;

  if v_document.id is null then
    raise exception using message = 'instrumental_document_not_found';
  end if;
  if v_document.document_type is distinct from 'instrumental_report' then
    raise exception using message = 'instrumental_document_type_mismatch';
  end if;

  select * into v_job
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

  select * into v_attempt
  from public.document_processing_attempts
  where id = p_processing_attempt_id
  for update;

  if v_attempt.id is null
    or v_attempt.job_id is distinct from v_job.id
    or v_attempt.document_id is distinct from v_document.id
    or v_attempt.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_attempt_ownership_mismatch';
  end if;
  if v_attempt.state is distinct from 'active' then
    raise exception using message = 'processing_attempt_not_active';
  end if;
  if v_attempt.captured_write_generation is distinct from v_document.write_generation then
    raise exception using message = 'processing_attempt_generation_mismatch';
  end if;

  perform public.pr2_validate_instrumental_snapshot(p_snapshot);
  v_canonical := public.pr2_canonical_instrumental_snapshot(p_snapshot);
  v_hash := public.pr2_instrumental_snapshot_hash(v_canonical);
  v_study_date := (p_snapshot ->> 'study_date')::date;

  if p_caller_digest is not null and p_caller_digest is distinct from v_hash then
    raise exception using message = 'instrumental_snapshot_digest_mismatch';
  end if;

  -- Serialize content decisions for this document.
  perform 1
  from public.document_instrumental_snapshot_contents
  where document_id = v_document.id
  order by id
  for update;

  select * into v_content
  from public.document_instrumental_snapshot_contents
  where document_id = v_document.id
    and canonicalization_version = 'eh105.instrumental-snapshot.v2'
    and snapshot_hash = v_hash;

  if v_content.id is not null then
    -- Hash equality alone is never trusted: require exact canonical bytes.
    if v_content.canonical_payload::text is distinct from v_canonical::text then
      raise exception using message = 'instrumental_snapshot_payload_conflict';
    end if;
    v_content_reused := true;
  else
    insert into public.document_instrumental_snapshot_contents (
      document_id,
      profile_id,
      canonicalization_version,
      snapshot_hash,
      canonical_payload,
      study_date,
      modality,
      body_region,
      facility_name,
      impression,
      processing_version,
      extraction_model
    )
    values (
      v_document.id,
      v_document.profile_id,
      'eh105.instrumental-snapshot.v2',
      v_hash,
      v_canonical,
      v_study_date,
      p_snapshot ->> 'modality',
      p_snapshot ->> 'body_region',
      p_snapshot ->> 'facility_name',
      p_snapshot ->> 'impression',
      p_snapshot ->> 'processing_version',
      p_snapshot ->> 'extraction_model'
    )
    returning * into v_content;

    -- Immutable source occurrences and observation identity are created with
    -- the content, but stay invisible: is_current flips only at finalize.
    for v_measure in select value from jsonb_array_elements(p_snapshot -> 'measures')
    loop
      insert into public.document_extracted_instrumental_measures (
        document_id,
        profile_id,
        processing_job_id,
        snapshot_content_id,
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
        v_content.id,
        v_measure ->> 'key_hint',
        v_measure ->> 'name',
        v_measure ->> 'raw_name',
        (v_measure ->> 'value')::numeric,
        v_measure ->> 'raw_value_text',
        v_measure ->> 'unit',
        v_measure ->> 'raw_unit',
        v_study_date,
        (v_measure ->> 'source_page')::integer,
        v_measure ->> 'source_text',
        v_measure ->> 'source_locator',
        (v_measure ->> 'occurrence_index')::integer,
        case when jsonb_typeof(v_measure -> 'bounding_box') = 'object' then v_measure -> 'bounding_box' end,
        (v_measure ->> 'confidence')::numeric,
        p_snapshot ->> 'modality',
        p_snapshot ->> 'body_region',
        p_snapshot ->> 'processing_version',
        p_snapshot ->> 'extraction_model',
        v_hash,
        false,
        null
      )
      returning id into v_source_id;

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
        v_measure ->> 'name',
        (v_measure ->> 'value')::numeric,
        'numeric',
        v_measure ->> 'raw_value_text',
        v_measure ->> 'unit',
        v_measure ->> 'raw_name',
        v_measure ->> 'raw_value_text',
        v_measure ->> 'raw_unit',
        null,
        null,
        v_study_date,
        (v_measure ->> 'source_page')::integer,
        v_measure ->> 'source_text',
        case when jsonb_typeof(v_measure -> 'bounding_box') = 'object' then v_measure -> 'bounding_box' end,
        (v_measure ->> 'confidence')::numeric,
        p_snapshot ->> 'processing_version',
        'instrumental'
      );
    end loop;

    -- Immutable finding versions in canonical order; the content-level
    -- impression is mirrored onto ordinal 0 for the compatibility shape.
    for v_finding in
      select value
      from jsonb_array_elements(p_snapshot -> 'findings') as f(value)
      order by (f.value ->> 'finding_text') collate "C",
        (f.value ->> 'source_page')::integer nulls first,
        (f.value ->> 'source_text') collate "C" nulls first,
        (f.value ->> 'confidence') collate "C" nulls first
    loop
      insert into public.document_extracted_finding_versions (
        document_id,
        profile_id,
        snapshot_content_id,
        ordinal,
        modality,
        body_region,
        finding_text,
        impression,
        source_page,
        source_text,
        confidence,
        extraction_method,
        processing_version,
        extraction_model,
        status
      )
      values (
        v_document.id,
        v_document.profile_id,
        v_content.id,
        v_ordinal,
        p_snapshot ->> 'modality',
        p_snapshot ->> 'body_region',
        v_finding ->> 'finding_text',
        case when v_ordinal = 0 then p_snapshot ->> 'impression' end,
        (v_finding ->> 'source_page')::integer,
        v_finding ->> 'source_text',
        (v_finding ->> 'confidence')::numeric,
        'llm',
        p_snapshot ->> 'processing_version',
        p_snapshot ->> 'extraction_model',
        'accepted'
      );
      v_ordinal := v_ordinal + 1;
    end loop;

    if v_ordinal = 0 and p_snapshot ->> 'impression' is not null then
      insert into public.document_extracted_finding_versions (
        document_id,
        profile_id,
        snapshot_content_id,
        ordinal,
        modality,
        body_region,
        finding_text,
        impression,
        source_page,
        source_text,
        confidence,
        extraction_method,
        processing_version,
        extraction_model,
        status
      )
      values (
        v_document.id,
        v_document.profile_id,
        v_content.id,
        0,
        p_snapshot ->> 'modality',
        p_snapshot ->> 'body_region',
        p_snapshot ->> 'impression',
        p_snapshot ->> 'impression',
        null,
        null,
        null,
        'llm',
        p_snapshot ->> 'processing_version',
        p_snapshot ->> 'extraction_model',
        'accepted'
      );
    end if;
  end if;

  -- Same-hash behavior is publication-state specific.
  select * into v_publication
  from public.document_instrumental_publications
  where document_id = v_document.id
    and snapshot_content_id = v_content.id
    and state = 'prepared'
    and processing_attempt_id = v_attempt.id;

  if v_publication.id is not null then
    return query select
      v_publication.id, v_content.id, v_content.canonicalization_version,
      v_content.snapshot_hash, v_content_reused, true;
    return;
  end if;

  -- Another live attempt owning a preparation is impossible under the
  -- one-active-attempt rule, but reject deterministically as defense.
  if exists (
    select 1
    from public.document_instrumental_publications p
    join public.document_processing_attempts a on a.id = p.processing_attempt_id
    where p.document_id = v_document.id
      and p.state = 'prepared'
      and a.state = 'active'
      and a.id is distinct from v_attempt.id
  ) then
    raise exception using message = 'instrumental_preparation_concurrent';
  end if;

  insert into public.document_instrumental_publications (
    document_id,
    profile_id,
    snapshot_content_id,
    processing_attempt_id,
    captured_write_generation,
    state
  )
  values (
    v_document.id,
    v_document.profile_id,
    v_content.id,
    v_attempt.id,
    v_attempt.captured_write_generation,
    'prepared'
  )
  returning * into v_publication;

  return query select
    v_publication.id, v_content.id, v_content.canonicalization_version,
    v_content.snapshot_hash, v_content_reused, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Finalize: one transaction for publication + completion + synthesis
-- ---------------------------------------------------------------------------

create or replace function public.finalize_instrumental_publication(
  p_document_id uuid,
  p_job_id uuid,
  p_processing_attempt_id uuid,
  p_publication_id uuid,
  p_snapshot_content_id uuid,
  p_canonicalization_version text,
  p_snapshot_hash text,
  p_summary_text text,
  p_completion jsonb
)
returns table (
  publication_id uuid,
  write_generation bigint,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_document public.documents%rowtype;
  v_job public.document_processing_jobs%rowtype;
  v_attempt public.document_processing_attempts%rowtype;
  v_publication public.document_instrumental_publications%rowtype;
  v_prior public.document_instrumental_publications%rowtype;
  v_pointer public.document_instrumental_current_publication%rowtype;
  v_content public.document_instrumental_snapshot_contents%rowtype;
  v_digest text;
  v_generation bigint;
begin
  if p_completion is not null and jsonb_typeof(p_completion) is distinct from 'object' then
    raise exception using message = 'invalid_completion_payload';
  end if;

  -- Lock DAG: documents -> jobs/attempts -> pointer/publication/content -> synthesis.
  select * into v_document
  from public.documents
  where id = p_document_id
  for update;

  if v_document.id is null then
    raise exception using message = 'instrumental_document_not_found';
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if v_job.id is null
    or v_job.document_id is distinct from v_document.id
    or v_job.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'instrumental_job_document_profile_mismatch';
  end if;

  select * into v_attempt
  from public.document_processing_attempts
  where id = p_processing_attempt_id
  for update;

  if v_attempt.id is null
    or v_attempt.job_id is distinct from v_job.id
    or v_attempt.document_id is distinct from v_document.id
    or v_attempt.profile_id is distinct from v_document.profile_id then
    raise exception using message = 'processing_attempt_ownership_mismatch';
  end if;

  select * into v_pointer
  from public.document_instrumental_current_publication
  where document_id = v_document.id
  for update;

  select * into v_publication
  from public.document_instrumental_publications
  where id = p_publication_id
  for update;

  if v_publication.id is null
    or v_publication.document_id is distinct from v_document.id
    or v_publication.profile_id is distinct from v_document.profile_id
    or v_publication.processing_attempt_id is distinct from v_attempt.id then
    raise exception using message = 'instrumental_publication_ownership_mismatch';
  end if;
  if v_publication.snapshot_content_id is distinct from p_snapshot_content_id then
    raise exception using message = 'instrumental_publication_binding_mismatch';
  end if;

  select * into v_content
  from public.document_instrumental_snapshot_contents
  where id = v_publication.snapshot_content_id
  for update;

  if v_content.canonicalization_version is distinct from p_canonicalization_version
    or v_content.snapshot_hash is distinct from p_snapshot_hash then
    raise exception using message = 'instrumental_publication_binding_mismatch';
  end if;

  v_digest := public.pr2_instrumental_publication_digest(
    v_publication.id,
    v_content.id,
    v_content.canonicalization_version,
    v_content.snapshot_hash,
    p_summary_text,
    p_completion
  );

  -- Idempotent replay of the committed result: no writes, no generation bump.
  if v_publication.state = 'current' then
    if v_attempt.state = 'completed'
      and v_pointer.publication_id = v_publication.id then
      if v_publication.publication_digest is distinct from v_digest then
        raise exception using message = 'instrumental_publication_digest_conflict';
      end if;
      return query select v_publication.id, v_document.write_generation, true;
      return;
    end if;
    raise exception using message = 'instrumental_publication_invalid_state';
  end if;

  if v_publication.state is distinct from 'prepared' then
    raise exception using message = 'instrumental_publication_invalid_state';
  end if;
  if v_attempt.state is distinct from 'active' then
    raise exception using message = 'processing_attempt_not_active';
  end if;
  if v_job.status is distinct from 'processing' then
    raise exception using message = 'processing_job_not_processing';
  end if;
  if v_attempt.captured_write_generation is distinct from v_document.write_generation then
    raise exception using message = 'processing_attempt_generation_mismatch';
  end if;

  -- Lock content children in stable id order before state transitions.
  perform 1 from public.document_extracted_instrumental_measures
  where document_id = v_document.id
  order by id
  for update;
  perform 1 from public.document_extracted_finding_versions
  where document_id = v_document.id
  order by id
  for update;

  -- Supersede the prior current publication.
  if v_pointer.publication_id is not null then
    select * into v_prior
    from public.document_instrumental_publications
    where id = v_pointer.publication_id
    for update;

    update public.document_instrumental_publications
    set state = 'superseded',
        superseded_at = now()
    where id = v_prior.id;
  end if;

  -- Activate the target publication with its summary and digest binding.
  update public.document_instrumental_publications
  set state = 'current',
      published_at = now(),
      summary_text = p_summary_text,
      summary_hash = case
        when p_summary_text is null then null
        else encode(extensions.digest(convert_to(p_summary_text, 'UTF8'), 'sha256'), 'hex')
      end,
      completion_payload = p_completion,
      publication_digest = v_digest
  where id = v_publication.id;

  -- Content epoch advances exactly once per newly-advanced current publication.
  update public.documents
  set write_generation = write_generation + 1
  where id = v_document.id
  returning documents.write_generation into v_generation;

  -- Advance the authoritative pointer.
  insert into public.document_instrumental_current_publication (
    document_id, profile_id, publication_id, snapshot_content_id, write_generation, updated_at
  )
  values (v_document.id, v_document.profile_id, v_publication.id, v_content.id, v_generation, now())
  on conflict (document_id) do update
  set publication_id = excluded.publication_id,
      snapshot_content_id = excluded.snapshot_content_id,
      write_generation = excluded.write_generation,
      updated_at = excluded.updated_at;

  -- Legacy measure projection stays equal to the current pointer.
  update public.document_extracted_instrumental_measures
  set is_current = false,
      superseded_at = now()
  where document_id = v_document.id
    and snapshot_content_id is distinct from v_content.id
    and is_current;

  update public.document_extracted_instrumental_measures
  set is_current = true,
      superseded_at = null
  where document_id = v_document.id
    and snapshot_content_id = v_content.id
    and not is_current;

  -- Document projections equal the committed current publication.
  update public.documents
  set processing_status = 'ready',
      status = 'completed',
      document_summary = p_summary_text,
      observed_at = v_content.study_date,
      modality = v_content.modality,
      lab_name = v_content.facility_name,
      processing_version = v_content.processing_version,
      extraction_model = v_content.extraction_model,
      processed_at = now(),
      processing_error = null,
      page_count = coalesce((p_completion ->> 'page_count')::integer, page_count),
      thumbnail_storage_path = coalesce(p_completion ->> 'thumbnail_storage_path', thumbnail_storage_path),
      ocr_status = coalesce(p_completion ->> 'ocr_status', ocr_status),
      extraction_status = coalesce(p_completion ->> 'extraction_status', extraction_status),
      detected_document_type = case
        when p_completion ? 'detected_document_type' then nullif(p_completion ->> 'detected_document_type', '')
        else detected_document_type
      end,
      type_mismatch_warning = coalesce((p_completion ->> 'type_mismatch_warning')::boolean, type_mismatch_warning),
      type_mismatch_reason = case
        when p_completion ? 'type_mismatch_reason' then nullif(p_completion ->> 'type_mismatch_reason', '')
        else type_mismatch_reason
      end
  where id = v_document.id;

  -- Job and attempt complete in the same commit.
  update public.document_processing_jobs
  set status = 'completed',
      error = null,
      finished_at = now()
  where id = v_job.id;

  update public.document_processing_attempts
  set state = 'completed',
      terminal_at = now(),
      terminal_reason = null
  where id = v_attempt.id;

  -- Synthesis invalidation shares the commit (locked after publication per DAG).
  delete from public.profile_health_synthesis
  where profile_id = v_document.profile_id;

  return query select v_publication.id, v_generation, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Conservative orphan-preparation cleanup
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_orphan_instrumental_preparations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate record;
  v_publication public.document_instrumental_publications%rowtype;
  v_attempt_state text;
  v_abandoned integer := 0;
begin
  for v_candidate in
    select p.id, p.document_id
    from public.document_instrumental_publications p
    join public.document_processing_attempts a on a.id = p.processing_attempt_id
    where p.state = 'prepared'
      and a.state <> 'active'
    order by p.document_id, p.id
  loop
    -- Lock DAG: document first, then re-validate under lock.
    perform 1 from public.documents where id = v_candidate.document_id for update;

    select * into v_publication
    from public.document_instrumental_publications
    where id = v_candidate.id
    for update;

    if v_publication.id is null or v_publication.state <> 'prepared' then
      continue;
    end if;

    select state into v_attempt_state
    from public.document_processing_attempts
    where id = v_publication.processing_attempt_id;

    if v_attempt_state is null or v_attempt_state = 'active' then
      continue;
    end if;

    update public.document_instrumental_publications
    set state = 'abandoned',
        abandoned_at = now()
    where id = v_publication.id;

    v_abandoned := v_abandoned + 1;
  end loop;

  return v_abandoned;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Controlled purge for the existing document-deletion path
-- ---------------------------------------------------------------------------

-- The composite ownership FKs deny silent cascade. The document DELETE route
-- calls this before deleting the documents row; durable deletion (PR 3)
-- replaces this with its constrained finalizer.
create or replace function public.purge_document_instrumental_publication_state(
  p_document_id uuid
)
returns table (
  deleted_publications integer,
  deleted_contents integer,
  deleted_measures integer,
  deleted_finding_versions integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publications integer;
  v_contents integer;
  v_measures integer;
  v_versions integer;
begin
  perform 1 from public.documents where id = p_document_id for update;

  delete from public.document_instrumental_current_publication
  where document_id = p_document_id;

  delete from public.document_instrumental_publications
  where document_id = p_document_id;
  get diagnostics v_publications = row_count;

  delete from public.document_extracted_finding_versions
  where document_id = p_document_id;
  get diagnostics v_versions = row_count;

  -- Observations cascade from their source measure rows.
  delete from public.document_extracted_instrumental_measures
  where document_id = p_document_id;
  get diagnostics v_measures = row_count;

  delete from public.document_instrumental_snapshot_contents
  where document_id = p_document_id;
  get diagnostics v_contents = row_count;

  return query select v_publications, v_contents, v_measures, v_versions;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10b. Explicitly guarded disposable reset / reprocess path
-- ---------------------------------------------------------------------------
-- Retained environments must abort on preflight ambiguity. Disposable
-- environments may call this RPC only after process-level allow flags are set
-- by the CLI (`EH105_PR2_DISPOSABLE` + `EH105_PR2_ALLOW_RESET`). It clears
-- instrumental publication state so documents can be reprocessed cleanly; it
-- never invents semantic repairs or fabricated history.

create or replace function public.pr2_reset_instrumental_publication_state(
  p_confirm_disposable_reset boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  document_row record;
  document_count integer := 0;
  total_publications integer := 0;
  total_contents integer := 0;
  total_measures integer := 0;
  total_finding_versions integer := 0;
  purge_result record;
begin
  if p_confirm_disposable_reset is not true then
    raise exception using message = 'pr2_reset_not_allowed';
  end if;

  for document_row in
    select distinct d.id
    from public.documents d
    where d.document_type = 'instrumental_report'
       or exists (
         select 1 from public.document_extracted_instrumental_measures m
         where m.document_id = d.id
       )
       or exists (
         select 1 from public.document_instrumental_snapshot_contents c
         where c.document_id = d.id
       )
       or exists (
         select 1 from public.document_instrumental_publications p
         where p.document_id = d.id
       )
    order by d.id
  loop
    select * into purge_result
    from public.purge_document_instrumental_publication_state(document_row.id);

    delete from public.document_processing_attempts
    where document_id = document_row.id;

    update public.document_processing_jobs
    set status = 'failed',
        finished_at = coalesce(finished_at, now()),
        error = coalesce(error, 'pr2 disposable reset')
    where document_id = document_row.id
      and status in ('queued', 'processing');

    update public.documents
    set processing_status = 'failed',
        processing_error = coalesce(processing_error, 'pr2 disposable reset; reprocess required'),
        document_summary = null,
        write_generation = write_generation -- keep epoch; content was purged
    where id = document_row.id;

    document_count := document_count + 1;
    total_publications := total_publications + coalesce(purge_result.deleted_publications, 0);
    total_contents := total_contents + coalesce(purge_result.deleted_contents, 0);
    total_measures := total_measures + coalesce(purge_result.deleted_measures, 0);
    total_finding_versions := total_finding_versions + coalesce(purge_result.deleted_finding_versions, 0);
  end loop;

  return jsonb_build_object(
    'status', 'reset_complete',
    'documents_reset', document_count,
    'deleted_publications', total_publications,
    'deleted_contents', total_contents,
    'deleted_measures', total_measures,
    'deleted_finding_versions', total_finding_versions,
    'next', 'reprocess instrumental documents after EH105_PR2 allow flags'
  );
end;
$$;

comment on function public.pr2_reset_instrumental_publication_state(boolean) is
  'Disposable-only PR2 instrumental publication reset. Requires p_confirm_disposable_reset=true after process env checks. Clears publication/content/measures/finding versions via purge; does not invent history.';

-- ---------------------------------------------------------------------------
-- 11. Grants and legacy RPC removal
-- ---------------------------------------------------------------------------

revoke all on function public.pr2_is_normalized_text(text) from public, anon, authenticated;
revoke all on function public.pr2_validate_instrumental_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.pr2_canonical_instrumental_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.pr2_instrumental_snapshot_hash(jsonb) from public, anon, authenticated;
revoke all on function public.pr2_instrumental_publication_digest(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.pr2_reject_mutation() from public, anon, authenticated;
revoke all on function public.document_instrumental_publications_transition_guard() from public, anon, authenticated;

revoke all on function public.prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text) to service_role;

revoke all on function public.finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) to service_role;

revoke all on function public.cleanup_orphan_instrumental_preparations() from public, anon, authenticated;
grant execute on function public.cleanup_orphan_instrumental_preparations() to service_role;

revoke all on function public.purge_document_instrumental_publication_state(uuid) from public, anon, authenticated;
grant execute on function public.purge_document_instrumental_publication_state(uuid) to service_role;

revoke all on function public.pr2_reset_instrumental_publication_state(boolean) from public, anon, authenticated;
grant execute on function public.pr2_reset_instrumental_publication_state(boolean) to service_role;

-- The publish-on-materialize path is retired; worker/reader inventory in this
-- change confirms the worker was its only caller.
drop function if exists public.replace_document_instrumental_observations(
  uuid, uuid, text, date, text, text, text, text, jsonb
);

-- PostgREST schema cache pickup for the recreated findings relation.
notify pgrst, 'reload schema';
