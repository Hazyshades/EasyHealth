-- EH-162: canonical source-region payload and exact-only render policy.
--
-- The application parser accepts both this shape and the EH-118 legacy shape.
-- Keeping the legacy branch is intentional: provenance is write-once and old
-- rows must degrade to page-only instead of being silently rewritten.

create or replace function public.eh118_is_source_region(p_region jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  rect jsonb;
  x numeric;
  y numeric;
  w numeric;
  h numeric;
  score numeric;
  strategy text;
begin
  if p_region is null or jsonb_typeof(p_region) <> 'object' then
    return false;
  end if;

  if jsonb_typeof(p_region -> 'schema_version') <> 'number'
    or (p_region ->> 'schema_version') <> '1' then
    return false;
  end if;

  -- Canonical EH-162 payload.
  if (p_region ->> 'coordinate_space') = 'normalized'
    and (p_region ->> 'origin') = 'top-left' then
    if jsonb_typeof(p_region -> 'page') <> 'number'
      or (p_region ->> 'page') !~ '^[1-9][0-9]*$' then
      return false;
    end if;

    if jsonb_typeof(p_region -> 'rects') <> 'array'
      or jsonb_typeof(p_region -> 'match') <> 'object' then
      return false;
    end if;

    strategy := p_region -> 'match' ->> 'strategy';
    if strategy not in ('exact', 'fuzzy', 'ambiguous', 'unresolved') then
      return false;
    end if;

    if jsonb_typeof(p_region -> 'match' -> 'score') <> 'number' then
      return false;
    end if;
    score := (p_region -> 'match' ->> 'score')::numeric;
    if score < 0 or score > 1 then
      return false;
    end if;

    if nullif(btrim(p_region -> 'match' ->> 'engine'), '') is null
      or nullif(btrim(p_region -> 'match' ->> 'resolver_version'), '') is null then
      return false;
    end if;

    if jsonb_array_length(p_region -> 'rects') = 0
      and strategy in ('exact', 'fuzzy') then
      return false;
    end if;

    for rect in select value from jsonb_array_elements(p_region -> 'rects') loop
      if jsonb_typeof(rect) <> 'object'
        or jsonb_typeof(rect -> 'x') <> 'number'
        or jsonb_typeof(rect -> 'y') <> 'number'
        or jsonb_typeof(rect -> 'w') <> 'number'
        or jsonb_typeof(rect -> 'h') <> 'number' then
        return false;
      end if;

      x := (rect ->> 'x')::numeric;
      y := (rect ->> 'y')::numeric;
      w := (rect ->> 'w')::numeric;
      h := (rect ->> 'h')::numeric;
      if x < 0 or y < 0 or w <= 0 or h <= 0
        or x + w > 1 or y + h > 1 then
        return false;
      end if;
    end loop;

    return true;
  end if;

  -- Legacy EH-118 payload: normalized x/y/w/h with an origin describing the
  -- derivation. It remains readable, but the UI maps fuzzy/model to page-only.
  if (p_region ->> 'space') is distinct from 'normalized'
    or (p_region ->> 'origin') not in ('ocr_exact', 'ocr_fuzzy', 'model') then
    return false;
  end if;

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
  return x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= 1 and y + h <= 1;
end;
$$;

comment on function public.eh118_is_source_region(jsonb) is
  'EH-162 canonical normalized source region with exact/fuzzy match metadata, plus EH-118 legacy compatibility.';

comment on column public.observations.bounding_box is
  'EH-162 normalized source region with rects and match metadata, or legacy EH-118 geometry/page-only provenance.';
comment on column public.document_extracted_biomarkers.bounding_box is
  'EH-162 normalized source region with deterministic match metadata, or null/page-only provenance.';
comment on column public.document_extracted_instrumental_measures.bounding_box is
  'EH-162 normalized source region with deterministic match metadata, or null/page-only provenance.';
