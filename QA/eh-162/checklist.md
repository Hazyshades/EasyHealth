# EH-162: Highlight source region on biomarker hover

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers exact source-region previews for biomarker rows in the
Documents review workspace. Hover and keyboard focus preview a same-page exact
region without navigation or scrolling; explicit selection pins the region and
may navigate. Fuzzy, ambiguous, missing, legacy, scanned, cross-page, and
invalid provenance remain page-only.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
  intentionally tests processing.
- [ ] Use a digital PDF with a selectable text layer for exact-region checks.
- [ ] Keep a second synthetic document or fixture with duplicate and incomplete
  snippets for fallback checks.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH162-EXACT-01` | Synthetic digital lab PDF with one unique row containing label, value, and printed unit on page 1 | Exact same-page preview and pin |
| `EH162-MULTILINE-01` | Synthetic digital PDF whose quoted row crosses two visual text lines | Separate line rectangles and no envelope over unrelated columns |
| `EH162-FALLBACK-01` | Synthetic fixture with a duplicate snippet, a fuzzy-only snippet, a missing text layer/scanned page, and a legacy page-only row | Safe fallback ladder |
| `EH162-CROSSPAGE-01` | Synthetic multi-page digital lab PDF with an exact row on page 2 while page 1 is displayed | No hover navigation; explicit page action |

## Interface checks

### EH162-UI-01: Exact extracted row previews before acceptance

**Precondition:** `EH162-EXACT-01` is processed and shown in the **Documents**
review panel in `extracted-review` mode. The exact row is still awaiting
acceptance and its source page is displayed.

1. Open the document in **Documents**.
2. Keep the source page containing the exact row visible.
3. Hover the biomarker row without clicking it.
4. Move the pointer away from the row.

**Expected result:** After a short delay, a soft/dashed preview outlines the
recorded source region. The current page, selected row, review-list scroll, and
source-pane scroll do not change. Leaving the row removes only the preview. The
row remains pre-acceptance.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-02: Keyboard focus has preview parity

**Precondition:** `EH162-EXACT-01` is open with the exact source page displayed.

1. Use `Tab` until the exact biomarker row receives visible focus.
2. Wait for the preview delay.
3. Press `Tab` to move focus away without activating the row.

**Expected result:** Focus shows the same source-region preview as pointer
hover. Focus does not navigate, pin the row, or scroll the document. The row's
source page and quoted snippet remain available to the accessible description.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-03: Explicit selection pins and coexists with preview

**Precondition:** `EH162-EXACT-01` is open and at least two exact rows share the
currently displayed page.

1. Click row A.
2. Confirm its solid/heavier pinned highlight is visible.
3. Hover row B without clicking it.
4. Move away from row B.

**Expected result:** Clicking pins row A and may bring its region into view only
inside the source-pane scroll container. Hovering row B adds a visibly distinct
soft/dashed preview while row A remains pinned. Leaving row B restores row A's
pinned highlight. The browser window does not scroll.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-04: Cross-page hover stays page-local

**Precondition:** `EH162-CROSSPAGE-01` is open with page 1 displayed and a row
whose exact region is on page 2 is visible in the review list.

1. Hover the page-2 row.
2. Focus the same row with the keyboard.
3. Use the row/group **Show page** or equivalent explicit page affordance.

**Expected result:** Hover and focus draw no overlay and do not change the
current page. The explicit page action changes to page 2; only then can the
exact region be pinned/highlighted.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-05: Fallback ladder never draws a weak region

**Precondition:** `EH162-FALLBACK-01` is open with each fallback row visible.

1. Hover/focus the fuzzy-only row.
2. Hover/focus the duplicate/ambiguous row.
3. Hover/focus the row without positional text geometry.
4. Hover/focus the legacy page-only row.

**Expected result:** None of these rows draws an overlay. Rows with a recorded
page show the existing page-only state and source snippet; rows without a page
show that the source page is not recorded. No plausible-looking rectangle is
shown.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-06: Multi-line exact source remains precise

**Precondition:** `EH162-MULTILINE-01` is processed and its exact row is visible
on the displayed page.

1. Hover or focus the row.
2. Inspect both source lines.
3. Change zoom using **Zoom in** and **Zoom out**.
4. Resize the browser viewport or window.

**Expected result:** Each matched source line receives its own highlight. The
highlight does not fill unrelated columns between lines. Geometry remains over
the same text after zoom and resize, with no layout shift.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-07: Accepted observation fallback keeps the behavior

**Precondition:** Accept one exact row from `EH162-EXACT-01`, then reopen or
reload the document so the panel uses the authoritative observation fallback.

1. Display the accepted row on its source page.
2. Hover and keyboard-focus the observation row.
3. Click the row to pin it.

**Expected result:** Observation rows use the same exact-only preview, pin, and
page-only fallback behavior as pre-acceptance extracted rows. Acceptance is not
required for the preview contract, and no stale preview remains after reload.

**Result:** `________`
**Notes / evidence link:** `________`

### EH162-UI-08: Preview-unavailable state fails closed

**Precondition:** Use a synthetic document/page whose preview URL or image load
is unavailable, without editing production data.

1. Open the document page.
2. Hover/focus a row that has stored exact provenance.
3. Use **Retry page preview**.

**Expected result:** No overlay is shown while the image is unavailable. The
existing preview-unavailable error and retry control remain usable. A successful
retry restores the page image and only then permits a same-page exact overlay.

**Result:** `________`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm typecheck` passes; owner: implementer/CI.
- [x] `pnpm test:eh118` passes with canonical and legacy source-region contract,
      exact-only renderability, page coherence, and scroll ownership checks;
      owner: implementer/CI.
- [x] `pnpm test:eh162` passes with exact, fuzzy, duplicate, multi-line,
      hover/focus wiring, pinned/preview coexistence, accessibility, and
      migration assertions; owner: implementer/CI.
- [x] `pnpm smoke:eh118-overlay` renders the real overlay against a synthetic
      PDF; owner: implementer/CI.
- [x] `pnpm test:eh162-db` passes against the disposable local Supabase stack
      after applying `063_eh162_source_region_match_contract.sql`; it covers
      canonical/legacy payloads, invalid geometry, page coherence, document
      page requirements, and write-once provenance.
- [x] `pnpm test:eh118-db` passes, preserving the legacy 26-assertion
      source-region contract.
- [x] `pnpm test:service-role-access-db` passes with 4 assertions covering
      worker AI invocation inserts and observations instrumental-source embeds.
- [x] `pnpm check:ci-suite-coverage-contract` and
      `pnpm check:ci-suite-coverage` pass with `test:eh162` and
      `test:eh162-db` workflow-reachable.
- [ ] Review the browser console and network logs for absence of document text
      telemetry; owner: privacy reviewer.

## Out of scope or not manually testable yet

- OCR geometry for scanned documents and photographs is deferred; evidence is
  the page-only fallback check above, not a claimed overlay.
- Reverse document-region-to-row selection, free-text search, and manual box
  correction are out of scope.
- Persisted JSON shape, migration constraints, resolver scores, and write-once
  behavior require the developer evidence above; testers must not use SQL or
  developer tools as a substitute for the interface checks.
## Execution record

- **Automated checks:** `pnpm typecheck`, `pnpm test:eh118`, `pnpm test:eh162`, `pnpm test:service-role-access-db`, `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, `pnpm test:biomarker-docs`, and `pnpm smoke:eh118-overlay` passed in the implementation workspace.
- **UI smoke:** `Blocked`. The app shell rendered with synthetic environment values on the local dev server, but `/app/documents` redirected to `/?signin=required`; no authenticated Supabase session or seeded document fixture was available for the viewer. The interface checks above are therefore not marked passed.
- **Observations API smoke:** `Passed`. With a synthetic Supabase session and a disposable observation fixture, `GET /api/documents/af160b35-ff9a-400b-aaee-2391ffceb0b7/observations` returned HTTP 200 and the observations payload after migration `066_service_role_access_gaps.sql` was applied. The disposable row was removed after the check.
- **Worker smoke:** `Passed`. The worker started, wrote `worker_heartbeats.instance_id = document-worker`, and produced no permission/poll errors during the check.
- **Wiki publication:** `Published`. Seven generated pages were rendered, staged, reviewed, and pushed to the remote Wiki in commit [`c142768`](https://github.com/Hazyshades/EasyHealth.wiki/commit/c142768).
