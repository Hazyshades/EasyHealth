## 1. Documents API and Review State

- [x] 1.1 Add regression coverage proving the document detail bootstrap distinguishes an extracted-biomarker query error from a successful empty collection.
- [x] 1.2 Update `GET /api/documents/[id]` error handling so review-data failures are surfaced and cannot enable an empty-data fallback confirmation.
- [x] 1.3 Add a guarded observations-only confirmation server action that validates session ownership, `needs_review` status, submitted document-linked observation IDs, and the absence of current reviewable extracted rows.
- [x] 1.4 Ensure observations-only confirmation updates only document lifecycle status and does not insert, upsert, relink, normalize, or otherwise mutate observations.
- [x] 1.5 Add API tests for successful recovery confirmation, foreign/mismatched observation rejection, non-`needs_review` rejection, extraction-query failure, and the race where current extracted candidates appear before confirmation.

## 2. Document Viewer

- [x] 2.1 Add component/view-model regression tests reproducing a `needs_review` bootstrap with empty `extracted_biomarkers` and populated `observations`.
- [x] 2.2 Replace status-driven `pipelineMode` source selection with explicit `extracted-review`, `observations-fallback`, `review-error`, and `empty` panel states based on bootstrap data.
- [x] 2.3 Preserve extracted-row selection, provenance navigation, normalization details, and the existing `Accept selected` flow when current extracted biomarkers are available.
- [x] 2.4 Render linked observations with clear already-stored-result copy and a `Confirm biomarkers` recovery action when the document is `needs_review` and no current extracted rows exist.
- [x] 2.5 Render an explicit review-data error or no-biomarkers inconsistency state with Reprocess available and confirmation disabled when no safe actionable source exists.
- [x] 2.6 Soft-refresh bootstrap data after either confirmation mode and verify the panel title, rows, controls, and document status reconcile without blanking the preview.

## 3. Regression Verification

- [x] 3.1 Verify ready and legacy documents with observations continue to display biomarkers without review controls.
- [x] 3.2 Verify documents containing both extracted biomarkers and observations prefer current extracted rows and expose only the extracted acceptance flow.
- [x] 3.3 Run the focused document viewer and API test suites, TypeScript type checking, linting, and the production build.
- [x] 3.4 Manually verify the reported `needs_review` payload shapes: extracted candidates, observations-only fallback, empty data, and review-data error.
