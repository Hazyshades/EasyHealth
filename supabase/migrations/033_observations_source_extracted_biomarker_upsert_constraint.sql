-- PostgREST can target a table-level UNIQUE constraint for an upsert, but it
-- cannot infer the former partial unique index as an ON CONFLICT target.
-- PostgreSQL UNIQUE constraints already allow multiple NULL values, so this
-- preserves the intended lineage invariant without excluding legacy rows.

alter table public.observations
  drop constraint if exists observations_source_extracted_biomarker_unique;

drop index if exists public.observations_source_extracted_biomarker_unique;

alter table public.observations
  add constraint observations_source_extracted_biomarker_unique
  unique (source_extracted_biomarker_id);
