# Tasks

## 1. Documents: deterministic fixture source and renderer

- [x] 1.1 Create `scripts/fixtures/bilingual-lab-demo-fixtures.ts` with the three canonical collection dates, stable measurement-definition keys, English labels, Registry-supported Spanish labels, values, units, numeric reference bounds, explicit specimen, method, modifier, panel section, and synthetic metadata; verify the manifest covers every score-readiness group and rejects missing or nonnumeric score-critical fields.
- [x] 1.2 Create `scripts/generate-bilingual-lab-demo-fixtures.tsx` using the existing `@react-pdf/renderer` dependency and embedded DejaVu Sans font; verify a staged smoke render produces a valid `%PDF-` document containing accented Spanish text and the synthetic-data disclaimer.
- [x] 1.3 Add the `generate:lab-demo-fixtures` package command and a staging/commit flow that publishes exactly the eight planned paths; verify a second generation from the same manifest produces stable content hashes and no partial target files.
- [x] 1.4 Implement the guarded overwrite policy for `lab_data/chile/original.pdf` and generated outputs; verify the default command refuses to overwrite the existing untracked original and an explicit replacement path is required after inspection.

## 2. Documents: PDF corpus quality and extraction evidence

- [x] 2.1 Render the Spanish multi-date PDF, three Spanish single-date PDFs, English multi-date PDF, and three English single-date PDFs with repeated headers, page numbers, per-row dates, panel headings, specimen/method/modifier fields, and the bilingual synthetic banner; verify every expected file is readable, text-native, and mapped to the intended language and date set.
- [x] 2.2 Verify all Spanish printed labels against the current Registry catalog before publication; verify that unresolved Spanish labels fall back to canonical English rather than introducing a new alias or silently changing the source text.
- [ ] 2.3 Upload the Spanish multi-date document and one English single-date document through the application; verify extraction preserves verbatim raw labels, numeric values, units, document-native reference bounds, page/source text, section context, stated specimen, method, modifier, and row collection dates.
- [x] 2.4 Inspect every generated page for table row continuity, readable accented text, visible synthetic-data labeling, and absence of real-person or real-institution identifiers; verify any layout defect is fixed before the PDFs are published.

## 3. Health Profile and biomarker integration evidence

- [ ] 3.1 Accept and verify the resolved synthetic rows from the uploaded documents; verify incomplete or unsupported rows remain visibly excluded instead of receiving a guessed concrete identity, and verify the Health Profile exposes numeric system scores only for complete usable readiness groups.
- [ ] 3.2 Upload and verify the three single-date reports; verify repeated LDL cholesterol, HbA1c, ALT, creatinine, hemoglobin, and vitamin D rows form compatible biomarker series with dates, native values, units, reference ranges, source filenames, and laboratories retained.
- [ ] 3.3 Create a health report over the three dated documents with a dynamics period spanning `2026-08-01` through `2026-11-01`; verify the report source ledger cites the selected documents and the dynamics extension preserves the uploaded points. Record `not_available` direction as a limitation when no production tolerance is configured, without changing direction policy.

## 4. Repository verification and delivery hygiene

- [x] 4.1 Run the generator, targeted fixture verification, formatting, and TypeScript checks; verify all commands pass with no production Registry, API, migration, or runtime behavior changes.
- [x] 4.2 Review the final diff and untracked-file list; verify only the intended generator/manifest/package-script changes and eight synthetic PDFs are included, while the pre-existing `lab_data/chile/original.pdf` is preserved or explicitly documented if replaced.
- [x] 4.3 Document the manual upload and authenticated Health Profile/report verification results, including blocked evidence when the required application interface or environment is unavailable; verify the handoff does not claim unavailable UI checks passed.

> Manual/UI status: BLOCKED. The repository has no local application environment beyond `.env.example`, so authenticated upload, Health Profile, biomarker history, and report UI flows were not exercised. The production extraction smoke run on the generated English PDF reported `pages indexed: 0` because Poppler (`pdftotext`) is not installed.
>
> Developer evidence: repository PDF text extraction and browser visual checks passed; all 312 English/Spanish/date resolver inputs resolved to their declared Registry keys; `test:eh123`, `test:eh132`, `test:eh149`, `test:eh148-contract`, `test:eh150`, and `test:eh165` passed. Re-run tasks 2.3 and 3.1-3.3 in a configured application/worker environment before claiming manual integration completion.

## Workflow follow-up

- After review and verification, run `$openspec-apply-change` to implement the planned fixture corpus.
- Archive the change only after the generated PDFs and integration evidence are accepted.
