# EH-140: Knowledge Base safety and accessibility review

**Roadmap status:** In progress — dependency-blocked
**Build / environment:** Local EasyHealth checkout with Docker/Supabase services and a Next.js app on `http://localhost:3003`; no authenticated Knowledge Base deployment is available in this checkout
**Test run date:** 2026-09-01
**Tester:** Codex automated verification plus browser smoke execution; no screen-reader tester assigned

## What this checklist covers

This checklist is the release-gate record for the Knowledge Base MVP described by EH-134, EH-135, and EH-138. It verifies that biomarker and panel education is non-diagnostic and non-prescriptive, does not provide external reference ranges to assessment, exposes sources and review metadata, and remains usable with keyboard, screen reader, and mobile interfaces. The current checkout contains no Knowledge Base article, panel, index, search, or cross-link surface; `/knowledge-base`, `/app/knowledge-base`, and `/app/knowledge` returned HTTP 404, so the interface cases below are recorded as `Blocked`, not as passing results.

## Before you start

- [x] Use a dedicated synthetic test account; do not use a real patient account.
- [x] Use only synthetic or de-identified documents and result labels.
- [ ] Confirm EH-134 biomarker article, EH-135 panel/CBC page, and EH-138 index/search/cross-link surfaces are deployed to the test environment.
- [ ] Confirm a supported browser and screen-reader pairing, and record browser, screen-reader, operating-system, and viewport versions.
- [ ] Confirm a second dedicated synthetic account is available for the private-data isolation check.
- [ ] Confirm the release candidate includes the exact content and source links under review.

## Test data

| ID                   | Test document or setup                                                                                                                                                  | Purpose                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `EH140-SAFE-ARTICLE` | Synthetic hemoglobin education with what-it-measures, aliases, units, specimen, interpretation factors, sources, and disclaimer; no patient data or universal threshold | Normal safe-copy path                                                     |
| `EH140-UNSAFE-COPY`  | Deliberately non-publishable synthetic draft containing a diagnostic statement, treatment instruction, test-order prompt, and numeric reference interval                | Negative prohibited-claim and external-range path; developer fixture only |
| `EH140-LONG-COPY`    | Synthetic article/panel with long aliases, source titles, breadcrumbs, and related-result labels                                                                        | Narrow-viewport reflow and reachable-control path                         |
| `EH140-RESULT-A`     | Synthetic processed laboratory document for account A with a document-printed result and document-sourced range                                                         | User-result deep link and document-range separation                       |
| `EH140-RESULT-B`     | Different synthetic processed laboratory document for account B                                                                                                         | Cross-account privacy negative path                                       |
| `EH140-BROKEN-LINK`  | Synthetic local draft whose one relative source link intentionally points to a missing file                                                                             | Broken-local-link negative path; never publish this fixture               |

## Available-surface smoke checks

These checks cover the authenticated product surfaces that are present in this checkout. They do not substitute for the blocked Knowledge Base release-gate cases below.

### EH140-LOCAL-UI-01: Landing and sign-in controls are keyboard reachable

**Precondition:** Open `http://localhost:3003/` in Chrome 151 on Windows at 1280×800 and 320×800 CSS pixels.

1. Observe the landing page accessibility tree.
2. Press `Tab` through the landing controls.
3. Enter the synthetic invalid value `not-an-email` in the email field and submit.
4. Inspect the field validity.

**Expected result:** The page exposes one named `main`, one banner, one footer, one `h1`, and named controls. Keyboard focus reaches the CTA, Google sign-in, navigation links, email field, and email submit control. Invalid email is rejected by native form validation.

**Result:** `Pass` — 1280×800 and 320×800 had no horizontal overflow; all seven landing controls had names; the tab sequence reached the named controls; `checkValidity()` returned `false` with the expected email validation message.

**Notes / evidence link:** `http://localhost:3003/`; browser runtime `Chrome/151.0.0.0`, Windows `Win32`, 320×800 and 1280×800.

### EH140-LOCAL-UI-02: Synthetic onboarding and authenticated app routes work

**Precondition:** Use the synthetic account `eh140.qa.20260903@example.test`; no real patient data is used.

1. Request a magic link through the landing form and complete it from the local Mailpit message.
2. Enter `QA` / `EH140` at the profile gate.
3. Uncheck a required consent and confirm **Continue** is disabled; restore it and continue.
4. Visit `/app`, `/app/profile`, `/app/timeline`, `/app/biomarkers`, `/app/documents`, `/app/reports`, and `/app/upload`.
5. Repeat the app shell check at 320×800.

**Expected result:** The profile and required-consent gates enforce their prerequisites. Each available route loads without a route error, has named navigation controls, and remains usable without horizontal overflow at the narrow viewport.

**Result:** `Pass` — the profile gate advanced to consent; required consent disabled **Continue**; all seven routes returned HTTP 200 with visible headings; the authenticated 320×800 dashboard had 320px document/body widths and named focusable controls.

**Notes / evidence link:** Synthetic account only; Knowledge Base routes remained unavailable and are recorded as blocked below.

### EH140-LOCAL-UI-03: Legal links resolve

**Precondition:** Stay signed in with the synthetic account.

1. Open `/legal/privacy`, `/legal/terms`, and `/legal/cookies`.
2. Confirm each page exposes its expected heading and named links.

**Expected result:** Each legal page loads successfully and has a descriptive page heading.

**Result:** `Pass` — all three pages returned HTTP 200, exposed `Privacy Policy`, `Terms of Service`, and `Cookie Policy` headings respectively, and had zero unnamed links.

**Notes / evidence link:** `http://localhost:3003/legal/privacy`, `/legal/terms`, `/legal/cookies`.

## Interface checks

### EH140-UI-01: Article copy is educational, not diagnostic or prescriptive

**Precondition:** `EH140-SAFE-ARTICLE` is published in the EH-134 article template and its source/review metadata is visible.

1. Open **Knowledge Base**.
2. Open the biomarker article for `EH140-SAFE-ARTICLE`.
3. Read **What it measures**, aliases/units/specimen, interpretation factors, sources, and disclaimer from top to bottom.
4. Confirm that the page does not address the reader with a diagnosis, certainty statement, treatment or medication instruction, or test-order prompt.

**Expected result:** The page explains the measurement and its context only. It does not say that a person has or does not have a condition, does not prescribe or change treatment, and does not direct the user to order a test. A prohibited-claim finding is a release-blocking failure.

**Result:** `Blocked` — EH-134 article UI is not present in this checkout. Required evidence: authenticated run against the deployed EH-134 surface.
**Notes / evidence link:** `________`

### EH140-UI-02: External ranges stay out of education and assessment

**Precondition:** `EH140-SAFE-ARTICLE` is available, and `EH140-RESULT-A` is processed for the same synthetic account.

1. Open the biomarker article in **Knowledge Base**.
2. Inspect the article for universal normal/reference ranges, threshold tables, score inputs, or assessment-status claims.
3. Follow the article's link to the user's result.
4. Open the linked document source and compare the displayed result range with the range used by **Health Profile** or **Biomarkers**.

**Expected result:** The article contains no external or universal range used for interpretation. The user's displayed range is traceable to `EH140-RESULT-A` and its source document. Knowledge Base copy or citations never change assessment eligibility, readiness, score, or status.

**Result:** `Blocked` — EH-134 article and EH-138 result deep link are not present. Required evidence: browser trace from article to the user's document and Health Profile.
**Notes / evidence link:** `________`

### EH140-UI-03: Sources and review metadata are visible

**Precondition:** A published biomarker article and CBC/panel page are deployed with approved source records.

1. Open the article for `EH140-SAFE-ARTICLE`.
2. Locate the visible **Sources** section and last-reviewed date.
3. Activate each source link with keyboard or pointer.
4. Return to the article and repeat for the CBC/panel page.

**Expected result:** Every published page visibly shows its sources and last-reviewed date. Each link has a descriptive accessible name and reaches the declared source. A missing source or broken required link blocks publication.

**Result:** `Blocked` — EH-134/EH-135 published pages are not present. Required evidence: screenshots or browser trace with the reviewed URLs and date.
**Notes / evidence link:** `________`

### EH140-UI-04: Index search, aliases, filters, and breadcrumbs are usable

**Precondition:** EH-138 **Knowledge Base** index is deployed with `EH140-SAFE-ARTICLE`, a CBC panel, and synthetic aliases.

1. Open **Knowledge Base**.
2. Search for the canonical hemoglobin name.
3. Repeat the search with each synthetic alias.
4. Filter to panels, open the CBC page, and use its breadcrumb to return to the index.
5. Open the article from a result and use its breadcrumb to return to the filtered list.

**Expected result:** Canonical and alias searches return the expected article; the panel filter does not hide or mix unrelated content; breadcrumbs preserve the current navigation context; no private result values appear in public article cards.

**Result:** `Blocked` — EH-138 index/search/filter/breadcrumb UI is not present. Required evidence: authenticated browser run with result-count and breadcrumb observations.
**Notes / evidence link:** `________`

### EH140-UI-05: Keyboard-only operation reaches every blocking control

**Precondition:** EH-138 index/search and EH-134/EH-135 pages are deployed. Disconnect the pointer or do not use it.

1. Open **Knowledge Base** and press `Tab` from the page start.
2. Move through search, category/panel filters, result links, breadcrumbs, source links, and user-result deep links.
3. Activate search/filter/link controls with Enter or Space as appropriate.
4. Repeat after a no-results search and after clearing the search.

**Expected result:** Every control receives a visible focus indicator in logical order and can be activated without a pointer. Focus does not disappear or jump to an unrelated surface. Search/filter state and no-results state remain understandable.

**Result:** `Blocked` — no Knowledge Base interface is available for keyboard execution. Required evidence: browser/version, viewport, focus-order notes, and screenshots for any failure.
**Notes / evidence link:** `________`

### EH140-UI-06: Screen-reader names and state changes are announced

**Precondition:** EH-138 index/search is deployed. Use the supported browser and screen-reader pairing recorded above.

1. Open **Knowledge Base** and navigate by landmarks and headings.
2. Identify the search input, submit/clear controls, category/panel filters, result count, breadcrumbs, source links, and article headings.
3. Submit a canonical search, an alias search, and a no-results search.
4. Change a panel filter and listen for the result-count or selected-state announcement.

**Expected result:** Landmarks and headings form a meaningful structure. Controls have descriptive names and roles. Search/filter result changes are conveyed without relying on visual color or position, and focus remains understandable.

**Result:** `Blocked` — no Knowledge Base interface or supported assistive-technology environment is available. Required evidence: exact browser, screen-reader, operating-system versions, and recording/notes.
**Notes / evidence link:** `________`

### EH140-UI-07: Long content reflows on mobile

**Precondition:** EH-134/EH-135/EH-138 pages are deployed. Use `EH140-LONG-COPY` and test at the supported mobile viewport widths, including 320 CSS px if supported.

1. Open the **Knowledge Base** index at the narrow viewport.
2. Search for the long alias and open its article.
3. Open the CBC/panel page and expand or inspect long member/source labels.
4. Scroll horizontally and vertically without zooming the page.
5. Activate breadcrumbs, source links, filters, and the user-result deep link.

**Expected result:** Text wraps without horizontal clipping, overlap, or hidden source/review metadata. Critical controls remain reachable and have readable labels at every supported width. No behavior depends on hover.

**Result:** `Blocked` — no Knowledge Base UI is available for mobile review. Required evidence: viewport dimensions, screenshots, and any horizontal-scroll/reflow reproduction.
**Notes / evidence link:** `________`

### EH140-UI-08: Private result links do not cross accounts

**Precondition:** `EH140-RESULT-A` belongs only to synthetic account A and `EH140-RESULT-B` belongs only to synthetic account B. EH-138 deep links are deployed.

1. Sign in as synthetic account A and open the article/index.
2. Follow every user-result link shown from the article or biomarker row.
3. Sign out, sign in as synthetic account B, and repeat.
4. Refresh each account's browser session and do not paste another account's private URL as a substitute for a product flow.

**Expected result:** Public article content is the same for both accounts, while each account sees only its own result/document links and values. No article card, search result, breadcrumb, or deep link exposes the other account's private data.

**Result:** `Blocked` — EH-138 deep-link UI is not present. Required evidence: two-account browser run and observed link/result ownership.
**Notes / evidence link:** `________`

### EH140-UI-09: Broken source links block publication

**Precondition:** A disposable draft containing `EH140-BROKEN-LINK` is available in a review environment. Do not publish it.

1. Open the draft in the content-review interface.
2. Run the page's source-link review or open the visible source list.
3. Activate the intentionally missing relative link.
4. Replace or remove the missing link, rerun the review, and inspect the source list again.

**Expected result:** The missing local target is visible as a failure and the draft cannot be accepted as published. After repair/removal, the failure disappears and the source list remains visible. No broken draft is presented as published guidance.

**Result:** `Blocked` — EH-139 review/publish UI and EH-140 content fixtures are not present. Required evidence: review-screen result and repaired link trace.
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:eh140` passed the deterministic safety, document-range boundary, local-link fixture, and JSX accessibility fixture contracts. **Provider:** developer/CI. The command also reported the real Knowledge Base surface as `BLOCKED`; this is not release acceptance.
- [ ] `pnpm check:eh140-kb` strict mode was exercised and correctly exited `1` with `Knowledge Base surface is BLOCKED` because EH-134/EH-135/EH-138 files are absent. It must pass only after those files exist and contain no findings; this unresolved result prevents release acceptance. **Provider:** developer/CI; observed locally on 2026-09-01.
- [x] `pnpm typecheck` passed with the EH-140 policy and verifier. **Provider:** developer/CI; observed locally on 2026-09-01.
- [x] `pnpm check:ci-suite-coverage-contract` and `pnpm check:ci-suite-coverage` passed; the EH-140 suite is workflow-reachable (`90 covered, 0 local-only, 0 orphaned, 0 partial, 0 invalid`). **Provider:** developer/CI; observed locally on 2026-09-01.
- [x] `pnpm check:documentation-links` passed for the repository documentation index (`10 links resolve`). **Provider:** developer/CI; observed locally on 2026-09-01. The EH-140 local-link check is offline; external source URLs still require manual review evidence.
- [x] Docker and Supabase smoke checks passed: the local containers were healthy, Supabase REST returned HTTP 200, and Auth settings returned HTTP 200. **Provider:** developer/CI; observed locally on 2026-09-01.
- [x] Unauthenticated `/api/profile`, `/api/biomarkers`, `/api/health-profile`, `/api/timeline`, and `/api/reports` returned HTTP 401. **Provider:** developer/CI; observed locally on 2026-09-01.
- [ ] Authenticated synthetic-account API smoke was partial: `/api/profile`, `/api/documents`, `/api/biomarkers`, `/api/timeline`, and `/api/health-profile` returned HTTP 200, but `/api/reports` returned HTTP 500 (`permission denied for table reports`). This backend defect is recorded honestly and is not an EH-140 Knowledge Base acceptance result. **Provider:** developer/CI; observed locally on 2026-09-01.
- [ ] Clinical/editorial reviewer signs off every published article and panel page, including prohibited-claim scan findings and source/review metadata. **Provider:** Clinical Product.
- [ ] Accessibility reviewer supplies executed keyboard, supported screen-reader, and mobile evidence for all UI cases above. Static checks do not satisfy this requirement. **Provider:** QA / Accessibility.
- [ ] Release owner confirms every P0 finding is closed or formally dispositioned before accepting the Knowledge Base MVP. **Provider:** release owner.

## Out of scope or not manually testable yet

- EH-133 article persistence/schema, EH-134 article-template implementation, EH-135 panel/CBC implementation, EH-136 first ten pages, EH-137 related-measurement graph, EH-138 index/search implementation, and EH-139 publication workflow are dependency work, not invented by this review.
- Database migrations, resolver/normalization behavior, Health Profile scoring, document-sourced reference-range parsing, and private-data authorization are not changed by EH-140. Use the existing document/assessment contract suites for those paths.
- Static safety, link, and JSX checks are developer evidence and cannot certify clinical wording, remote URL availability, keyboard order, screen-reader output, or mobile reflow.
- Do not mark a blocked case `Pass` because a source file looks correct or because the deterministic verifier passes its in-memory fixtures. Re-run each case against the deployed dependency surface and record the exact evidence.
