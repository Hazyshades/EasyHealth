# Tasks

## 1. Source region contract

- [x] 1.1 Add `src/lib/documents/source-region.ts` defining the normalized `SourceRegion` shape, its origins, and `parseSourceRegion` as the single validation and canonicalization gate for every `bounding_box` read and write.
- [x] 1.2 Reject pixel and PDF-point rectangles, non-positive or fractional pages, non-finite and degenerate geometry, and unknown schema versions, while clamping the sub-percent overhang that OCR engines legitimately produce.
- [x] 1.3 Add `sourceRegionMatchesPage` so a region is never rendered or copied onto a page it was not measured against.
- [x] 1.4 Type `InstrumentalMeasureMaterializationInput.bounding_box` as `SourceRegion | null` instead of a free-form object, and bump `OBSERVATION_PROVENANCE_SCHEMA_VERSION` to `2`.

## 2. Page index and provenance adapter

- [x] 2.1 Add `src/lib/documents/pdf-text-layout.ts` parsing `pdftotext -bbox-layout` output into per-page word geometry normalized against the page box, with a plain-text page split fallback.
- [x] 2.2 Add `buildPageMarkedText` and `pageMarker` so extraction input announces every page boundary to the model.
- [x] 2.3 Add `src/lib/documents/source-region-match.ts` that rebuilds each page into visual reading rows, matches an extracted snippet back to real words, and returns the grounded page plus a region or an explicit page-only fallback.
- [x] 2.4 Degrade to page-only provenance for ambiguous, absent, too-short, tied, and geometrically implausible matches, and report which strategy produced the result.

## 3. Worker pipeline

- [x] 3.1 Replace `extractPdfText` with `extractPdfPageIndex` in `worker/src/previews.ts`, requesting word geometry from poppler and falling back to plain per-page text when the layout pass yields nothing.
- [x] 3.2 Write one page OCR artifact per page with normalized `blocks` and an explicit `coordinate_space`, and store real per-page `ocr_text`, replacing the page-1-only artifact.
- [x] 3.3 Pass page-marked text to classification and every extraction stage so `source_page` is read from the input rather than guessed.
- [x] 3.4 Ground laboratory rows, instrumental findings, and instrumental measures through the adapter before persistence, leaving the EH-105 `source_locator` untouched.
- [x] 3.5 Remove `bounding_box` from the instrumental extraction prompt and route any model-supplied region through the contract parser.

## 4. Persistence and read boundaries

- [x] 4.1 Add migration `044_eh118_observation_source_region.sql` with `eh118_is_source_region(jsonb)` mirroring the TypeScript parser.
- [x] 4.2 Clear pre-contract regions on `observations`, `document_extracted_biomarkers`, and `document_extracted_instrumental_measures`, suspending the write-once guard only for that corrective statement.
- [x] 4.3 Constrain each table so a stored region is contract-valid and its page equals the row's `source_page`, and reject non-positive page indexes.
- [x] 4.4 Require a source page on every observation created from a document extraction, added `NOT VALID` and validated in the same migration when no legacy row violates it.
- [x] 4.5 Copy a region onto an observation only when it satisfies the contract and belongs to the recorded source page in `observation-normalization-writer.ts`.
- [x] 4.6 Return `bounding_box` from the document bootstrap select and `source_page`, `source_text`, and the validated region from the observations API.

## 5. Review workspace (on top of EH-117)

- [x] 5.1 Add `src/components/documents/source-highlight-overlay.tsx` as a presentational, ref-forwarding highlight positioned in percentages of the page image.
- [x] 5.2 Fill EH-117's reserved `"region"` precision: `resolveSourceLocation` accepts the bounding box, validates it against the contract and the row's page, and carries the geometry on `ReviewRowSourceLocation`.
- [x] 5.3 Thread `bounding_box` through `buildExtractedReviewRow` and `buildObservationReviewRow` so both row kinds report the same provenance descriptor.
- [x] 5.4 Wrap the page preview in `DocumentSourcePane` in an image-sized container that carries the zoom transform so the overlay stays aligned across zoom and viewport width.
- [x] 5.5 Render the three provenance states explicitly under the preview: region highlighted, page only with the exact region unavailable, and source page not recorded; mark page-only rows in the review list.
- [x] 5.6 Give preview scrolling a single owner: the overlay never calls `scrollIntoView`, `DocumentSourcePane` scrolls only its own container, and `ObservationReviewList` keeps its list-scoped row scroll.
- [x] 5.7 Show page navigation and zoom controls whenever page previews exist, including for PDFs.

## 6. QA, verification, and handoff

- [x] 6.1 Add `scripts/verify-eh118-source-region-contract.ts` covering the accepted shape, every rejection, clamping, page coherence, and the database and writer enforcement points.
- [x] 6.2 Add `scripts/verify-eh118-provenance-adapter.ts` covering layout parsing, page markers, snippet grounding, page-hint correction, every page-only fallback, and the column-major table regression that made table rows lose their highlight.
- [x] 6.3 Add `supabase/tests/eh118_observation_source_region.sql` asserting the contract function, the three region constraints, the source-page requirement, and that provenance stays write-once.
- [x] 6.4 Register `test:eh118`, `test:eh118-db`, `smoke:eh118-page-index`, and `smoke:eh118-overlay`, and run the new suites in the CI verify and database jobs.
- [x] 6.5 Create QA/eh-118/checklist.md with tester-facing preconditions, safe test data, numbered UI actions and observable expected results, plus separate developer evidence for the migration, constraint, and alignment assertions.
- [x] 6.6 Assert the single-scroll-owner split and the `region` / `page` / `document` precision ladder in the EH-118 suite so neither can regress silently.
