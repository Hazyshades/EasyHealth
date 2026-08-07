-- EH-118: link every extracted observation to a source page and, when the page
-- index can ground it, to a source region.
--
-- EH-103 added the provenance columns but left `bounding_box` shapeless: any
-- JSON object was accepted, so a pixel-space or model-invented rectangle could
-- be stored and later rendered in the wrong place. Provenance is write-once, so
-- a bad region is permanent. This migration makes the normalized source-region
-- contract a database invariant, requires a page for document-sourced
-- observations, and rejects non-positive page indexes.

-- ── source region contract ──
-- Mirrors parseSourceRegion() in src/lib/documents/source-region.ts.
-- plpgsql (not sql) so the type guards run before the numeric casts.
create or replace function public.eh118_is_source_region(p_region jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  x numeric;
  y numeric;
  w numeric;
  h numeric;
begin
  if p_region is null or jsonb_typeof(p_region) <> 'object' then
    return false;
  end if;

  if jsonb_typeof(p_region -> 'schema_version') <> 'number'
    or (p_region ->> 'schema_version') <> '1' then
    return false;
  end if;

  if (p_region ->> 'space') is distinct from 'normalized' then
    return false;
  end if;

  if (p_region ->> 'origin') not in ('ocr_exact', 'ocr_fuzzy', 'model') then
    return false;
  end if;

  -- A 1-based integer page. Rejects 0, negatives, and fractional encodings.
  if jsonb_typeof(p_region -> 'page') <> 'number'
    or (p_region ->> 'page') !~ '^[1-9][0-9]*$' then
    return false;
  end if;

  if jsonb_typeof(p_region -> 'x') <> 'number'
    or jsonb_typeof(p_region -> 'y') <> 'number'
    or jsonb_typeof(p_region -> 'w') <> 'number'
    or jsonb_typeof(p_region -> 'h') <> 'number' then
    return false;
  end if;

  x := (p_region ->> 'x')::numeric;
  y := (p_region ->> 'y')::numeric;
  w := (p_region ->> 'w')::numeric;
  h := (p_region ->> 'h')::numeric;

  -- Normalized page fractions only. Pixel or PDF-point coordinates land far
  -- outside this box and must never reach a renderer.
  return x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= 1 and y + h <= 1;
end;
$$;

comment on function public.eh118_is_source_region(jsonb) is
  'EH-118 source region contract: normalized page fractions, 1-based page, known origin.';

-- ── drop regions that predate the contract ──
-- Nothing in the current pipeline writes a lab region, and instrumental regions
-- were unvalidated model output. Clearing them restores the page-only fallback
-- instead of preserving a rectangle that cannot be trusted.
update public.document_extracted_biomarkers
  set bounding_box = null
  where bounding_box is not null
    and not public.eh118_is_source_region(bounding_box);

update public.document_extracted_instrumental_measures
  set bounding_box = null
  where bounding_box is not null
    and not public.eh118_is_source_region(bounding_box);

-- Provenance on observations is write-once; the guard is suspended for this
-- one corrective statement and restored immediately afterwards.
alter table public.observations disable trigger observation_provenance_write_once;

update public.observations
  set bounding_box = null
  where bounding_box is not null
    and not (
      public.eh118_is_source_region(bounding_box)
      and source_page is not null
      and (bounding_box ->> 'page') = source_page::text
    );

alter table public.observations enable trigger observation_provenance_write_once;

-- ── page index invariants ──
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'observations_source_page_positive'
  ) then
    alter table public.observations
      add constraint observations_source_page_positive
      check (source_page is null or source_page >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'extracted_biomarkers_source_page_positive'
  ) then
    alter table public.document_extracted_biomarkers
      add constraint extracted_biomarkers_source_page_positive
      check (source_page is null or source_page >= 1);
  end if;
end;
$$;

-- ── source region invariants ──
-- A region is only renderable on the page it was measured against, so the
-- region page and the row page must agree.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'observations_source_region_valid'
  ) then
    alter table public.observations
      add constraint observations_source_region_valid
      check (
        bounding_box is null
        or (
          public.eh118_is_source_region(bounding_box)
          and source_page is not null
          and (bounding_box ->> 'page') = source_page::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'extracted_biomarkers_source_region_valid'
  ) then
    alter table public.document_extracted_biomarkers
      add constraint extracted_biomarkers_source_region_valid
      check (
        bounding_box is null
        or (
          public.eh118_is_source_region(bounding_box)
          and source_page is not null
          and (bounding_box ->> 'page') = source_page::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'instrumental_measures_source_region_valid'
  ) then
    alter table public.document_extracted_instrumental_measures
      add constraint instrumental_measures_source_region_valid
      check (
        bounding_box is null
        or (
          public.eh118_is_source_region(bounding_box)
          and source_page is not null
          and (bounding_box ->> 'page') = source_page::text
        )
      );
  end if;
end;
$$;

-- ── every document-sourced observation links to a page ──
-- Added NOT VALID so a database that predates EH-118 still enforces the rule on
-- every new write; it is validated immediately when no legacy row violates it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'observations_document_source_page_present'
  ) then
    alter table public.observations
      add constraint observations_document_source_page_present
      check (
        (source_extracted_biomarker_id is null and source_instrumental_measure_id is null)
        or source_page is not null
      )
      not valid;
  end if;

  if not exists (
    select 1
    from public.observations
    where source_page is null
      and (source_extracted_biomarker_id is not null or source_instrumental_measure_id is not null)
  ) then
    alter table public.observations
      validate constraint observations_document_source_page_present;
  end if;
end;
$$;

comment on column public.observations.bounding_box is
  'EH-118 normalized source region, or null for page-only provenance.';
comment on column public.observations.source_page is
  'EH-118 1-based source page; required for observations sourced from a document extraction.';
comment on column public.document_extracted_biomarkers.bounding_box is
  'EH-118 normalized source region derived from the OCR page index, or null.';
comment on column public.document_extracted_instrumental_measures.bounding_box is
  'EH-118 normalized source region derived from the OCR page index, or null.';
