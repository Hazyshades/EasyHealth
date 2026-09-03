# EH-135: Build panel article template and CBC page

**Roadmap status:** In progress — implementation and engineering/UI verification delivered locally; merge/release evidence pending
**Build / environment:** `http://localhost:3001` with dedicated synthetic local account `eh135-ui-local@example.test` (no real patient data)
**Test run date:** `2026-09-02`
**Tester:** `Engineering verification`

## What this checklist covers

This checklist covers the authenticated Knowledge surface for the complete blood count (CBC). It verifies that the page explains a panel as a variable group, separates red-cell, white-cell, and platelet measurements, labels optional and related markers neutrally, and keeps a user's saved CBC results separate from general education. It does not treat a missing member as a medical finding and does not verify clinical interpretation.

## Before you start

- [x] Use a dedicated synthetic local account with no real patient data.
- [x] Use only synthetic or de-identified laboratory documents; this run uploaded no document and used controlled local fixtures only.
- [x] Confirm any uploaded synthetic laboratory document has finished processing before checking saved results; no upload was used in this run.
- [x] Prepare a browser at desktop width and a narrow mobile width; keep keyboard navigation available.
- [x] Do not mark a check as passed when the authenticated environment or synthetic fixture is unavailable; record the exact blocker instead.

## Test data

| ID                  | Test document or setup                                                                                                                                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `EH135-CBC-MIXED`   | Synthetic CBC report containing hemoglobin, hematocrit, RBC, WBC, platelets, MCV, and one differential result; omit at least one optional CBC member. | Populated CBC result links and variable composition.              |
| `EH135-CBC-RELATED` | Synthetic laboratory report containing a CBC member plus ferritin or serum iron, with a filename that includes `CBC`.                                 | Exact-key membership and related-marker boundary.                 |
| `EH135-CBC-EMPTY`   | Dedicated account with no accepted CBC observations, or a controlled no-result response in a local test environment.                                  | Empty-state copy without fabricated values.                       |
| `EH135-CBC-ERROR`   | Controlled local request failure for `/api/biomarkers`, if the environment supports it without changing stored data.                                  | Retryable result-section failure while education remains visible. |

## Interface checks

### EH135-UI-01: Discover the CBC guide

**Precondition:** The dedicated account can open the authenticated app.

1. Open **Knowledge** from the sidebar on desktop.
2. On mobile, resize to the narrow test width and open **Knowledge** from the bottom navigation.
3. Select **Read the CBC guide**.

**Expected result:** The Knowledge index identifies the complete blood count guide and the link opens `/app/knowledge/panels/cbc`. The existing Dashboard, Health Profile, Timeline, Biomarkers, Documents, and Reports destinations remain available.

**Result:** `Pass`
**Notes / evidence link:** The authenticated synthetic account opened `/app/knowledge`, which rendered the CBC guide and `/app/knowledge/panels/cbc` link. Existing Dashboard, Health Profile, Timeline, Biomarkers, Documents, and Reports links were present. At 390px the bottom-navigation **Knowledge** link returned to `/app/knowledge`.

### EH135-UI-02: Read the panel purpose and composition caveat

**Precondition:** The CBC guide is open.

1. Read the page header and **What this panel is** section.
2. Locate the **Panel composition varies** note before the member details.
3. Confirm the page identifies the guide as an **Educational preview** with **Clinical review pending**.

**Expected result:** The page explains that a CBC is a group of measurements and explicitly says laboratories may include different members. It does not say that every report contains every member and does not present the preview as clinically reviewed.

**Result:** `Pass`
**Notes / evidence link:** The desktop and mobile CBC article rendered **Educational preview** and **Clinical review pending**, followed by the panel-purpose explanation and **Panel composition varies** caveat.

### EH135-UI-03: Distinguish CBC subgroups and member roles

**Precondition:** The CBC guide is open.

1. Locate **Red-cell measurements**, **White-cell measurements**, and **Platelet measurements**.
2. Confirm hemoglobin, hematocrit, and red-cell indices are in the red-cell section.
3. Confirm WBC and differential measurements are in the white-cell section.
4. Confirm platelet count and platelet indices are in the platelet section.
5. Inspect several member cards marked **Core panel member** and **Often included**.
6. Locate **Related measurements** and inspect its role labels.

**Expected result:** The three groups are visually and semantically distinct. Optional members use neutral **Often included** language, related markers use **Related marker**, and no card claims a measurement is universal or guaranteed on every report.

**Result:** `Pass`
**Notes / evidence link:** The article exposed distinct **Red-cell measurements**, **White-cell measurements**, and **Platelet measurements** headings. Member cards used **Core panel member**, **Often included**, and **Related marker** role labels; no universal-membership claim was shown.

### EH135-UI-04: Keep saved CBC results separate and source-linked

**Precondition:** `EH135-CBC-MIXED` is processed and its accepted observations are visible to the dedicated account.

1. Open the CBC guide and locate **Your CBC results**.
2. Confirm saved CBC values show their value, unit, observed date, and source filename.
3. Click a result card.
4. Confirm the destination is **Biomarkers** and that the selected measurement/observation context is retained.
5. Return to the CBC guide and open the document from the Biomarkers source link.

**Expected result:** User data appears only in the separate results section and links back to the existing Biomarkers/source navigation. The article cards do not display a user's value, status, reference range, or assessment result.

**Result:** `Blocked`
**Notes / evidence link:** No accepted `EH135-CBC-MIXED` document was uploaded for this run, so populated result cards and source-return clicks were not manually exercised. `pnpm test:eh135` still covers deterministic result selection and source-link projection.

### EH135-UI-05: Do not infer CBC membership from names or related markers

**Precondition:** `EH135-CBC-RELATED` is processed for the dedicated account.

1. Open the CBC guide.
2. Confirm the CBC-keyed observation appears in **Your CBC results**.
3. Search the page for the report's ferritin/serum-iron value and the filename containing `CBC`.
4. Open **Related measurements**.

**Expected result:** Only the observation with an exact CBC Registry member key appears in **Your CBC results**. The related iron-study observation does not become a CBC result because of its display name or filename; it is described only as a related marker in general education.

**Result:** `Blocked`
**Notes / evidence link:** No `EH135-CBC-RELATED` populated fixture was uploaded for this run. Exact-key inclusion and related-marker rejection remain covered by `pnpm test:eh135`.

### EH135-UI-06: Empty and failed result states preserve education

**Precondition:** Use `EH135-CBC-EMPTY` for the empty path and `EH135-CBC-ERROR` only in a controlled local environment.

1. Open the CBC guide with no saved CBC observations.
2. Confirm the education sections, sources, and disclaimer remain visible.
3. Verify the result section says no CBC results are linked and offers **Upload document** and **Go to Biomarkers**.
4. If the controlled error setup is available, reload the page with the biomarker request failing.
5. Select **Try again** once the controlled failure is removed.

**Expected result:** Empty results never show fabricated values. A failed result request produces an inline retryable error while the article remains readable; a subsequent successful request replaces it with the saved result state.

**Result:** `Pass`
**Notes / evidence link:** With the authenticated account empty, the article retained education, sources, disclaimer, and **No CBC results are linked yet**, **Upload document**, and **Go to Biomarkers** copy. A browser-intercepted 500 response for `/api/biomarkers` rendered a `[role="alert"]` with **Your saved results are unavailable** and **Try again**; removing the interception and reloading restored the empty state.

### EH135-UI-07: Sources, disclaimer, and responsive keyboard access

**Precondition:** The CBC guide is open at desktop and narrow mobile widths.

1. Tab through the page from the browser address bar.
2. Open each source link in a new tab and confirm the visible title and publisher match the source list.
3. Confirm the disclaimer is visible at the end of the article.
4. Repeat the main navigation and result-link checks at narrow mobile width.

**Expected result:** Links have visible focus, source links open the declared external sources, the disclaimer remains visible, and subgroup/result content stays readable without horizontal clipping on the mobile layout.

**Result:** `Pass`
**Notes / evidence link:** At 1440px and 390px the article had no horizontal overflow (`scrollWidth` equaled the viewport width). The two source links exposed the declared publishers/URLs. Eighteen keyboard `Tab` steps reached interactive controls with visible focus, including result actions and both external source links.

## Developer evidence required

- [x] `pnpm test:eh135` passes. This proves article metadata, exact Registry-key coverage, subgroup/role boundaries, deterministic result selection, source preservation, and route/template wiring. Verified 2026-09-02.
- [x] `pnpm typecheck` passes for the typed content module, selector, template, route, and navigation changes. Verified 2026-09-02.
- [x] `pnpm build` passes with the repository's non-secret validation fixtures. Verified 2026-09-02; route table includes `/app/knowledge` and `/app/knowledge/panels/cbc`.
- [x] `openspec validate eh-135-build-panel-article-and-cbc-page --strict` passes. Verified 2026-09-02.
- [x] Registry documentation synchronization is recorded as consumer-only: canonical Registry pages are reviewed and unchanged, required generation/drift/test commands pass, and Wiki render/staging/publication status is linked in tracking issue [#220](https://github.com/Hazyshades/EasyHealth/issues/220).
- [x] `pnpm test:app-navigation-hot-path` passes, confirming the added Knowledge item does not break existing authenticated navigation contracts. Verified 2026-09-02.
- [x] `pnpm test:eh133` and `pnpm test:eh134` pass after syncing the canonical EH-133/EH-134 Knowledge Base contracts with EH-135. Verified 2026-09-02.
- [x] Compatibility repair coverage passes: the EH-134 verifier imports `measurementEducationArticleSchema` through the public Knowledge Base barrel, and the EH-131 verifier covers Biomarkers and nested Knowledge route labels. Verified 2026-09-02.
- [x] CI suite coverage passes: `92 covered, 0 local-only, 0 orphaned, 0 partial, 0 invalid`; EH-135 is explicitly invoked by `.github/workflows/measurement-registry.yml`.
- [x] Full CI application verifier matrix passed in grouped runs: aggregate `pnpm verify:registry`; all EH-104/105/106/111/112/113/116/117/119/120/121/122/123/126/127/128/129/130/131/132/133/134/135/141/142/143/144/145/146/147/162/163/164/165, panel, profile, document, and app-navigation suites.
- [x] Full CI database matrix passed against local Supabase, including all listed EH, PR2, panel-specimen, PostgREST alias, trace, service-role, and writer seam SQL contracts; PostgREST integration passed for all five consumers.
- [x] Authenticated browser smoke passed at desktop 1440px and mobile 390px: unauthenticated `/app/knowledge` and `/app/knowledge/panels/cbc` redirected to `/?signin=required`; authenticated `/app/knowledge` → CBC guide, empty results, 500/retry recovery, mobile navigation, source links, visible keyboard focus, and zero horizontal overflow.
- [x] Final review-fix smoke passed: a controlled `/api/biomarkers` 503 showed only the generic saved-results message, nullable `observed_at` parsed and rendered as **Date not recorded**, a converted synthetic result rendered its lab-reported value/unit, a long synthetic source filename stayed within its result card, and all seven 390px bottom-nav links retained 44px targets with no horizontal overflow. Verified 2026-09-03.

**Additional verification note:** Targeted Prettier checks pass for EH-135-owned files. Repository-wide `pnpm format:check` remains blocked by 543 pre-existing formatting warnings outside this change.

- **Environment note:** The initial CI-style worker check required the prescribed frozen worker install; the authenticated browser run used a dedicated local Supabase account and synthetic empty/error fixtures.

## Out of scope or not manually testable yet

- EH-133's canonical typed contract is available in the master baseline, but its broader content-authoring/review workflow, locale expansion, CMS/editor UI, and publication approval remain deferred. This checkout exposes the CBC article as an **Educational preview** with clinical review pending.
- Universal reference ranges, diagnosis, medical recommendations, test-order prompts, score interpretation, and assessment changes are out of scope.
- If an authenticated browser, synthetic result fixture, or controlled request-failure environment is unavailable, record the affected interface check as `Blocked` and attach the focused runner/typecheck/build evidence instead of marking it passed.
