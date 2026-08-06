-- #106: record clinical axes the extraction model supplied without document
-- evidence.
--
-- The resolver must never see an unstated axis, so extraction now drops it to
-- the storage default. Discarding it silently would lose the only signal that
-- answers "how often, and on which axes, does the extractor fabricate" — which
-- is the data a future reviewed panel policy needs, and the signal that would
-- have surfaced this defect far earlier.
--
-- Strictly non-authoritative. Never read by the resolver, never copied onto
-- observations, never part of identity or the decision trace. Additive and
-- nullable, so no backfill and no constraint change.

alter table public.document_extracted_biomarkers
  add column if not exists inferred_axes jsonb;

comment on column public.document_extracted_biomarkers.inferred_axes is
  'EH #106 observability only: clinical axes the extraction model supplied without document evidence, discarded before resolution. Never authoritative.';

notify pgrst, 'reload schema';
