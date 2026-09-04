# EH-140: Knowledge Base safety and accessibility review

**Roadmap status:** In progress — public Knowledge Base surfaces are present after merging `origin/master`; release acceptance is still open
**Build / environment:** Local EasyHealth checkout on `Hazyshades/eh-140-safety-accessibility-review` (merged `origin/master` `6bc677c`). Next.js on `http://127.0.0.1:3000`. Docker Desktop / local Supabase were still down on 2026-09-04, so authenticated `/app/knowledge*` and two-account privacy checks remain incomplete.
**Test run date:** 2026-09-04 (second pass after master merge)
**Tester:** Cursor Grok 4.6 browser and CLI verification; no screen-reader tester assigned

## What this checklist covers

This checklist is the release-gate record for the Knowledge Base MVP described by EH-134, EH-135, and EH-138. It verifies that biomarker and panel education is non-diagnostic and non-prescriptive, does not provide external reference ranges to assessment, exposes sources and review metadata, and remains usable with keyboard, screen reader, and mobile interfaces. After merging current `origin/master`, the public surfaces `/knowledge`, `/knowledge/biomarkers/hemoglobin`, `/knowledge/panels/cbc`, and `/knowledge-base` returned HTTP 200. Authenticated `/app/knowledge` still redirects to sign-in because Auth is down. Results below are from this second pass; a `Pass` on a public page is not release acceptance.

## Before you start

- [x] Use a dedicated synthetic test account; do not use a real patient account.
- [x] Use only synthetic or de-identified documents and result labels.
- [x] Confirm EH-134 biomarker article, EH-135 panel/CBC page, and EH-138 index/search/cross-link surfaces are deployed to the test environment.
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

**Precondition:** Open `http://127.0.0.1:3000/` in Chromium at 1280×800 and 320×800 CSS pixels.

1. Observe the landing page accessibility tree.
2. Press `Tab` through the landing controls.
3. Enter the synthetic invalid value `not-an-email` in the email field and submit.
4. Inspect the field validity.

**Expected result:** The page exposes one named `main`, one banner, one footer, one `h1`, and named controls. Keyboard focus reaches the CTA, Google sign-in, navigation links, email field, and email submit control. Invalid email is rejected by native form validation.

**Result:** `Pass` — DOM had one `main`, one `header`, one `footer`, and `h1` “AI-powered personal health record”. Named controls: Get started, Sign in with Google, Health Profile, Biomarkers, Health reports, email textbox, Email me a magic link. Tab order reached those product controls. `checkValidity()` was `false` with “Please include an '@' in the email address.” 320×800 had `innerWidth`/`scrollWidth` 320 (no horizontal overflow).

**Notes / evidence link:** `http://127.0.0.1:3000/`; Chromium via browser tool; 320×800 and 1280×800. Turbopack also exposed “Open Next.js Dev Tools”, which is not a product control.

### EH140-LOCAL-UI-02: Synthetic onboarding and authenticated app routes work

**Precondition:** Use the synthetic account `eh140.qa.20260903@example.test`; no real patient data is used. Local Supabase/Auth must be running.

1. Request a magic link through the landing form and complete it from the local Mailpit message.
2. Enter `QA` / `EH140` at the profile gate.
3. Uncheck a required consent and confirm **Continue** is disabled; restore it and continue.
4. Visit `/app`, `/app/profile`, `/app/timeline`, `/app/biomarkers`, `/app/documents`, `/app/reports`, and `/app/upload`.
5. Repeat the app shell check at 320×800.

**Expected result:** The profile and required-consent gates enforce their prerequisites. Each available route loads without a route error, has named navigation controls, and remains usable without horizontal overflow at the narrow viewport.

**Result:** `Blocked` — Docker Desktop was not running (`dockerDesktopLinuxEngine` missing) and `http://127.0.0.1:54321/auth/v1/health` did not connect. Unauthenticated `/app`, `/app/profile`, `/app/timeline`, `/app/biomarkers`, `/app/documents`, `/app/reports`, and `/app/upload` all returned HTTP 307 to `/?signin=required`. A 2026-09-01 signed-in pass exists in git history but was not reproduced today.

**Notes / evidence link:** Knowledge Base routes remained 404 and are recorded as blocked below.

### EH140-LOCAL-UI-03: Legal links resolve

**Precondition:** Stay signed in with the synthetic account.

1. Open `/legal/privacy`, `/legal/terms`, and `/legal/cookies`.
2. Confirm each page exposes its expected heading and named links.

**Expected result:** Each legal page loads successfully and has a descriptive page heading.

**Result:** `Pass` — all three pages loaded; `h1` values were `Privacy Policy`, `Terms of Service`, and `Cookie Policy`; unnamed `<a>` count was 0.

**Notes / evidence link:** `http://127.0.0.1:3000/legal/privacy`, `/legal/terms`, `/legal/cookies`.

## Interface checks

### EH140-UI-01: Article copy is educational, not diagnostic or prescriptive

**Precondition:** `EH140-SAFE-ARTICLE` is published in the EH-134 article template and its source/review metadata is visible.

1. Open **Knowledge Base**.
2. Open the biomarker article for `EH140-SAFE-ARTICLE`.
3. Read **What it measures**, aliases/units/specimen, interpretation factors, sources, and disclaimer from top to bottom.
4. Confirm that the page does not address the reader with a diagnosis, certainty statement, treatment or medication instruction, or test-order prompt.

**Expected result:** The page explains the measurement and its context only. It does not say that a person has or does not have a condition, does not prescribe or change treatment, and does not direct the user to order a test. A prohibited-claim finding is a release-blocking failure.

**Result:** `Pass` — public hemoglobin article at `/knowledge/biomarkers/hemoglobin` is educational. Visible sections: What it measures, Aliases (`hemoglobin`, `hgb`, `hb`), Common units (`g/dL`, `g/L`), Specimen (whole blood), Panel membership, Interpretation factors, Sources, Educational disclaimer (“not medical advice, diagnosis, or treatment”). No reader-addressed diagnosis, treatment instruction, or test-order prompt. Authenticated `/app/knowledge/measurements/hemoglobin` was not re-run (Auth down).
**Notes / evidence link:** `http://127.0.0.1:3000/knowledge/biomarkers/hemoglobin`; Chromium 1280×800 on 2026-09-04.

### EH140-UI-02: External ranges stay out of education and assessment

**Precondition:** `EH140-SAFE-ARTICLE` is available, and `EH140-RESULT-A` is processed for the same synthetic account.

1. Open the biomarker article in **Knowledge Base**.
2. Inspect the article for universal normal/reference ranges, threshold tables, score inputs, or assessment-status claims.
3. Follow the article's link to the user's result.
4. Open the linked document source and compare the displayed result range with the range used by **Health Profile** or **Biomarkers**.

**Expected result:** The article contains no external or universal range used for interpretation. The user's displayed range is traceable to `EH140-RESULT-A` and its source document. Knowledge Base copy or citations never change assessment eligibility, readiness, score, or status.

**Result:** `Partial` — the public hemoglobin article has no universal/normal/reference-range table, score inputs, or assessment-status claims. The private-workspace control “Open Hemoglobin” points at `/app/biomarkers?measurement=hemoglobin_whole_blood`. Document-range vs Health Profile comparison was not executed: Docker/Supabase down, so the user-result deep link and assessment coupling could not be traced.
**Notes / evidence link:** Public article copy only; authenticated result path still blocked.

### EH140-UI-03: Sources and review metadata are visible

**Precondition:** A published biomarker article and CBC/panel page are deployed with approved source records.

1. Open the article for `EH140-SAFE-ARTICLE`.
2. Locate the visible **Sources** section and last-reviewed date.
3. Activate each source link with keyboard or pointer.
4. Return to the article and repeat for the CBC/panel page.

**Expected result:** Every published page visibly shows its sources and last-reviewed date. Each link has a descriptive accessible name and reaches the declared source. A missing source or broken required link blocks publication.

**Result:** `Fail` — hemoglobin article **Pass**: Sources lists named link “Hemoglobin Test” → `https://medlineplus.gov/lab-tests/hemoglobin-test/` (HTTP HEAD 200); Review metadata shows Clinical Product / Medical Reviewer and last reviewed September 1, 2026. CBC panel page **Fail**: `/knowledge/panels/cbc` has no Sources section, no last-reviewed date, and no educational disclaimer. Missing sources on a published panel page block publication per this case.
**Notes / evidence link:** `http://127.0.0.1:3000/knowledge/biomarkers/hemoglobin`; `http://127.0.0.1:3000/knowledge/panels/cbc`.

### EH140-UI-04: Index search, aliases, filters, and breadcrumbs are usable

**Precondition:** EH-138 **Knowledge Base** index is deployed with `EH140-SAFE-ARTICLE`, a CBC panel, and synthetic aliases.

1. Open **Knowledge Base**.
2. Search for the canonical hemoglobin name.
3. Repeat the search with each synthetic alias.
4. Filter to panels, open the CBC page, and use its breadcrumb to return to the index.
5. Open the article from a result and use its breadcrumb to return to the filtered list.

**Expected result:** Canonical and alias searches return the expected article; the panel filter does not hide or mix unrelated content; breadcrumbs preserve the current navigation context; no private result values appear in public article cards.

**Result:** `Pass` — `/knowledge?q=hemoglobin` → 2 published measurements matching hemoglobin, including Hemoglobin. `/knowledge?q=Hgb` → 1 published measurement with “Matched alias: hgb”. `/knowledge?q=zzzz-not-a-measurement` → 0 published measurements and “No published measurements found”. `/knowledge?panel=cbc` selected Complete blood count and listed CBC members without mixing glucose/TSH/ALT. Breadcrumb on article is “Knowledge Base / Hemoglobin”; on CBC “Knowledge Base / Complete blood count”. Public cards showed educational summaries, not private result values.
**Notes / evidence link:** `http://127.0.0.1:3000/knowledge` and the query URLs above.

### EH140-UI-05: Keyboard-only operation reaches every blocking control

**Precondition:** EH-138 index/search and EH-134/EH-135 pages are deployed. Disconnect the pointer or do not use it.

1. Open **Knowledge Base** and press `Tab` from the page start.
2. Move through search, category/panel filters, result links, breadcrumbs, source links, and user-result deep links.
3. Activate search/filter/link controls with Enter or Space as appropriate.
4. Repeat after a no-results search and after clearing the search.

**Expected result:** Every control receives a visible focus indicator in logical order and can be activated without a pointer. Focus does not disappear or jump to an unrelated surface. Search/filter state and no-results state remain understandable.

**Result:** `Partial` — search, category, panel, Apply, result links, and breadcrumbs are present and named. A complete Tab sequence was not proven: Next.js 15.5.24 Turbopack overlay captured Tab (`nextjs-portal`) in this Chromium tool session. Search via GET URLs worked; form submit via fill+Apply once failed to change the URL. User-result deep links remain unauthenticated.
**Notes / evidence link:** Chromium via browser tool on `http://127.0.0.1:3000/knowledge`; overlay is a dev-server confounder, not a product control.

### EH140-UI-06: Screen-reader names and state changes are announced

**Precondition:** EH-138 index/search is deployed. Use the supported browser and screen-reader pairing recorded above.

1. Open **Knowledge Base** and navigate by landmarks and headings.
2. Identify the search input, submit/clear controls, category/panel filters, result count, breadcrumbs, source links, and article headings.
3. Submit a canonical search, an alias search, and a no-results search.
4. Change a panel filter and listen for the result-count or selected-state announcement.

**Expected result:** Landmarks and headings form a meaningful structure. Controls have descriptive names and roles. Search/filter result changes are conveyed without relying on visual color or position, and focus remains understandable.

**Result:** `Blocked` — no supported screen-reader pairing. Static tree notes only: one `main`, header, breadcrumb nav labelled “Breadcrumb”, named searchbox “Search measurements and panels”, named Category/Panel comboboxes, named Apply. Result-count text is visible but there is no `aria-live` region. Several “View category” links share the same accessible name. This is not a screen-reader pass.
**Notes / evidence link:** Chromium accessibility tree on `/knowledge`; NVDA/VoiceOver not run.

### EH140-UI-07: Long content reflows on mobile

**Precondition:** EH-134/EH-135/EH-138 pages are deployed. Use `EH140-LONG-COPY` and test at the supported mobile viewport widths, including 320 CSS px if supported.

1. Open the **Knowledge Base** index at the narrow viewport.
2. Search for the long alias and open its article.
3. Open the CBC/panel page and expand or inspect long member/source labels.
4. Scroll horizontally and vertically without zooming the page.
5. Activate breadcrumbs, source links, filters, and the user-result deep link.

**Expected result:** Text wraps without horizontal clipping, overlap, or hidden source/review metadata. Critical controls remain reachable and have readable labels at every supported width. No behavior depends on hover.

**Result:** `Pass` — at 320×800 CSS px, `/knowledge`, `/knowledge/biomarkers/hemoglobin`, and `/knowledge/panels/cbc` all had `innerWidth`/`scrollWidth` 320 (no horizontal overflow). Long CBC member labels wrapped. Dedicated `EH140-LONG-COPY` fixture was not injected; live CBC member list was used instead.
**Notes / evidence link:** Chromium viewport 320×800; 2026-09-04.

### EH140-UI-08: Private result links do not cross accounts

**Precondition:** `EH140-RESULT-A` belongs only to synthetic account A and `EH140-RESULT-B` belongs only to synthetic account B. EH-138 deep links are deployed.

1. Sign in as synthetic account A and open the article/index.
2. Follow every user-result link shown from the article or biomarker row.
3. Sign out, sign in as synthetic account B, and repeat.
4. Refresh each account's browser session and do not paste another account's private URL as a substitute for a product flow.

**Expected result:** Public article content is the same for both accounts, while each account sees only its own result/document links and values. No article card, search result, breadcrumb, or deep link exposes the other account's private data.

**Result:** `Blocked` — public cards do not show private values, but two-account isolation of `/app/biomarkers?measurement=hemoglobin_whole_blood` was not run. Docker/Auth down; second synthetic account not signed in.
**Notes / evidence link:** Unauthenticated private links redirect to `/?signin=required`. `/app/knowledge/panels/cbc` returned HTTP 500 in this checkout (`content.ts` client chunk error) instead of a clean 307.

### EH140-UI-09: Broken source links block publication

**Precondition:** A disposable draft containing `EH140-BROKEN-LINK` is available in a review environment. Do not publish it.

1. Open the draft in the content-review interface.
2. Run the page's source-link review or open the visible source list.
3. Activate the intentionally missing relative link.
4. Replace or remove the missing link, rerun the review, and inspect the source list again.

**Expected result:** The missing local target is visible as a failure and the draft cannot be accepted as published. After repair/removal, the failure disappears and the source list remains visible. No broken draft is presented as published guidance.

**Result:** `Blocked` — no content-review UI session with `EH140-BROKEN-LINK`. EH-139 files are in this checkout after the master merge, but the disposable broken-draft path was not exercised.
**Notes / evidence link:** Strict `pnpm check:eh140-kb` passed on published files; that does not certify the review-screen negative path.

## Developer evidence required

- [x] `pnpm test:eh140` passed on 2026-09-04 after the master merge: `audited 28 Knowledge Base files with no blocking findings`. **Provider:** developer/CI. Static audit is not release acceptance.
- [x] `pnpm check:eh140-kb` strict mode passed on 2026-09-04 after the master merge with the same 28-file audit and no findings. Manual CBC source-gap (EH140-UI-03) is still a release blocker the static gate did not flag. **Provider:** developer/CI.
- [x] `pnpm typecheck` passed with the EH-140 policy and verifier. **Provider:** developer/CI; last observed 2026-09-03 on this branch.
- [x] `pnpm check:ci-suite-coverage-contract` and `pnpm check:ci-suite-coverage` passed; the EH-140 suite is workflow-reachable (`90 covered, 0 local-only, 0 orphaned, 0 partial, 0 invalid`). **Provider:** developer/CI; observed locally on 2026-09-01.
- [x] `pnpm check:documentation-links` passed for the repository documentation index (`10 links resolve`). **Provider:** developer/CI; observed locally on 2026-09-01. The EH-140 local-link check is offline; external source URLs still require manual review evidence.
- [ ] Docker and Supabase smoke checks failed on 2026-09-04: Docker Desktop was not running and `http://127.0.0.1:54321/auth/v1/health` did not connect. A 2026-09-01 pass is not treated as current evidence. **Provider:** developer/CI.
- [x] Unauthenticated `/api/profile`, `/api/biomarkers`, `/api/health-profile`, `/api/timeline`, and `/api/reports` returned HTTP 401 on 2026-09-04. **Provider:** developer/CI.
- [ ] Authenticated synthetic-account API smoke was not re-run on 2026-09-04 because Auth/Supabase were down. The 2026-09-01 run had `/api/reports` HTTP 500 (`permission denied for table reports`); that backend defect is still not an EH-140 Knowledge Base acceptance result. **Provider:** developer/CI.
- [ ] Clinical/editorial reviewer signs off every published article and panel page, including prohibited-claim scan findings and source/review metadata. **Provider:** Clinical Product.
- [ ] Accessibility reviewer supplies executed keyboard, supported screen-reader, and mobile evidence for all UI cases above. Static checks do not satisfy this requirement. **Provider:** QA / Accessibility.
- [ ] Release owner confirms every P0 finding is closed or formally dispositioned before accepting the Knowledge Base MVP. **Provider:** release owner.

## Out of scope or not manually testable yet

- EH-133 article persistence/schema, EH-134 article-template implementation, EH-135 panel/CBC implementation, EH-136 first ten pages, EH-137 related-measurement graph, EH-138 index/search implementation, and EH-139 publication workflow are dependency work, not invented by this review.
- Database migrations, resolver/normalization behavior, Health Profile scoring, document-sourced reference-range parsing, and private-data authorization are not changed by EH-140. Use the existing document/assessment contract suites for those paths.
- Static safety, link, and JSX checks are developer evidence and cannot certify clinical wording, remote URL availability, keyboard order, screen-reader output, or mobile reflow.
- Do not mark a blocked case `Pass` because a source file looks correct or because the deterministic verifier passes its in-memory fixtures. Re-run each case against the deployed dependency surface and record the exact evidence.
