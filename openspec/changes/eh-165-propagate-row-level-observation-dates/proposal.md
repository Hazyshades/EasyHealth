## Why

Laboratory history tables already persist a per-row `document_extracted_biomarkers.collected_at`, but every acceptance writer stamps `documents.observed_at` instead. Distinct years then share one uniqueness key `(profile, key, observed_at, specimen, modifier)` and upsert into a single observation — data loss, not a chart cosmetic. EH-129 trends and EH-126 chronology are only truthful if each extracted value keeps its own collected day.

## What Changes

- Add a pure day-precision helper `observationDateFromExtractedRow(row, documentObservedAt)`: row `collected_at` → document `observed_at` → null. Never invent today. Year/month-only values stay null (EH-126 `calendarDateProjection`).
- Thread `collected_at` onto `ExtractedBiomarkerWriterRow` and every writer SELECT/call site: accept, confirm, PATCH, batch verification, Registry reprocessing, automatic verification. An EH-119 `observed_at` measurement override still wins.
- Tell the extraction model that a biomarker × dated column is a separate candidate; header dates apply; a column without a date stays null.
- Add parser/helper fixtures for 1×3 dates, 3×3 dates, header-only dates, undated columns, and same-marker same-day upserts.
- Add `scripts/verify-eh165-row-level-observation-dates.ts`, `pnpm test:eh165`, CI wiring, and `QA/eh-165/checklist.md` including that re-accept does not auto-delete an already-collapsed observation.

## Capabilities

### New Capabilities

- `row-level-observation-dates`: Per-extracted-row observation day selection, history-table candidate expansion, and uniqueness-preserving promotion of dated laboratory values.

### Modified Capabilities

- None. Existing main specs do not own observation day selection or history-table candidate expansion; EH-126 event dates remain one medical event per document.

## Impact

- **Target domain:** `documents` (extraction prompt/parser, normalization writer, acceptance/confirm/PATCH/batch-verification/reprocessing/automatic verification).
- **Database:** no schema change. `collected_at` already exists. Observation uniqueness is unchanged; truthful dates make it work. No silent rewrite/delete of already-collapsed observations.
- **Application/worker:** writer day input becomes row-first; extraction prompt expands dated columns; medical-event `consistentSourceDate` for `collected` stays consensus-or-unknown.
- **Compatibility:** same marker on the same day still upserts. EH-119 date overrides remain authoritative. Partial `YYYY` / `YYYY-MM` still do not project to 1 January.
- **Verification:** TypeScript contract tests for the helper, parser table shapes, writer date wiring, `pnpm test:eh165`, and QA checklist. Database tests are not applicable: no new persistence contract. Registry documentation sync is not applicable: catalog, aliases, resolver identity, and Health Profile laboratory projection are unchanged.
