# EH-118: See where each result came from in the document

**Roadmap status:** Delivered  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

In the document review screen, every result says which page it came from. When
the app can pinpoint the exact line, selecting the result draws a highlight box
around that line in the document preview on the left. When it cannot pinpoint
the line — for example a scanned document with no selectable text — the result
is marked **page only**, the preview opens the right page, and the app says the
exact region is unavailable instead of guessing a location. A result with no
page at all says that too.

This builds on the EH-117 split-view review screen: document preview on the
left, list of results on the right.

Documents processed before this change keep the page they were originally given
and show no highlight until they are reprocessed.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
  intentionally tests processing.
- [ ] Upload the documents fresh for this run, or use **Reprocess document** on
  them, so they go through the new extraction.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH118-DOC-01` | `lab_data/sample_lab_report_english_mock.pdf` — a two-page synthetic lab report with selectable text | Normal path: page link plus exact highlight |
| `EH118-DOC-02` | A scan or photo of a synthetic lab report saved as PDF or JPEG, with no selectable text | Fallback path: page link, no highlight |
| `EH118-DOC-03` | A synthetic instrumental report (for example an ECG or ultrasound summary) with selectable text | Findings and measures link to their page |
| `EH118-DOC-04` | `EH118-DOC-01` uploaded before this release and left unprocessed since | Older document keeps working |

## Interface checks

### EH118-UI-01: A result highlights the exact line it came from

**Precondition:** `EH118-DOC-01` has finished processing and the review screen
lists its results.

1. Go to **Documents** and open `EH118-DOC-01`.
2. In the results list on the right, find a result labelled **Page 1** that is
   **not** marked **page only** — for example **Hemoglobin (HGB)**.
3. Click the result.

**Expected result:** The preview on the left shows page 1, brings the
highlighted area into view, and draws a coloured box around the row in the
document containing that result's name and value. Under the preview it reads
**Page 1**, the quoted source text, and **The source region is highlighted on
the page.** The box must sit on the correct row — not on a neighbouring row and
not offset from the text.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-02: The highlight stays on the text when you zoom

**Precondition:** You have just completed EH118-UI-01 and the highlight is
visible.

1. Click **Zoom in** twice.
2. Scroll the preview so the highlight is visible again.
3. Click **Zoom out** four times.

**Expected result:** At every zoom level the box still surrounds the same text.
It must not drift away from the text, shrink away from it, or land on a
different row.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-03: Selecting a result does not jerk the page around

**Precondition:** `EH118-DOC-01` is open, and the results list is long enough to
scroll.

1. Scroll the results list on the right so a result near the bottom is visible.
2. Click that result.
3. Watch both panes and the browser window while the selection happens.

**Expected result:** Only two things move: the results list nudges the selected
result into view, and the preview scrolls to bring the highlight into view. The
browser window itself must not jump, and the preview must not scroll twice or
visibly bounce. Repeat with two or three different results and confirm the
motion is the same each time.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-04: A result on page 2 opens page 2

**Precondition:** `EH118-DOC-01` is open and its results are listed.

1. Find a result labelled **Page 2**.
2. Click it.

**Expected result:** The preview switches to page 2 and, if the result is not
marked **page only**, highlights the source there. The page indicator above the
preview shows **Page 2 / 2**.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-05: A scanned document says the exact region is unavailable

**Precondition:** `EH118-DOC-02` has finished processing and lists at least one
result.

1. Open `EH118-DOC-02`.
2. Click any result.

**Expected result:** The preview shows the result's page and no highlight box is
drawn. Under the preview it reads the page label and **The exact region could
not be located, so the whole page is shown.** The result in the list is marked
**page only**. The app must not draw a box in an arbitrary place.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-06: Every result names a page

**Precondition:** `EH118-DOC-01` and `EH118-DOC-02` have finished processing.

1. Open each document in turn.
2. Read the small grey line under each result in the list.

**Expected result:** Every result shows either **Page N** or the explicit text
**Source page not recorded**. No result leaves the page blank or unlabelled.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-07: Confirmed results keep their source link

**Precondition:** `EH118-DOC-01` is open with results awaiting review.

1. Select one or more results and complete the review action shown on the button
   (for example **Accept selected** or **Confirm**).
2. Wait for the list to refresh to the confirmed results.
3. Click a confirmed result.

**Expected result:** The confirmed result still shows its page, and clicking it
opens that page and highlights the source if one was found. Confirming must not
lose the page or the highlight.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-08: A PDF can be paged and zoomed

**Precondition:** `EH118-DOC-01` is open.

1. Look at the toolbar above the document preview.
2. Use **Previous page** and **Next page**.
3. Use **Zoom in** and **Zoom out**.

**Expected result:** The page controls and zoom controls are present for the PDF
and work. Page 2 is reachable without downloading the original.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-09: Instrumental findings link to their page

**Precondition:** `EH118-DOC-03` has finished processing.

1. Open `EH118-DOC-03`.
2. In the right-hand panel, click a listed finding that shows **Page N**.

**Expected result:** The preview switches to that page and shows the source text
under the preview. If the exact region could be located it is highlighted;
otherwise the page-only message is shown.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH118-UI-10: An older document still opens and is recoverable

**Precondition:** `EH118-DOC-04` was processed before this release.

1. Open `EH118-DOC-04`.
2. Click a result.
3. Click **Reprocess document** and wait for processing to finish.
4. Click the same result again.

**Expected result:** Before reprocessing, the document opens normally and the
result shows a page with no highlight. After reprocessing, results show pages and
the ones with matching text now highlight their source. Nothing errors at any
point.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

Use this section for contracts that cannot be proven by a tester through the
interface.

- [ ] **Engineering / CI:** `pnpm test:eh118` proves the source region contract
  (accepted shape; rejection of pixel-space, out-of-page, zero-page and
  degenerate rectangles; clamping; page coherence), the provenance adapter
  (page index parsing and normalization, page markers, exact and fuzzy snippet
  grounding, page-hint correction, every page-only fallback, and the
  column-major table regression), the EH-117 workspace integration
  (`resolveSourceLocation` reporting `region` / `page` / `document` precision),
  and the scroll-ownership rule below.
- [ ] **Engineering / CI:** the same suite asserts that
  `SourceHighlightOverlay` contains no `scrollIntoView` call, that
  `DocumentSourcePane` scrolls only its own container, and that
  `ObservationReviewList` keeps its list-scoped `scrollIntoView({ block:
  "nearest" })`. Two scroll owners on one selection is the failure this guards.
- [ ] **Database owner:** `pnpm test:eh118-db` runs
  `supabase/tests/eh118_observation_source_region.sql` against a migrated
  Supabase stack and proves the `eh118_is_source_region` contract, the region
  constraints on `observations`, `document_extracted_biomarkers` and
  `document_extracted_instrumental_measures`, the source-page requirement for
  document-sourced observations, the rejection of a zero page index, and that
  provenance stays write-once.
- [ ] **Engineering:** migration `044_eh118_observation_source_region.sql`
  applies cleanly to an already-migrated database, clears pre-contract regions,
  and validates the source-page constraint when no legacy row violates it.
- [ ] **Engineering:** `pnpm smoke:eh118-page-index` shows the real per-page
  index, page dimensions, and page markers for a real PDF.
- [ ] **Engineering:** `pnpm smoke:eh118-overlay` renders the real overlay
  component over the real page preview into `.artifacts/eh118-overlay.html`;
  opening it and inspecting the highlight proves the region lands on the quoted
  text and holds its position under zoom.
- [ ] **Release owner:** confirm the worker host still provides poppler
  (`pdftotext`) and that `POPPLER_BIN_DIR` is set where required, since word
  geometry comes from `pdftotext -bbox-layout`.

## Out of scope or not manually testable yet

- OCR for scanned documents is out of scope. `EH118-DOC-02` is expected to show
  page-only provenance; that is a pass, not a failure.
- Documents whose text is read by the image/vision path are attributed to page 1
  with no region. That path is unchanged by EH-118.
- Highlights are not drawn on the raw-PDF fallback view used when no page
  previews exist. The pane keeps EH-117's wording for that case.
- Provenance is write-once, so existing observations are not backfilled.
  Reprocessing is the supported way to ground an older document.
- Editing or correcting a highlight by hand is not offered and is not part of
  this item.
- Region precision does **not** depend on `document_pages.ocr_text`. Matching
  happens in the worker against the in-memory page index built by
  `pdftotext -bbox-layout`, so pages 2+ are grounded exactly like page 1. The
  previous page-1-only `ocr_text` limitation is removed by this change: the
  worker now stores per-page text (still truncated at 50 000 characters per
  page, which only affects the stored copy, not matching).

## Automated regression coverage (2026-08-04)

| EH-118 contract | Automated evidence |
| --- | --- |
| Source region shape, rejection, clamping, page coherence | `scripts/verify-eh118-source-region-contract.ts` via `pnpm test:eh118` |
| Review-row precision: region / page / document | `scripts/verify-eh118-source-region-contract.ts` via `pnpm test:eh118` |
| Single scroll owner on selection | `scripts/verify-eh118-source-region-contract.ts` via `pnpm test:eh118` |
| Page index parsing and coordinate normalization | `scripts/verify-eh118-provenance-adapter.ts` via `pnpm test:eh118` |
| Page-marked extraction input | `scripts/verify-eh118-provenance-adapter.ts` via `pnpm test:eh118` |
| Snippet grounding, page-hint correction, page-only fallbacks | `scripts/verify-eh118-provenance-adapter.ts` via `pnpm test:eh118` |
| Column-major table rows still resolve to one row | `scripts/verify-eh118-provenance-adapter.ts` via `pnpm test:eh118` |
| Database region contract, constraints, write-once | `supabase/tests/eh118_observation_source_region.sql` via `pnpm test:eh118-db` (CI `database` job) |
| Worker and viewer wiring | static assertions in both `verify-eh118-*` runners |
| Real-document page index and alignment | `pnpm smoke:eh118-page-index`, `pnpm smoke:eh118-overlay` |

## Local verification record (2026-08-04)

Run from the branch root on `feat/eh-118-source-page-and-region`, based on
`integration/eh-117-plus-alias-order`.

- [x] `pnpm typecheck`
- [x] `npx tsc --noEmit -p worker/tsconfig.json`
- [x] `pnpm test:eh118`
- [x] `pnpm test:eh117`
- [x] `pnpm test:stated-axis`
- [x] `pnpm test:eh106`
- [x] `pnpm test:eh112`
- [x] `pnpm test:eh113`
- [x] `pnpm test:eh116`
- [x] `pnpm test:document-review`
- [x] `pnpm verify:registry`
- [x] `pnpm check:registry-v2-candidate-corpus` — `launchable: true`,
  `candidateInputHash: f00c0e6f4b0c041c75935186f1d8dee2d7d6f0cefb83dee22739e71bda74efd1`
  (unchanged; the candidate.2 approvals stay valid).
- [x] `pnpm test:eh118-db` — 26 assertions, all pass.
- [x] `pnpm test:eh106-db` — passes. Its fixtures were updated to carry a source
  page, because EH-118 requires one on every document-sourced observation.
- [x] `pnpm test:stated-axis-db` — passes; the #106 stated-axis filter is
  untouched.
- [x] `pnpm smoke:eh118-page-index` — 2 pages indexed with real page geometry;
  page markers present; snippets resolved with `ocr_exact`.
- [x] `pnpm smoke:eh118-overlay` — the overlay component rendered over the real
  page preview; measured in a browser at 1x, 2x and 3x zoom and at 1300px,
  600px and 400px viewport widths, the highlight held the resolved region
  coordinates exactly.
- [ ] `pnpm build` — **fails, and fails identically on a clean checkout of
  `integration/eh-117-plus-alias-order` with no EH-118 changes.** Turbopack
  cannot resolve `@radix-ui/react-select` / `@radix-ui/react-dropdown-menu` in
  this workspace, while Node resolves the same packages fine. Verified by
  stashing all EH-118 work and rebuilding. Environment issue, not EH-118; CI
  runs the build.
- [ ] `pnpm test:eh111` — fails at
  `scripts/verify-eh111-clinical-compatibility.ts:184`, unchanged by EH-118 and
  tracked in issue #110. Not investigated further.
