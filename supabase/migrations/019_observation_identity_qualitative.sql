-- Qualitative values, specimen/modifier identity, provenance on observations + extract rows

-- ── observations: value kinds ─────────────────────────────────────
alter table public.observations
  alter column value drop not null;

alter table public.observations
  add column if not exists value_kind text not null default 'numeric',
  add column if not exists value_text text,
  add column if not exists ordinal int,
  add column if not exists specimen text not null default 'unspecified',
  add column if not exists modifier text not null default 'none',
  add column if not exists raw_name text,
  add column if not exists source_page int,
  add column if not exists source_text text,
  add column if not exists bounding_box jsonb,
  add column if not exists confidence numeric,
  add column if not exists reported_alt_value numeric,
  add column if not exists reported_alt_unit text;

alter table public.observations
  drop constraint if exists observations_value_kind_check;

alter table public.observations
  add constraint observations_value_kind_check
  check (value_kind in ('numeric', 'qualitative', 'ordinal', 'text'));

alter table public.observations
  drop constraint if exists observations_value_presence_check;

alter table public.observations
  add constraint observations_value_presence_check
  check (
    (value_kind = 'numeric' and value is not null)
    or (value_kind <> 'numeric' and value_text is not null and length(trim(value_text)) > 0)
  );

-- Backfill specimen from key prefixes
update public.observations
set specimen = 'urine'
where specimen = 'unspecified'
  and (
    biomarker_key like 'urine_%'
    or biomarker_key in ('uacr', 'upcr', 'specific_gravity')
  );

-- Prefer one row when old unique would still hold; resolve rare true dups before swap
-- (same key+date already unique under old constraint, so no merge needed for that pair)

alter table public.observations
  drop constraint if exists observations_profile_id_biomarker_key_observed_at_key;

alter table public.observations
  drop constraint if exists observations_profile_biomarker_date_unique;

-- Postgres default name for UNIQUE (profile_id, biomarker_key, observed_at)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.observations'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%biomarker_key%observed_at%'
      and pg_get_constraintdef(oid) not like '%specimen%'
  ) then
    execute (
      select 'alter table public.observations drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.observations'::regclass
        and contype = 'u'
        and pg_get_constraintdef(oid) like '%biomarker_key%observed_at%'
        and pg_get_constraintdef(oid) not like '%specimen%'
      limit 1
    );
  end if;
end $$;

alter table public.observations
  add constraint observations_identity_unique
  unique (profile_id, biomarker_key, observed_at, specimen, modifier);

create index if not exists observations_profile_key_specimen
  on public.observations (profile_id, biomarker_key, specimen, modifier, observed_at);

-- ── document_extracted_biomarkers alignment ───────────────────────
alter table public.document_extracted_biomarkers
  add column if not exists value_kind text,
  add column if not exists ordinal int,
  add column if not exists specimen text,
  add column if not exists modifier text,
  add column if not exists reported_alt_value numeric,
  add column if not exists reported_alt_unit text;

comment on column public.observations.value_kind is
  'numeric | qualitative | ordinal | text';
comment on column public.observations.specimen is
  'serum | plasma | whole_blood | urine | other | unspecified';
comment on column public.observations.modifier is
  'none | fasting | random | free | total | direct | absolute | percent | ...';
