# EH-136: Publish first 10 reviewed biomarker pages

**Roadmap status:** In progress — implementation verified; medical release gate pending<br />
**Build / environment:** `Next.js 15.5.24 production build; Windows 11 local workspace`<br />
**Test run date:** `2026-09-01`<br />
**Tester:** `Codex browser smoke via headless Chromium; developer evidence by implementer`

## What this checklist covers

This checklist covers the ten public, English biomarker guides published for EH-136. It verifies that a visitor can open each stable page, read the reviewed measurement context and sources, and see a clear boundary between public education and private EasyHealth observations.

The pages are educational content only. They do not calculate results, display personal data, provide universal reference ranges, diagnose conditions, prescribe treatment, or change the assessment engine.

## Before you start

- [ ] Use a dedicated test account only when checking the private-workspace link.
- [ ] Use only synthetic or de-identified documents if the private workspace is exercised.
- [ ] Confirm that no real patient information is used in screenshots, notes, or links.
- [ ] Have a browser available at desktop and narrow mobile widths.
- [ ] Have network access available for the cited source-link check, or record the limitation.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH136-PUBLIC-01` | No upload required; use the ten stable URLs listed below | Normal public-page path |
| `EH136-PRIVATE-01` | Dedicated account with synthetic or de-identified accepted biomarker data, if authenticated workspace access is available | Verify the public/private boundary without exposing personal data |
| `EH136-NEGATIVE-01` | Direct URL `/knowledge/biomarkers/not-an-eh136-page` | Unknown-slug safe failure path |

## Interface checks

### EH136-UI-01: Open the ten reviewed guides

**Precondition:** The application is running and `EH136-PUBLIC-01` is available. No sign-in is required for the public pages.

1. Open each URL in a browser:
   - `/knowledge/biomarkers/hemoglobin`
   - `/knowledge/biomarkers/hematocrit`
   - `/knowledge/biomarkers/white-blood-cell-count`
   - `/knowledge/biomarkers/platelet-count`
   - `/knowledge/biomarkers/mcv`
   - `/knowledge/biomarkers/glucose`
   - `/knowledge/biomarkers/hba1c`
   - `/knowledge/biomarkers/tsh`
   - `/knowledge/biomarkers/alt`
   - `/knowledge/biomarkers/creatinine-egfr`
2. On each page, confirm the heading names the expected measurement.
3. Confirm the page shows **Reviewed**, a content version, and a last-reviewed date.
4. Confirm **Measurement details** shows Registry definitions, aliases, units, specimen, and panel membership (or the explicit no-curated-panel message).
5. Scroll through the article and confirm the educational sections, **Sources**, and **Educational disclaimer** are visible.

**Expected result:** All ten URLs load without sign-in, use the same accessible article layout, show the expected measurement identity, and contain no personal result values. No page shows a diagnosis, treatment instruction, test-order prompt, or universal numeric reference range.

**Result:** `Pass`<br />
**Notes / evidence link:** `Production smoke visited all ten stable URLs; each rendered the expected heading, Reviewed state, and at least one source link.`

### EH136-UI-02: Check the public/private data boundary

**Precondition:** Open any `EH136-PUBLIC-01` page. Use `EH136-PRIVATE-01` only if the private workspace is available.

1. Inspect the article, source list, and review metadata without signing in.
2. Confirm the **Your EasyHealth data** panel is a link to the private Biomarkers workspace rather than an inline result display.
3. Activate **Open [measurement]** while signed out.
4. If authentication succeeds with `EH136-PRIVATE-01`, confirm the destination is the private Biomarkers screen and only synthetic/de-identified observations are present.

**Expected result:** Public pages never display personal observations. The private-workspace link follows the normal authentication boundary; a signed-out visitor is redirected or asked to sign in rather than shown private data.

**Result:** `Pass`<br />
**Notes / evidence link:** `Signed-out activation of the Hemoglobin private-workspace link reached the normal auth boundary (home route with sign-in content); no personal observations were present on the public page.`

### EH136-UI-03: Verify source links and review evidence

**Precondition:** Open any loaded page from `EH136-PUBLIC-01`; network access is available for link checking.

1. Go to the **Sources** section.
2. Confirm each listed source has a title, publisher, and access date.
3. Open each source link in a new tab.
4. Return to the article and confirm the **Review metadata** card identifies the reviewer role and last-reviewed date.

**Expected result:** Every source link uses HTTPS and resolves to the cited source or its stable canonical page. The article remains readable if a source is temporarily unavailable; source availability is recorded as a release-review concern, not a sign-in or database dependency.

**Result:** `Pass`<br />
**Notes / evidence link:** `Browser smoke collected all 11 source links; each used HTTPS and returned HTTP 200 in the smoke environment. Review metadata was visible.`

### EH136-UI-04: Check narrow-screen and keyboard access

**Precondition:** Open `EH136-PUBLIC-01` in a desktop browser and at a narrow mobile viewport.

1. Resize the viewport to approximately 375px wide.
2. Confirm headings, metadata cards, source links, and disclaimer remain readable without horizontal scrolling.
3. Use the keyboard to move through the header links, private-workspace links, source links, related links, and the browser controls.
4. Activate one focused link with the keyboard.

**Expected result:** The page reflows into one readable column, focus remains visible, links have descriptive names, and keyboard activation follows the same destination as pointer activation.

**Result:** `Pass`<br />
**Notes / evidence link:** `At 375px viewport the creatinine/eGFR page had scrollWidth 375px for a 375px viewport; keyboard Tab reached seven descriptive links and focus remained on links.`

### EH136-UI-05: Reject an unknown page slug

**Precondition:** The application is running.

1. Open the `EH136-NEGATIVE-01` URL.
2. Observe the response and visible page.

**Expected result:** The unknown slug is not rendered as an article and returns the application's normal not-found response. No draft, review, or deprecated article is reachable through the public article route.

**Result:** `Pass`<br />
**Notes / evidence link:** `Unknown slug showed the application's 404 response and no article heading.`

## Developer evidence required

- [x] `pnpm test:eh136` proves the manifest is bounded to the ten EH-136 slugs, bodies and sources are present, Registry 2.0 and panel references resolve, required headings exist, unsafe-copy patterns are rejected, and public paths are deterministic. Output: `EH-136 Knowledge Base verification passed: 10 pages`.
- [x] `pnpm typecheck` completed successfully after the final source changes.
- [x] `pnpm build` completed successfully with Next.js 15.5.24; the route table reported `/knowledge/biomarkers/[slug]` as SSG with the ten launch paths.
- [x] Production browser smoke proved a published route renders, all ten launch routes load reviewed source-backed pages, the signed-out private link follows the auth boundary, the 375px layout has no horizontal overflow, and an unknown slug returns not found.
- [x] Review of the implementation scope confirms the change only adds Knowledge Base content/loader, template, public route, focused verifier, QA checklist, and package script; no observations, resolver behavior, assessment bindings, Health Profile scoring, external reference-range data, or document processing behavior was changed.
- [ ] Medical review remains human evidence: the recorded reviewer metadata and `reviewStatus` do not prove clinical sign-off by themselves. The Clinical Product / Medical Reviewer supplies explicit approval before the EH-136 release gate is marked complete.
- [x] Registry canonical docs and Wiki outputs are intentionally unchanged: EH-136 consumes existing reviewed Registry 2.0 definitions but does not change Registry data, aliases, units, panels, resolver behavior, or generated Registry documentation. If a later change alters those inputs, run the Registry documentation synchronization workflow separately.

## Out of scope or not manually testable yet

- A public Knowledge Base index, search, relationship graph, CMS/editor workflow, and panel pages are deferred roadmap work; do not report their absence as an EH-136 failure.
- Personalized interpretation, universal ranges, diagnosis, treatment recommendations, test ordering, and assessment or Health Profile integration are explicitly out of scope.
- Database, API, static-manifest integrity, and safe-copy assertions are not manually testable through the product UI; use the developer evidence above.
- Clinical approval cannot be established by a browser check or automated command. Keep the release gate open until the named medical reviewer records approval.
