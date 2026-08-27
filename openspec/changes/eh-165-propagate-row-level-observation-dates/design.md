## Context

The worker already writes `document_extracted_biomarkers.collected_at` from extraction (`calendarDateProjection` of the parsed row date). Observation uniqueness is `(profile_id, biomarker_key, observed_at, specimen, modifier)`. Every promotion path currently passes `documents.observed_at` (or its day projection) into `writeExtractedBiomarkerNormalization` / `writeAutomaticBiomarkerVerification` and never SELECTs `collected_at`. `ExtractedBiomarkerWriterRow` has no date field.

The extraction prompt stores `collected_at` when visible but does not tell the model to expand a history table (one analyte, several dated columns) into separate candidates.

EH-126 remains the event-date contract: one medical event per document; `consistentSourceDate` for the event's `collected` role stays consensus-or-unknown. EH-119 measurement `observed_at` overrides remain reviewer restatements of the observation day.

## Goals / Non-Goals

**Goals:**

- Each promoted laboratory value uses its own collected calendar day when the extracted row has one.
- Missing or partial row dates fall back to the document day, then null — never the current day.
- History tables extract one candidate per biomarker × dated column.
- Same marker on the same day still upserts.
- Re-accepting a previously collapsed document does not silently delete the old observation.

**Non-Goals:**

- One medical event per history column.
- Widening `collected_at` from SQL `date` to year/month precision.
- Plotting year-only headers as 1 January.
- Silent rewrite or delete of already-collapsed observations.
- OCR rotation or durable deletion.
- Registry catalog, alias, or resolver identity changes.

## Decisions

### 1. Apply the date at the writer, after SELECT, before uniqueness

Export `observationDateFromExtractedRow(row, documentObservedAt)` from `src/lib/documents/observation-date.ts`. It MUST reuse `calendarDateProjection` so year/month/unknown never become a fabricated day:

1. day-precision `row.collected_at`
2. else day-precision `documentObservedAt`
3. else `null`

`writeExtractedBiomarkerNormalization` and `writeAutomaticBiomarkerVerification` MUST compute this internally from `options.row` + `options.observedAt` and pass the result into `baseMeasurementFromWriterRow`. Callers still pass the document day as the fallback, not as the observation identity.

**Alternative rejected:** only changing accept-route `observedAt`. Confirm, PATCH, batch verification, reprocessing, and automatic verification would keep collapsing history tables.

**Alternative rejected:** changing uniqueness to include extracted-row id. That would duplicate same-day repeats and leave collapsed rows unfixed for new accepts.

### 2. `collected_at` is a writer-row field, not a new RPC argument

Add `collected_at: string | null` to `ExtractedBiomarkerWriterRow`. Every SELECT that feeds a writer MUST include `collected_at`:

- `biomarker-acceptance.ts`
- confirm-observations route
- PATCH biomarkers route
- `BATCH_EXTRACTED_BIOMARKER_SELECT`
- Registry reprocessing materialize SELECT
- worker insert `.select()` already returns inserted columns; the type must include `collected_at` so automatic verification can read it

EH-119 override still wins through `applyMeasurementOverride` after the helper runs.

**Alternative rejected:** a new writer option `rowObservedAt` separate from `observedAt`. Two date knobs invite callers to keep passing the document date and ignore the row.

### 3. Prompt expands dated columns; parser stays a projector

Add explicit extraction rules:

- one printed value in a dated column or dated header → one candidate
- header dates apply to the column beneath them
- a column/value without a date keeps `collected_at` null
- do not collapse several dated cells of the same analyte into one candidate

`parsePipelineExtraction` already copies `collected_at` strings. Tests MUST cover the five table shapes by feeding synthetic JSON through the parser and helper, not by calling a live model.

### 4. No migration; no auto-repair of collapsed rows

Existing observations that already share one document day stay. QA MUST tell testers that re-accepting after this change creates correctly dated rows and leaves the old collapsed row unless the tester corrects it through the existing EH-119 flow.

### 5. Evidence is TypeScript + QA; no new DB test

Uniqueness, `collected_at` storage, and nullable `observed_at` already exist (EH-126). This change is application date selection. Record DB tests as not applicable in the QA checklist.

## Risks / Trade-offs

- [ collides with a previously collapsed observation on the document day ] → undated columns still fall back to the document day by design; dated columns no longer collide. Testers must not expect auto-delete of the old row.
- [ model still emits one candidate for a history table ] → prompt + parser tests; extraction quality remains model-dependent. The writer still cannot invent extra years if extraction did not emit them.
- [ year-only headers stay null and several years upsert together ] → same as EH-126; out of scope to invent 1 January.
- [ PATCH correction base uses document date while writer uses row date ] → PATCH validation MUST use the same helper so EH-119 date edits are relative to the row day.

## Migration Plan

1. Ship helper + writer SELECT wiring + prompt.
2. Reprocess or newly extract documents to get per-row `collected_at`.
3. Accept dated rows; uniqueness creates one observation per day.
4. Rollback: revert the application change; stored `collected_at` is unused again. No database rollback.

## Open Questions

None. Issue #184 and EH-126 day-projection rules close the remaining product questions.
