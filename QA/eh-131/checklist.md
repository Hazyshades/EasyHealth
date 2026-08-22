# EH-131: Connect Biomarkers, Timeline, Documents and Health Profile

**Roadmap status:** In progress
**Build / environment:** Local EasyHealth workspace; `pnpm typecheck`, `pnpm test:eh131`
**Test run date:** 2026-08-21
**Tester:** Engineering verification

## What this checklist covers

This checklist covers the user-visible navigation contract between the Health Profile, Biomarkers, Health Timeline, and Document Review surfaces. A selected health system, measurement, observation, source document, timeline filter, and return destination must remain encoded in safe same-origin URL context so the user can move to source evidence and back without losing context.

The flows require an authenticated profile with processed synthetic documents and at least one extracted laboratory observation linked to a biomarker. No test uses real patient data. The normalized medical-event model and richer historical comparison behavior remain outside this change.

## Before you start

- [x] Use a dedicated local synthetic test account (`eh131-test@example.com`).
- [x] Use only synthetic or de-identified documents.
- [x] Confirm the synthetic navigation fixture is in completed state and has a linked laboratory observation.
- [ ] Confirm the account cannot access another profile's document by changing a document ID in the URL.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH131-DOC-01` | Synthetic completed laboratory report containing a numeric glucose or equivalent biomarker result, with a recorded specimen date | Health Profile → Biomarkers → source document |
| `EH131-BLOOD-01` | `QA/eh-131/fixtures/EH131-BLOOD-01.pdf`, a synthetic complete blood count with whole-blood hemoglobin, hematocrit, WBC, platelets, RBC, and MCV | Blood system upload and Blood → Biomarkers → source document |
| `EH131-DOC-02` | Synthetic completed laboratory report with a different document date and at least one extracted observation | Timeline date ordering, source link, and return context |
| `EH131-NEG-01` | A document ID belonging to a different test profile, or a non-existent document ID | Ownership and not-found boundary |
For `EH131-BLOOD-01`, complete the document-review mapping/verification step before testing Blood → Biomarkers navigation; the upload produced six extracted CBC rows with partial resolver status in the local run.

## Interface checks

### EH131-UI-01: Preserve profile, measurement, and document context

**Precondition:** `EH131-DOC-01` is processed for the signed-in test profile and appears in the Health Profile with a linked biomarker observation.

1. Go to **Health Profile** (`/app/profile`).
2. Select the system chip containing the system used by `EH131-DOC-01` (for example, **Metabolic**).
3. In the opened system details, click the linked marker name in the **Data** section.
4. Confirm **Biomarkers** opens with the selected measurement. An observation row is highlighted when the URL also supplies that observation context.
5. Click the observation's **source document** link.
6. Confirm **Document Review** opens for `EH131-DOC-01` and the breadcrumb/back control names **Biomarkers**.
7. Click the breadcrumb or back control.

**Expected result:** The browser returns to the Biomarkers view with the same selected measurement and nested return context. Direct observation context highlights the matching row. The document page never displays data from another profile, and no link redirects to an external origin.

**Result:** `Pass` — authenticated browser smoke used the synthetic profile and `EH131-DOC-01`; profile → Biomarkers preserved `system`, `measurement`, and nested `returnTo`. Follow-up smoke used `EH131-BLOOD-01` and observation `26154a4c-c877-4ed1-88a5-60751f401c68`; the Hemoglobin row was selected in Document Review, its source region was shown, and the Biomarkers back link restored the selected measurement context.
**Notes / evidence link:** Local browser relay smoke on 2026-08-21; synthetic documents only. The observation ID is local fixture evidence, not production data.

### EH131-UI-02: Preserve timeline filters and page on source-document return

**Precondition:** `EH131-DOC-01` appears as a completed event in the signed-in profile's timeline.

1. Go to **Health Timeline** (`/app/timeline`).
2. Set **Type** to **Lab results** and set a date range that includes `EH131-DOC-01`.
3. If pagination is available, move to page 2; otherwise open the equivalent direct URL with `page=2` and confirm the API request uses page 2.
4. Return to page 1 and click **Open source document** on the matching timeline event.
5. Confirm **Document Review** shows a **Health Timeline** breadcrumb/back control.
6. Click the breadcrumb or back control.

**Expected result:** The browser returns to the same timeline type, date range, page, and nested return context. The source-document link opens only the selected profile-owned document.

**Result:** `Pass` — source return preserved `type=lab_result`, `page=1`, `pageSize=10`, both dates, and the nested Health Profile return path. A direct `page=2` smoke produced an `/api/timeline?...page=2...` request; no second fixture was needed because the single synthetic event has no page-two row.
**Notes / evidence link:** Local browser smoke on 2026-08-21; synthetic document ID `13110000-0000-4000-8000-000000000131`.

### EH131-UI-03: Direct context URL and invalid-return fallback

**Precondition:** The signed-in test profile has a linked biomarker observation and at least one profile-owned source document.

1. Open a URL shaped like `/app/biomarkers?system=metabolic&measurement=glucose_serum&observation=<synthetic-observation-id>&returnTo=%2Fapp%2Fprofile%3Fsystem%3Dmetabolic`, replacing values with the synthetic fixture.
2. Confirm Biomarkers selects the requested measurement and highlights the requested observation when it is in the authenticated profile response.
3. Open the source document from the selected row.
4. Confirm the Document Review breadcrumb returns to the context encoded in `returnTo`.
5. Replace `returnTo` with `https%3A%2F%2Fexample.invalid%2Faccount` and reload the document URL.
6. Use the document back control.

**Expected result:** Valid same-origin context is preserved. Invalid or external return targets fall back to the local Documents route; the browser never navigates to `example.invalid` or another external origin.

**Result:** `Pass` — the synthetic observation row was highlighted, source navigation opened Document Review, valid context returned to Biomarkers, and an external `returnTo` fell back to `/app/documents`.
**Notes / evidence link:** Local browser smoke on 2026-08-21; observation ID `13110000-0000-4000-8000-000000000132`.

### EH131-UI-04: Ownership and not-found boundary

**Precondition:** `EH131-NEG-01` is available as a non-owned or non-existent document ID.

1. While signed in as the test profile, open `/app/documents/<EH131-NEG-01>`.
2. Wait for Document Review to finish loading.
3. If the page offers a retry action, do not retry more than once.

**Expected result:** The page reports **Document not found**, **Failed to load document**, or the equivalent non-disclosing error and provides a local Documents return action. It does not reveal metadata, extracted observations, source files, or signed URLs for another profile.

**Result:** `Pass` — a synthetic non-existent document ID returned the non-disclosing **Failed to load document** state with **Back to documents** and no external target.
**Notes / evidence link:** Local browser smoke on 2026-08-21; cross-profile ownership still requires a second authenticated profile.

## Developer evidence required

- [x] `pnpm test:eh131` proves URL encoding/decoding, same-origin return validation, route labels, selected measurement/observation propagation, source-link wiring, breadcrumb/back wiring, and ownership/query seams. Evidence: `scripts/verify-eh131-health-navigation.ts`.
- [x] `pnpm typecheck` proves the changed TypeScript/TSX modules compile without type errors.
- [x] `pnpm test:eh127` passes the existing timeline projection, pagination, date precedence, source-link, and unknown-date regression checks after the EH-131 navigation wiring.
- [x] `pnpm test:eh127-db` passes the local timeline fixture: 13 database assertions passed.
- [x] Authenticated UI smoke passed with copied root/worker environments, a synthetic profile, and synthetic document/observation fixture. Verified profile → Biomarkers → Document Review → return, timeline filters/page request → Document Review → return, valid nested context, and external-return fallback.
- [x] Static ownership/query seams are confirmed by `pnpm test:eh131`: Documents calls `assertDocumentOwner(profileId, id)` and Biomarkers/Health Profile reads remain profile-scoped. Runtime cross-profile confirmation still requires a second authenticated database fixture.

## Out of scope or not manually testable yet

- EH-126 normalized medical-event persistence and event splitting are not implemented by EH-131; the timeline continues to use the existing read-only projection.
- Cross-profile access, RLS, and signed-file authorization require a running authenticated database fixture and are not claimed as manually tested by this local checklist.
- A GitHub Wiki publication is not applicable to this navigation-only change because no Registry, biomarker catalog, alias, resolver, unit, corpus, assessment binding, or Health Profile laboratory projection contract changed.
