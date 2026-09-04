# Public panel education overlay

**Roadmap status:** In progress
**Build / environment:** Local EasyHealth workspace; `pnpm test:public-panel-education`; public Knowledge Base routes
**Test run date:** `2026-09-04` (developer evidence; UI not executed in apply)
**Tester:** Engineering apply session

## What this checklist covers

This checklist covers the public Knowledge Base panel detail route. When a panel education article exists (currently CBC), the public page must show that article’s sources, disclaimer, and honest preview/review chips. Panels without an article must stay on the registry composition page. The page must not show private CBC results.

## Before you start

- [ ] No authenticated session is required for these public checks; use a private/incognito window.
- [ ] Do not use real patient documents or values.
- [ ] Do not mark last-reviewed as Pass while the CBC article has a null `reviewedAt`.
- [ ] Do not treat this overlay as EH-140 release acceptance or as clinical publication of CBC.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `PUB-PANEL-CBC` | Anonymous visit to `/knowledge/panels/cbc` | Education overlay with sources and preview chips |
| `PUB-PANEL-THYROID` | Anonymous visit to `/knowledge/panels/thyroid` | Registry composition fallback |
| `PUB-PANEL-UNKNOWN` | Anonymous visit to `/knowledge/panels/not-a-panel` | Not-found for unknown Registry keys |

## Interface checks

### PUB-PANEL-UI-01: CBC public page shows the education article

**Precondition:** The application is running and `/knowledge/panels/cbc` is reachable without a session.

1. Open `/knowledge/panels/cbc` in a private/incognito window.
2. Confirm the title is **Complete blood count** and the chips include **Educational preview** and **Clinical review pending**.
3. Confirm **Sources** lists MedlinePlus and NHLBI HTTPS links.
4. Confirm the medical disclaimer is visible.
5. Confirm the page does not show **Clinically reviewed**, a last-reviewed date, or **Your CBC results**.

**Expected result:** The public CBC page is the EH-135 education article in preview state, with sources and disclaimer, and without private results or invented review metadata.

**Result:** `________`
**Notes / evidence link:** `________`

### PUB-PANEL-UI-02: Last-reviewed stays absent until clinical publish

**Precondition:** `CBC_PANEL_ARTICLE.reviewedAt` is null.

1. Remain on `/knowledge/panels/cbc`.
2. Confirm there is no last-reviewed date and no **Clinically reviewed** chip.

**Expected result:** Last-reviewed is not Pass while review metadata is null. Record Partial only if the rest of the education overlay is visible.

**Result:** `________`
**Notes / evidence link:** Do not mark Pass while `reviewedAt` is null.

### PUB-PANEL-UI-03: Registry-only panels keep the composition page

**Precondition:** `/knowledge/panels/thyroid` is a Registry panel without an education article.

1. Open `/knowledge/panels/thyroid`.
2. Confirm the Registry panel name and required/optional members are shown.
3. Confirm the page does not invent a Sources list, reviewer name, or education article body.

**Expected result:** Panels without an education article stay on the EH-138 composition view.

**Result:** `________`
**Notes / evidence link:** `________`

### PUB-PANEL-UI-04: Unknown panel keys are not found

**Precondition:** The public Knowledge Base is running.

1. Open `/knowledge/panels/not-a-panel`.

**Expected result:** The route resolves as not found. No fabricated panel education is shown.

**Result:** `________`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:public-panel-education` passed on 2026-09-04: CBC overlay wiring, HTTPS sources, in-review metadata, no public `/api/biomarkers` fetch, and thyroid/registry fallback.
- [x] `pnpm typecheck` passed on 2026-09-04 with the optional results prop.
- [x] `openspec validate wire-public-panel-education-article --strict` passed on 2026-09-04.
- [x] `pnpm check:ci-suite-coverage && pnpm check:ci-suite-coverage-contract` passed (`98 covered, 0 orphaned`).

## Out of scope or not manually testable yet

- Clinical publish of CBC (`reviewStatus: "published"`, `reviewedBy`, `reviewedAt`) is a separate editorial task.
- Authenticated `/app/knowledge/panels/cbc` results fetching is unchanged EH-135 behavior.
- EH-140 safety/accessibility release acceptance and GitHub #40 remain separate; do not close #40 from this overlay.
