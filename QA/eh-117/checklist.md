# EH-117: Split-view document review workspace

**Roadmap status:** Implemented, awaiting manual QA execution  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

Opening a laboratory document now shows the document page on the left and the
extracted results on the right, in one screen. Results are grouped by the page
they came from, selecting a result moves the document to that page, and moving
the document re-highlights the matching result. Every result shows two separate
states: whether the system matched it to a known measurement, and whether that
match has been verified. Results that could not be matched can still be accepted
exactly as printed — choosing a measurement is always optional.

Boundary in plain language: the app does **not** draw a highlight box around the
exact place on the page. It only jumps to the correct page and shows the text
snippet it read. Highlight boxes are a separate roadmap item (EH-118).

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
  intentionally tests processing.
- [ ] Use a desktop browser window at least 1280 px wide for checks 01–07, then
  repeat check 08 on a phone-sized window.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH117-01` | Synthetic multi-page lab PDF with results printed on at least two different pages, including one clearly matched marker (for example ALT with a stated serum specimen) | Normal path, page grouping, page navigation |
| `EH117-02` | Synthetic lab report containing a result with no specimen stated (for example a bare "Glucose 90 mg/dL") | Incomplete result: "More details needed", raw acceptance |
| `EH117-03` | Synthetic lab report containing an unusual or invented marker name (for example "XYZ-9 Trace") | Unmatched result: "Measurement not recognized" |
| `EH117-04` | A document already reviewed and accepted in an earlier session | Stored results, verified state, no acceptance controls |
| `EH117-05` | A legacy document that has stored biomarkers but no current extracted rows | Observations-only recovery list |

## Interface checks

### EH117-UI-01: Document and results appear side by side

**Precondition:** `EH117-01` has finished processing and is awaiting review.

1. Go to **Documents**.
2. Open `EH117-01`.

**Expected result:** The document page image is shown on the left and the
results list on the right, in the same screen. Above the list a summary line
reports the total number of results and how many are matched, incomplete and
not verified. You must **not** see a bare "Loading document…" line replacing the
whole screen, and you must not have to scroll sideways.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-02: Results are grouped by the page they came from

**Precondition:** `EH117-01` is open.

1. Look at the results list on the right.

**Expected result:** Results are grouped under headings such as **Page 1** and
**Page 2**, in ascending page order, and each heading states how many results it
contains. Any result whose page could not be recorded appears in a final group
headed **Source page not recorded**. Results must not be listed in one flat
alphabetical list.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-03: Selecting a result jumps the document to its page

**Precondition:** `EH117-01` is open and the document is showing page 1.

1. In the results list, click a result that is grouped under **Page 2**.

**Expected result:** The document pane switches to page 2, the clicked result is
visibly highlighted as the current result, and below the document you see
**Page 2** together with the exact text snippet that was read. No coloured box
is drawn over the page image.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-04: Moving the document re-selects the matching result

**Precondition:** Continue from EH117-UI-03, with page 2 showing.

1. Click the **Previous page** arrow above the document.
2. Then click the **Show page** link on a different page group heading.

**Expected result:** After step 1 the document returns to page 1 and the first
result in the **Page 1** group becomes the highlighted current result, scrolled
into view. After step 2 the document moves to that group's page and its first
result becomes current. Navigating to a page that has no results must leave the
current selection alone rather than clearing it.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-05: Match state and verification state are shown separately

**Precondition:** `EH117-01` and `EH117-02` are open in turn.

1. Read the two coloured labels on each result.

**Expected result:** Each result shows one label for the match
(**Matched measurement**, **More details needed**, **Multiple possible matches**
or **Measurement not recognized**) and a second, separate label for verification
(**Not verified yet**, **Verified automatically**, **Verified by you** or
**Corrected by you**), plus the mapping confidence band as small grey text. A
result must never show only one of the two. A result that has never been
verified must read **Not verified yet** rather than showing nothing.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-06: An unmatched result can be kept exactly as printed

**Precondition:** `EH117-02` and `EH117-03` are open and awaiting review.

1. Find the incomplete result and the unrecognised result.
2. Read the text under each result's explanation.
3. Leave every mapping dropdown untouched, keep those results ticked, and click
   **Accept selected (n)**.

**Expected result:** Each incomplete or unrecognised result awaiting review says
that it can be accepted as reported and that mapping is optional, and the note
under the accept button repeats this. Acceptance succeeds with no mapping
chosen. The stored result keeps the printed name, printed value, printed unit
and printed reference range — it must not be renamed to a suggested measurement,
converted to another unit, or given a specimen the report never stated.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-07: Technical information stays hidden until requested

**Precondition:** `EH117-02` is open.

1. Confirm that the visible part of a result shows only the reported name,
   value, reference range, source page, snippet and the two state labels.
2. Click **Technical details** on that result.

**Expected result:** Before clicking, no version numbers, evidence codes or
candidate lists are visible. After clicking, you see the sentence that mapping
confidence is classification evidence and not medical certainty, followed by the
state, missing details, conflicts, supporting evidence, number of candidates
considered, catalog and resolver versions, and — where offered — the optional
mapping dropdown labelled **Select only if the report states the specimen** and
any **Restore …** buttons. The same **Technical details** control must also be
present on the results shown for `EH117-05`.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-08: The workspace works on a narrow screen

**Precondition:** `EH117-01` is open.

1. Resize the browser window to a phone width (about 400 px), or open the same
   document on a phone.

**Expected result:** The document pane and the results list stack vertically,
the document appears first, and the page never scrolls sideways. All page
navigation, zoom and accept controls remain reachable.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-09: Already reviewed documents read correctly

**Precondition:** `EH117-04` has been accepted in an earlier session.

1. Open `EH117-04`.

**Expected result:** Results are marked as stored, show their verification state
(for example **Verified by you**), and offer no acceptance tick boxes and no
raw-acceptance note. Page grouping, selection and **Technical details** still
work.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-10: Recovery list for documents with no extracted rows

**Precondition:** `EH117-05` is available.

1. Open `EH117-05`.

**Expected result:** The right pane is titled **Biomarkers**, explains that the
listed results are already linked to the document, and lists them with the same
page grouping, the same two state labels and the same **Technical details**
control as an ordinary review. The confirmation button reads
**Confirm biomarkers (n)**.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH117-UI-11: Loading and failure states are honest and recoverable

**Precondition:** Any processed document. A developer may need to help simulate
a network failure using browser offline mode.

1. Open a document and watch the moment before content appears.
2. With the browser set to offline, reload the document page.
3. Return the browser to online and click **Retry**.

**Expected result:** In step 1 you see grey placeholder blocks in the shape of
the two panes, not a bare text line and not an empty screen. In step 2 you see a
message that the review workspace could not be opened, with **Retry** and
**Back to documents**. In step 3 the workspace loads without a full browser
reload. If a single page image fails to load, the failure and a
**Retry page preview** button appear inside the document pane only — the results
list must stay visible and usable.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] `pnpm test:eh117` (`scripts/verify-eh117-review-workspace.ts`) proves the
  review-row projection, page grouping, bidirectional selection resolution and
  its idempotence, source-precision fallback, raw-acceptance eligibility, and
  that no candidate measurement or analyte key can reach a rendered row.
  Provided by the implementing engineer in CI.
- [ ] `pnpm test:eh112` proves the four-outcome wording and the technical
  details contract that EH-117 renders are unchanged.
- [ ] `pnpm test:document-review` proves the panel-mode and review-action
  decision helpers still behave as the workspace assumes.
- [ ] `Cache-Control: no-store` on `GET /api/documents/[id]/observations`, and
  the absence of `bounding_box` in that response, must be confirmed from the
  response headers and body by a developer; a tester cannot see this.
- [ ] The single-bootstrap open path and the page-only fetch on page change must
  be confirmed in the network panel by a developer: opening a document issues
  one `GET /api/documents/{id}?page=N` plus one
  `GET /api/documents/{id}/observations`, and changing page issues only
  `GET /api/documents/{id}/pages/{n}`.

## Automated regression coverage (2026-08-04)

| EH-117 boundary | Automated evidence |
| --- | --- |
| Row projection keeps raw evidence and drops candidate identity | `scripts/verify-eh117-review-workspace.ts` |
| Unstated specimen/modifier/method are not rendered as evidence | `scripts/verify-eh117-review-workspace.ts` |
| Source precision falls back `page` → `document`, never `region` | `scripts/verify-eh117-review-workspace.ts` |
| Page grouping order and unlocated-row placement | `scripts/verify-eh117-review-workspace.ts` |
| Bidirectional selection resolution and its idempotence | `scripts/verify-eh117-review-workspace.ts` |
| Raw acceptance eligibility for partial/ambiguous/unmapped | `scripts/verify-eh117-review-workspace.ts` |
| Verification and resolver presentation vocabulary | `scripts/verify-eh117-review-workspace.ts` |
| Four-outcome wording reused unchanged | `scripts/verify-eh112-incomplete-outcomes.ts` |
| Panel-mode and review-action decisions | `scripts/verify-document-review-runner.ts` |

## Local verification record (2026-08-04)

- [x] `corepack pnpm typecheck` — pass.
- [x] `corepack pnpm test:eh117` — pass.
- [x] `corepack pnpm test:eh112` — pass.
- [x] `corepack pnpm test:eh113` — pass.
- [x] `corepack pnpm test:document-review` — pass.
- [x] `corepack pnpm test:eh106` — pass.
- [x] `corepack pnpm test:eh116` — pass.
- [x] `corepack pnpm verify:registry` — pass.
- [x] `corepack pnpm build` — pass (Next 15.5.8, Turbopack; `/app/documents/[id]`
  compiled).
- [x] Behavioural smoke test of the built workspace driven with synthetic
  fixtures in a headless browser: page grouping (`Page 1`, `Page 2`,
  `Source page not recorded`), summary line
  `4 results · 1 matched · 3 incomplete · 3 not verified`, row → page navigation,
  page → row re-anchoring, document-level fallback notice, technical-details
  disclosure, raw-acceptance notes on the three incomplete rows, the
  observations-only recovery list, the loading skeleton, the retryable load
  error and the retryable page-preview error, plus two-column layout at 1440 px
  (`956px 420px`) and single-column stacking at 430 px with no horizontal
  overflow.
- [ ] `corepack pnpm test:eh111` — **fails, pre-existing on `master` at
  `f87e8fe`** (`unit_dimension_conflict` assertion in
  `scripts/verify-eh111-clinical-compatibility.ts:184`). Reproduced identically
  in the untouched `master` checkout; unrelated to EH-117.
- [ ] Database fixtures (`supabase test db --local`) — **blocked**: Docker is not
  available in this environment. EH-117 adds no migration and no writer change,
  so no new database fixture is required.

## Out of scope or not manually testable yet

- **EH-118 (source page and region highlight).** No bounding-box overlay ships
  here. The workspace reserves a `region` source precision but never produces
  it, and both `document-viewer` and `document-extraction-review` still forbid
  highlight rectangles in v1. Do not fail EH-117 for a missing highlight box.
- **EH-119 (observation edit and correction flow)** and **EH-120 (verification
  transitions).** EH-117 only presents the existing states; it adds no new edit
  action and no new verification transition.
- **EH-121 (observation change history).** Revision history remains limited to
  the existing **Restore …** controls inside technical details.
- **EH-116 reprocess batches.** No batch reprocessing surface exists in the UI;
  only the existing document-level **Reprocess document** action is available.
- **Browser end-to-end automation.** There is no existing browser E2E harness in
  this repository. The interface scenarios above remain manual QA until one is
  deliberately introduced; the fixture-driven smoke test recorded above is
  developer evidence, not a substitute for manual QA on real documents.
- **PDF documents without rasterized pages.** Those still render in an embedded
  PDF frame, page navigation is unavailable, and the workspace states that the
  frame does not jump to the page automatically. This is the existing
  `PDF fallback only` behaviour, not an EH-117 regression.
