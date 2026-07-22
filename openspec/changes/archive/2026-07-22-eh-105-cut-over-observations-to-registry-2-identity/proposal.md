## Why

Migration 025 removed the required legacy `observations.biomarker_key` identity, but the instrumental pipeline and maintenance tooling still depend on it. The worker can currently delete a document's prior instrumental observations, ignore a failed replacement insert, and mark the document completed; using an extraction-model-generated `measure.key` as a replacement identity would also collapse legitimate repeated measures.

EH-105 must complete the pre-launch observation identity cutover with a stable, occurrence-aware source identity for instrumental measures before EH-106 moves laboratory runtime consumers to Registry 2.0. This preserves raw clinical evidence without inventing a laboratory semantic identity.

## What Changes

- Add an immutable, document-owned source record for every extracted instrumental numeric measure, with a stable ID, source/occurrence context, and explicit reprocess/supersede behavior.
- Make an instrumental observation idempotent by its instrumental source-record ID rather than by `biomarker_key`, document date, or model-generated measure key.
- Consolidate the observation identity contract: laboratory rows retain `source_extracted_biomarker_id`; instrumental rows use the new instrumental source ID; semantic Registry 2.0 links remain nullable where no laboratory definition applies.
- Replace all active instrumental writers and maintenance scripts that read or write `observations.biomarker_key`; require Supabase write errors to stop completion and preserve/retry safely.
- Expose `observation_kind` through document and health-profile DTO boundaries and prevent instrumental observations from being treated as laboratory biomarkers for laboratory assessment.
- Add clean-database migration, reset, static legacy-column checks, and integration coverage for instrumental extraction, duplicate-looking measures, reprocess, and write failure.
- **BREAKING** Require active observation readers and writers to use explicit source lineage and `observation_kind`; clients may no longer infer that every observation is a laboratory biomarker.

## Capabilities

### New Capabilities

- `instrumental-measure-lineage`: Stable, occurrence-aware source identity and reprocessing lifecycle for extracted instrumental numeric measures.

### Modified Capabilities

- `observation-identity`: Define source-owned identity for both laboratory and instrumental observations without legacy biomarker-key persistence identity.
- `instrumental-observations`: Replace legacy key-based instrumental inserts and reprocess replacement with source-record-based, error-safe behavior.
- `document-worker-reliability`: Require durable observation writes before a worker completes a document or job.
- `documents-api`: Return observation kind and source-safe observation data in document detail/read endpoints.
- `health-profile-api`: Keep instrumental rows out of laboratory aggregation and assessment while preserving an explicit typed boundary for later EH-106 consumer work.

## Impact

- **Database:** a new instrumental extraction source table, instrumental source FK/uniqueness on `observations`, and a clean-database migration path; migration 025 is not repeated.
- **Worker and tooling:** `worker/src/pipeline.ts`, instrumental extraction types, direct `observations` writers, and `scripts/backfill-biomarker-aliases.mjs` must stop using the removed column and surface Supabase errors.
- **Read APIs:** document observation DTOs and the health-profile aggregation must use `observation_kind` rather than assuming a laboratory record.
- **Verification:** database and worker integration tests, a reset gate, and a scoped static check for active runtime/tooling references to `observations.biomarker_key`.
- **Roadmap boundaries:** EH-105 does not implement EH-104 Phase B enforcement, EH-106 acceptance/correction CAS cutover or full consumer migration, EH-112 incomplete-outcome UX, or a standalone observation kind.
