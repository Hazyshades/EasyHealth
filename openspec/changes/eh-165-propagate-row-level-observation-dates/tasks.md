## 1. Date helper and writer row

- [x] 1.1 Add `observationDateFromExtractedRow` using `calendarDateProjection` (row day → document day → null) and add `collected_at` to `ExtractedBiomarkerWriterRow`.
- [x] 1.2 Apply the helper inside `writeExtractedBiomarkerNormalization` and `writeAutomaticBiomarkerVerification` before `baseMeasurementFromWriterRow`.

## 2. Writer call-site SELECTs

- [x] 2.1 Include `collected_at` in accept, confirm, PATCH, batch-verification, and reprocessing SELECTs that feed the writer.
- [x] 2.2 Use the same helper for PATCH `baseMeasurementFromExtractedRow` so EH-119 date edits are relative to the row day.

## 3. Extraction prompt and parser

- [x] 3.1 Update `PIPELINE_EXTRACTION_INSTRUCTIONS` so a biomarker × dated column is a separate candidate, header dates apply, and undated columns stay null.
- [x] 3.2 Add parser/helper coverage for 1×3 dates, 3×3 dates, header-only dates, undated columns, and same-marker same-day upsert identity.

## 4. Verification and QA

- [x] 4.1 Add `scripts/verify-eh165-row-level-observation-dates.ts`, `pnpm test:eh165`, and CI wiring next to `test:eh126`.
- [x] 4.2 Create `QA/eh-165/checklist.md` with history-table accept, undated fallback, trend order, and “re-accept does not auto-delete the old collapsed row”; record DB tests as not applicable.
- [x] 4.3 Run `pnpm test:eh165` and `openspec validate eh-165-propagate-row-level-observation-dates --strict`.
