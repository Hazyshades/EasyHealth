# EH-138: Knowledge Base index and search

**Roadmap status:** Implementation complete; pending PR merge
**Build / environment:** Local EasyHealth workspace; `pnpm test:eh138`, `pnpm test:app-navigation-hot-path`, `pnpm typecheck`, `pnpm build`, public browser smoke on `127.0.0.1:3000`, and authenticated browser smoke on `127.0.0.1:3008`
**Test run date:** 2026-09-01
**Tester:** Engineering verification

## What this checklist covers

This checklist covers the public Knowledge Base index, reviewed measurement search, panel filters, article and panel detail pages, and links back to authenticated Biomarkers. The Knowledge Base contains general educational content only; private result values, profile identifiers, observation identifiers, and document identifiers must not appear in public pages.

## Before you start

- [x] Use a dedicated synthetic test account for the authenticated Biomarkers link check; credentials remain environment-local and are not committed.
- [x] Use only synthetic or de-identified documents if the Biomarkers destination is exercised.
- [x] No personal laboratory values are required for the public Knowledge Base checks.
- [x] Confirm the application is running from the EH-138 build and the public route is reachable.

## Test data

| ID               | Test document or setup                                                                                       | Purpose                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `KB-SEARCH-01`   | Search terms `Hemoglobin`, `HGB`, and `гемоглобин hgb`                                                       | Canonical and reviewed alias search                             |
| `KB-PANEL-01`    | Panel filter `Complete blood count` / `cbc`                                                                  | CBC membership and required/optional grouping                   |
| `KB-CATEGORY-01` | Category filter `Blood`                                                                                      | Category filtering without private data                         |
| `KB-NEGATIVE-01` | Search terms `2026` and `not-a-real-measurement`                                                             | Safe empty-result behavior for invalid/unknown input            |
| `KB-ACCOUNT-01`  | Dedicated local test account with synthetic document `EH138-UI-CBC-SYNTHETIC.pdf` and Hemoglobin `14.2 g/dL` | Authenticated destination only; not displayed in public content |

## Interface checks

### EH138-UI-01: Browse the public Knowledge Base

**Precondition:** The application is running and no authenticated session is required.

1. Open `/knowledge` in a private/incognito browser window.
2. Confirm the page title is **Knowledge Base** and the header identifies general information about measurements and panels.
3. Confirm the page shows **Browse panels**, category sections, and measurement cards.
4. Confirm the global navigation exposes **Knowledge Base**.

**Expected result:** The page loads without authentication, shows reviewed educational content and panel cards, and does not show a user's result value, profile ID, observation ID, or document ID.

**Result:** `Pass` — anonymous browser smoke loaded `/knowledge` with the public header, panel cards, category groups, measurement cards, and search controls.
**Notes / evidence link:** Local browser smoke on 2026-09-01; no private values or identifiers rendered.

### EH138-UI-02: Search canonical names and aliases

**Precondition:** `/knowledge` is open with no other filters selected.

1. Enter `Hemoglobin` in the **Search** field and select **Apply**.
2. Confirm a **Hemoglobin** measurement result appears and is labeled **Canonical measurement**.
3. Replace the query with `HGB` and select **Apply**.
4. Confirm **Hemoglobin** appears and the result identifies the matched alias.
5. Replace the query with `гемоглобин hgb` and select **Apply**.
6. Confirm the same reviewed Hemoglobin article is returned.

**Expected result:** Canonical, case-insensitive, and reviewed multilingual alias searches resolve to the same public article. Results contain educational copy only and do not expose private record data.

**Result:** `Pass` — browser search for `Hemoglobin` returned the canonical result and `HGB` returned Hemoglobin with `Matched alias: hgb`; the multilingual variation is covered by `pnpm test:eh138`.
**Notes / evidence link:** Local browser smoke and `scripts/verify-eh138-knowledge-base.ts` on 2026-09-01.

### EH138-UI-03: Filter by category and panel

**Precondition:** `/knowledge` is open.

1. Select **Blood** in the **Category** control and select **Apply**.
2. Confirm every displayed measurement belongs to the Blood category.
3. Clear the category, select **Complete blood count** in **Panel**, and select **Apply**.
4. Confirm the results are CBC members such as Hemoglobin, Hematocrit, MCV, Platelet count, or White blood cell count.
5. Confirm no unrelated measurement such as serum Glucose appears in the CBC-filtered results.

**Expected result:** Category and panel filters narrow the public catalog without mixing categories or unrelated measurements. The selected filter remains visible in the URL and controls.

**Result:** `Pass` — category filtering returned only Blood article links; CBC filtering returned the five published CBC article links and excluded serum Glucose. The selected filters remained in the URL and controls.
**Notes / evidence link:** Current anonymous browser smoke on 2026-09-01; `pnpm test:eh138` also verifies category/panel invariants.

### EH138-UI-04: Open a measurement article and return to private results

**Precondition:** The Hemoglobin result from `KB-SEARCH-01` is visible.

1. Select the **Hemoglobin** result card.
2. Confirm the URL is `/knowledge/biomarkers/hemoglobin` and breadcrumbs include **Knowledge Base** and **Blood**.
3. Confirm the page shows **What it measures**, **Factors that can affect interpretation**, **Registry details**, **Also called**, **Sources**, and a medical disclaimer.
4. Confirm **Related reading** includes the editorially related **Complete blood count** panel and does not add unrelated registry memberships such as **Iron studies**.
5. Confirm the page includes **View your result**.
6. Select **View your result** and sign in with `KB-ACCOUNT-01` if prompted.
7. Confirm the destination is the authenticated Biomarkers area, the URL preserves `measurement=hemoglobin_whole_blood`, and the private series shows the synthetic source and value.

**Expected result:** The article is accessible as public general education, gives source and review metadata, limits panel links to its declared published panel pages, and links to `/app/biomarkers?measurement=hemoglobin_whole_blood`. Authentication gates the private destination, not the public article; the public article does not display the private value before navigation.

**Result:** `Pass` — authenticated smoke on 2026-09-01 opened the public Hemoglobin article without private values or identifiers and without `/api/` or Supabase resources, then followed **View your result** to `/app/biomarkers?measurement=hemoglobin_whole_blood`. The destination rendered the synthetic `EH138-UI-CBC-SYNTHETIC.pdf` row with `142 g/L` / laboratory `14.2 g/dL`, and no loading state remained.

**Notes / evidence link:** Local authenticated browser smoke on `127.0.0.1:3008`; the dedicated local Supabase account and synthetic fixture were purged after verification, and no test data is stored in the repository. Additional local browser smoke on 2026-09-03 verified Hemoglobin's related-reading panel link was `/knowledge/panels/cbc` and did not include `/knowledge/panels/iron-studies`.

- [x] Browser/network evidence reviewed for anonymous `/knowledge`, canonical and alias search, category/CBC filters, `/knowledge/biomarkers/hemoglobin`, and `/knowledge/panels/cbc`; anonymous and authenticated public article resources contained no `/api/` or Supabase calls after the route-aware AuthProvider boundary, no private identifiers were rendered, and the authenticated CTA rendered only the synthetic private observation after navigation.

### EH138-UI-05: Open a panel article and inspect membership semantics

**Precondition:** The CBC panel card or CBC-filtered result is visible.

1. Select the **Complete blood count** panel card.
2. Confirm the URL is `/knowledge/panels/cbc` and the page identifies a **Panel guide**.
3. Confirm the page shows **Measurements in this panel**, **Usually included**, and, when applicable, **May be included**.
4. Confirm Hemoglobin is shown as a required / usually included member and optional members are visibly distinguished.
5. Confirm the page states that exact composition varies by laboratory and points to the user's own report as the source of truth.
6. Select a linked member such as **Hemoglobin** and confirm it opens the corresponding public measurement article.

**Expected result:** Panel membership order and required/optional semantics are visible, linked members resolve to reviewed articles, and the page does not imply that every laboratory reports every member.

**Result:** `Pass` — `/knowledge/panels/cbc` rendered the ordered member list, **Usually included**, **May be included**, linked Hemoglobin content, and composition-variation guidance.
**Notes / evidence link:** Local browser smoke on 2026-09-01.

### EH138-UI-06: Handle unknown and invalid searches safely

**Precondition:** `/knowledge` is open.

1. Enter `not-a-real-measurement` in **Search** and select **Apply**.
2. Confirm the page shows an empty state and does not show unrelated articles as matches.
3. Enter `2026` in **Search** and select **Apply**.
4. Confirm the page remains an empty result state rather than reverting to the unfiltered catalog.
5. Clear the Search field and select **Apply**.
6. Confirm the normal catalog returns.

**Expected result:** Unknown, numeric-only, and other non-searchable input do not broaden into unrelated results. Clearing the query intentionally restores the catalog.

**Result:** `Pass` — `not-a-real-measurement` and numeric-only `2026` both showed the empty state; clearing the query restored the unfiltered 11-article catalog.
**Notes / evidence link:** Current anonymous browser smoke on 2026-09-01; `pnpm test:eh138` verifies the numeric-only boundary.

## Developer evidence required

- [x] `pnpm test:eh138` passes. It proves reviewed article metadata, canonical and multilingual alias matching, numeric-only empty results, category/panel filtering, stable panel membership, article deep-linking, source URLs, and public-route privacy boundaries. Evidence: `scripts/verify-eh138-knowledge-base.ts`.
- [x] `pnpm test:app-navigation-hot-path` passes. Existing authenticated navigation contracts remain intact.
- [x] `pnpm typecheck` and `pnpm build` pass. The production build generated the static Knowledge Base index, 11 measurement article paths, and 6 panel paths.
- [x] `pnpm check:documentation-links` passes; 10 links resolve.
- [x] `pnpm test:biomarker-docs` passes; generated Registry-backed documentation remains synchronized.
- [x] Browser/network evidence reviewed for anonymous `/knowledge`, canonical and alias search, category/CBC filters, `/knowledge/biomarkers/hemoglobin`, and `/knowledge/panels/cbc`; anonymous and authenticated public article resources contained no `/api/` or Supabase calls after the route-aware AuthProvider boundary, no private identifiers were rendered, and the authenticated CTA rendered only the synthetic private observation after navigation.
- [x] Database/migration evidence: **N/A**. EH-138 adds no tables, migrations, persistence, RPCs, or profile data access.
- [x] Wiki publication and tracking issue evidence: generated 7-page staging matched remote Wiki HEAD; Registry tracking issue #222 records `PUBLISHED`.

## Out of scope or not manually testable yet

- Personalized interpretation, diagnosis, reference-range decisions, assessment eligibility, and changes to Health Profile scoring are out of scope.
- Additional article authoring beyond the initial reviewed set is editorial follow-up, not an EH-138 UI failure.
- A tester cannot prove static-module boundaries from the interface alone; use `pnpm test:eh138`, typecheck, and browser/network evidence for that contract. If the dedicated test account or seeded synthetic data is unavailable in another environment, record that limitation rather than marking the authenticated destination as passed.
