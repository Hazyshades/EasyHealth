## 1. Schema: observations identity + value kinds

- [x] 1.1 Migration: add `value_kind`, nullable `value`, `value_text`, `ordinal` with CHECK constraints for numeric vs non-numeric
- [x] 1.2 Migration: add `specimen`, `modifier` with defaults; backfill from key prefixes/catalog (`urine_*` → urine)
- [x] 1.3 Migration: add observation provenance columns (`raw_name`, `source_page`, `source_text`, `bounding_box`, `confidence`, `reported_alt_value`, `reported_alt_unit`)
- [x] 1.4 Detect duplicate `(profile_id, biomarker_key, observed_at)` after backfill; merge/resolve before unique swap
- [x] 1.5 Drop old unique; add `unique (profile_id, biomarker_key, observed_at, specimen, modifier)`
- [x] 1.6 Migration: extend `document_extracted_biomarkers` with specimen, modifier, reported_alt_*, value_kind if missing alignment

## 2. Qualitative observations path

- [x] 2.1 Shared parsers: map dipstick strings → value_kind + optional ordinal; keep raw value_text
- [x] 2.2 Update extraction prompts/pipeline to emit qualitative rows (stop skipping Negative/Positive)
- [x] 2.3 Update `acceptExtractedBiomarkers` to accept text-only rows; copy provenance; set specimen/modifier
- [x] 2.4 Update upsert `onConflict` to new unique columns
- [x] 2.5 Catalog qualitative urine keys as display (or extended non-score) with specimen urine
- [x] 2.6 Unit tests: accept qualitative, reject empty, ordinal mapping, numeric still works

## 3. Specialty biomarker catalog (display-only)

- [x] 3.1 Add catalog modules/entries: hormones, tumor markers, coagulation, cardiac acute, autoimmune (aliases EN+RU)
- [x] 3.2 Force `scoreRole: display` and system `general` (or tags only); document never-core rule
- [x] 3.3 Filter `buildHealthProfile` / scoring: skip display role and non-numeric kinds for state_score and coverage
- [x] 3.4 Biomarkers API/UI list specialty markers factually without diagnostic labels
- [x] 3.5 Optional: report context includes specialty values factually when present
- [x] 3.6 Tests: PSA/troponin/hormone do not affect system scores

## 4. Extraction provenance + OCR schema

- [x] 4.1 Document and implement `PageOcrArtifact` schema_version 1 writer in worker OCR path
- [x] 4.2 Ensure extract rows persist raw_name, source_page, source_text, bbox, confidence, dual-unit alts
- [x] 4.3 Copy provenance fields on accept into observations
- [x] 4.4 Review UI: show value_text, page, snippet; enable accept for qualitative
- [x] 4.5 Document viewer/list uses value_text when numeric null
- [x] 4.6 Tests or fixtures for OCR artifact shape + extract qualitative + provenance accept

## 5. API and UI identity

- [x] 5.1 TypeScript types for Observation include value_kind, value_text, specimen, modifier, provenance
- [x] 5.2 Biomarkers page: text values, specimen/modifier chips, chart rules for non-numeric
- [x] 5.3 Health profile API payload includes new fields; scoring exclusions enforced server-side
- [x] 5.4 Latest-by-key aggregation uses `(key, specimen, modifier)` identity

## 6. Verification

- [x] 6.1 Staging migration dry-run on copy of prod-like data
- [x] 6.2 Typecheck/build; acceptance + health-profile regression tests
- [x] 6.3 Manual QA: urine dipstick PDF, hormone panel, same-day serum+urine, dual-unit line, specialty not on body-map score
