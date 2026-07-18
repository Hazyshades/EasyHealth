## 1. Aggregation Model

- [x] 1.1 Update `src/lib/health-systems.ts` types to represent current state score, data confidence, marker source metadata, and drawer-ready system details.
- [x] 1.2 Implement deterministic marker scoring for in-range, out-of-range, unknown-reference, and no-data cases with bounded 0-100 output.
- [x] 1.3 Implement separate data confidence calculation from expected marker coverage and available reference ranges.
- [x] 1.4 Add primary source selection logic using marker-to-document relationships, prioritizing out-of-range contributing markers.

## 2. Health Profile API

- [x] 2.1 Update `GET /api/health-profile` document joins so marker entries can include source document id, filename, observed date, and lab name.
- [x] 2.2 Return updated overall and per-system assessment fields while preserving records-used and source-list behavior.
- [x] 2.3 Ensure the endpoint remains deterministic and performs no LLM or report-generation call.
- [x] 2.4 Handle empty profiles and missing document metadata without rendering diagnostic fallback text.

## 3. Profile UI

- [x] 3.1 Update the body map labels from data coverage to current state assessment and display score values without implying disease risk.
- [x] 3.2 Replace or refactor the inline selected-system details panel into a right-side drawer opened by mouse and keyboard selection.
- [x] 3.3 Render drawer header, current state assessment, data confidence, why-highlighted facts, marker data cards, and source document metadata.
- [x] 3.4 Add "Generate report to see insights" CTA that navigates to the existing paid report creation flow.
- [x] 3.5 Keep all user-facing UI strings in English and include educational safety copy plus the standard medical disclaimer.

## 4. Validation

- [x] 4.1 Verify `/app/profile` with no data still shows the upload CTA and no diagnostic or risk labels.
- [x] 4.2 Verify `/app/profile` with completed lab observations shows scores, confidence, source-linked marker facts, and the paid insights CTA.
- [x] 4.3 Verify a newly completed document updates factual profile data on the next API/page load without creating a report.
- [x] 4.4 Run lint/type checks for touched files and fix issues introduced by the change.
