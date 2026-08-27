## 1. Parser and extraction

- [x] 1.1 Add a shared leading-comparator detector and classify comparator+number cells as `value_kind` `text` with verbatim `value_text` and `value` null in `parseLabValueCell`, keeping ordinal `2+` first.
- [x] 1.2 Stop `parsePipelineExtraction` from rescuing comparator cells through `parseLabNumber`; keep `parseLabNumber` stripping only for reference-range bounds.
- [x] 1.3 Update the laboratory extraction prompt so comparators stay on `value` and never on `modifier`.
- [x] 1.4 Coerce punctuation and spelled comparator modifiers to `none` after `inferModifier`.

## 2. Acceptance, correction, and consumers

- [x] 2.1 Make `baseMeasurementFromExtractedRow` prefer printed comparator text over synthesised `value_numeric`.
- [x] 2.2 Show Biomarkers status `Threshold result` for comparator-bearing text and keep the printed value.
- [x] 2.3 Exclude comparator-bearing rows from numeric comparison series.
- [x] 2.4 Exclude comparator-bearing rows from Health Profile laboratory admission even when a stale numeric `value` remains.

## 3. Evidence and documentation

- [x] 3.1 Add `scripts/verify-eh164-censored-results.ts` covering parser, extraction rescue, modifier coercion, correction base, table status, comparison exclusion, and Health Profile admission.
- [x] 3.2 Add `pnpm test:eh164`, wire it into the verify job and `ci/verification-suite-policy.json`.
- [x] 3.3 Add a read-only audit SQL query for already-corrupted extracted and observation rows (no UPDATE).
- [x] 3.4 Add `QA/eh-164/checklist.md` with tester-facing checks and developer evidence, including why DB tests are not applicable.
- [x] 3.5 Sync Registry/biomarker documentation for the censored-value persistence and Health Profile contract; regenerate/check docs and record Wiki/issue status.
- [x] 3.6 Validate the OpenSpec change (`openspec validate eh-164-preserve-censored-lab-results --strict`).
