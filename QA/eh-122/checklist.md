# EH-122: Batch verification for low-risk exact matches

**Roadmap status:** Implemented; exact-match fixture uploaded and projection verified; authenticated batch mutation blocked by staging schema drift
**Build / environment:** `localhost:3000` via authenticated Chrome relay; Supabase-backed staging data; Windows workspace
**Test run date:** 2026-08-13
**Tester:** Engineering automation

## What this checklist covers

This checklist covers the document-review workflow that lets a user verify several low-risk exact laboratory matches at once. Only rows with a reviewed exact match, complete compatible evidence, and no human edits or prior human decision may join the batch; incomplete, ambiguous, edited, or otherwise unsafe rows remain individual/raw-review work and must explain why they were skipped.

This checklist does not cover automatic verification, batch value/mapping correction, record rejection, or registry reprocessing.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [x] Confirm `EH122-EXACT-01` completed extraction and is visible under **Documents**; mixed, stale, and undo fixtures remain unavailable.
- [ ] Confirm the authenticated environment contains the delivered EH-122 build and its database migration; the UI build is present, but the staging schema check is blocked by a missing batch-operation table.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH122-EXACT-01` | [`QA/eh-122/fixtures/EH122-EXACT-01.pdf`](fixtures/EH122-EXACT-01.pdf), a synthetic laboratory document with six pending-review rows that have a reviewed exact match, complete compatible evidence, active source evidence, and no edits or prior human decision. | Normal batch-verification path. |
| `EH122-MIXED-02` | A synthetic laboratory document that includes one eligible exact row plus partial, ambiguous, normalized/OCR/fuzzy, incomplete-evidence, and manually corrected rows. | Exclusion explanations and individual-review preservation. |
| `EH122-STALE-03` | A synthetic document with at least two eligible rows; use two authenticated sessions or a prepared test hook to change one row after the first session opens confirmation. | Partial completion and stale-row feedback. |
| `EH122-UNDO-04` | A completed EH-122 batch with at least two verified rows; change one row individually after the batch. | Audit-safe partial undo. |

## Interface checks

### EH122-UI-01: Verify eligible exact matches

**Precondition:** In the authenticated test account, `EH122-EXACT-01` is extracted and open as document `a9784202-a549-405f-9204-5cf1efd04073` under **Documents**; six rows are awaiting review.

1. Open **Documents** and select `EH122-EXACT-01`.
2. In **Extracted biomarkers**, review the batch-verification selection.
3. Click **Verify eligible matches**.
4. Read the confirmation summary.
5. Confirm the action.
6. Wait for the review workspace to refresh.

**Expected result:** Only the eligible exact rows are selected by default. The confirmation summary reports the selected count and states that the current user will verify them. After confirmation, the rows show a verified-by-user state and remain linked to their source evidence; no raw extraction text or value is overwritten.

**Result:** Partial; selection and confirmation-summary checks passed, but the final batch transition was blocked by staging schema drift.
**Notes / evidence link:** The uploaded fixture produced six extracted rows, six matched rows, zero incomplete rows, and six server-projected eligible IDs with no exclusions.
The UI selected all six rows by default and displayed `6 eligible exact matches` with `0 results remain for individual review`.
After deselecting Hematocrit (HCT), the action changed to `Verify eligible matches (5)` and the confirmation summary reported five selected, one eligible match left unselected, and zero excluded for individual review.
Confirming the five-row batch returned `Could not find the table 'public.batch_verification_operations' in the schema cache`.
The document remained `6 matched · 0 incomplete · 6 not verified`; no batch-verified state was recorded. Migration `053_eh122_batch_verification_operations.sql` exists in the branch, but the local Supabase CLI is not linked to the authenticated staging project, so remote migration state could not be inspected.

### EH122-UI-02: Explain skipped rows and preserve individual review

**Precondition:** `EH122-MIXED-02` is open in **Documents**.

1. Open the document's **Extracted biomarkers** review pane.
2. Review rows that are partial, ambiguous, normalized/OCR/fuzzy, low-confidence, or corrected.
3. Open **Verify eligible matches** if it is available.
4. Read the exclusion section of the confirmation summary.
5. Cancel the confirmation.
6. Use the existing individual/raw-review affordance on one incomplete row without choosing a measurement mapping.

**Expected result:** Unsafe rows are not selectable for batch verification. The summary gives a clear skip reason for each excluded category. An incomplete row remains available for its existing individual/raw-acceptance path and is not presented as a verified concrete measurement.

**Result:** Passed for the supplied mixed/no-eligible path; eligible-batch coverage blocked
**Notes / evidence link:** `original.pdf` rendered in the authenticated review workspace with `12 not verified`: 7 resolved rows were individually excluded with `alias_not_exact` (two token-set matches and five normalized matches), while 5 incomplete/unmapped rows were excluded with `not_resolved`, `missing_definition`, and `winning_candidate_missing`. The UI showed `0 eligible exact matches`, a disabled `Verify eligible matches (0)`, and individual-review explanations; incomplete rows retained raw/individual acceptance without a concrete batch identity.

### EH122-UI-03: Deselect an otherwise eligible row

**Precondition:** `EH122-EXACT-01` is reset to pending review with at least two eligible rows.

1. Open **Verify eligible matches**.
2. Deselect one eligible row before opening confirmation.
3. Read the confirmation summary.
4. Confirm the remaining selection.
5. Refresh the document review pane.

**Expected result:** The summary distinguishes the deselected row from excluded rows. Only the still-selected rows become verified; the deselected row remains pending review and can be reviewed later.

**Result:** Partial; deselection and confirmation-summary behavior passed, but the final transition was blocked by staging schema drift.
**Notes / evidence link:** On the uploaded `EH122-EXACT-01` document, deselecting HCT changed the count from six to five and distinguished one eligible match left unselected from zero excluded rows. Confirming the remaining selection hit the missing `public.batch_verification_operations` table error, so HCT remained pending and no selected row became verified.

### EH122-UI-04: Partial result after a concurrent change

**Precondition:** `EH122-STALE-03` is open in two authenticated sessions.

1. In the first session, open the batch-verification confirmation but do not confirm it.
2. In the second session, edit or otherwise change one selected row using the normal individual flow.
3. Return to the first session and confirm the batch.
4. Read the outcome message and refresh the review pane.

**Expected result:** The changed row is not batch verified and has an actionable stale/changed explanation. Independent unchanged rows complete normally. The result clearly reports a partial outcome rather than incorrectly claiming full success.

**Result:** Blocked
**Notes / evidence link:** No `EH122-STALE-03` fixture or eligible batch was available; concurrency and partial completion require two sessions or an equivalent prepared test hook.

### EH122-UI-05: Undo only unchanged batch rows

**Precondition:** `EH122-UNDO-04` has a completed batch and one result has since been changed individually.

1. Open the document's batch result or history entry.
2. Start **Undo batch verification** and read the summary.
3. Confirm undo with a reason if prompted.
4. Refresh the review workspace and open **Change history** for both rows.

**Expected result:** The unchanged batch row returns to pending verification through a new history entry. The later-changed row is not overwritten and is reported as unavailable for undo. The history remains readable and shows an additional reversal transition rather than edited or deleted prior history.

**Result:** Blocked
**Notes / evidence link:** No completed batch operation was available, so partial audit-safe reversal could not be exercised.

### EH122-UI-06: Downstream safety regression

**Precondition:** Complete `EH122-EXACT-01`, then navigate to **Biomarkers** and **Health Profile**.

1. Open **Biomarkers** and locate one batch-verified row.
2. Open **Health Profile**.
3. Return to the document and inspect an incomplete/raw-accepted row from `EH122-MIXED-02`.

**Expected result:** A batch-verified exact row is displayed with its verified state and source document. The incomplete/raw-accepted row does not acquire a concrete definition or become eligible for downstream health-profile use merely because it was retained.

**Result:** Partial; downstream pages rendered, but the batch-verified postcondition was blocked.
**Notes / evidence link:** **Biomarkers** and **Health Profile** rendered in the authenticated relay without an application error. The document review still showed `6 matched · 0 incomplete · 6 not verified`, so no batch-verified row/source state could be asserted. The mixed/raw-retained fixture remains unavailable.

## Developer evidence required

- [x] `supabase db reset --local` rebuilt the disposable Docker database through migrations `001`–`054`, then `pnpm test:eh122-db` passed locally: 19 pgTAP checks cover metadata idempotency, ownership/RLS/grants, no copied source evidence, and append-only operation/revision behavior.
- [x] `pnpm test:writer-seam`, `pnpm test:eh121`, and `pnpm test:eh121-db` passed locally; they cover writer transition, actor/source/CAS boundaries, and trigger-backed history.
- [x] `pnpm test:eh122-db` passed locally: its first-promotion reversal creates a pending successor and asserts two immutable revisions and two EH-121 ledger events.
- [x] `pnpm test:eh122` passed locally: request preparation covers duplicate IDs and deterministic idempotency binding; service/route checks cover re-evaluation, ownership, replay, conflicting reuse, and partial reversal guards.
- [x] `pnpm test:eh122` passed locally: pure-policy fixtures exclude normalized/OCR/fuzzy/fold/provisional/incomplete/manual-decision/stale rows.
- [x] `pnpm test:eh122` passed locally: the workspace selection model verifies default selection counts only server-projected eligible IDs and keeps excluded rows out of the verification cohort.
- [x] `pnpm typecheck` and `pnpm build` passed locally with the frozen, hoisted dependency install. The production build includes both EH-122 API routes and `/app/documents/[id]`; it emitted only the pre-existing `metadataBase` configuration warnings.
  - [x] `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` passed; canonical Registry docs were regenerated and current.
  - [x] `pnpm render:biomarker-wiki` and the explicit local staging export passed. The generated seven-page Wiki mirror was published to `Hazyshades/EasyHealth.wiki` at commit `1b7c07b`.
- [x] `pnpm check:ci-suite-coverage-contract` and `pnpm check:ci-suite-coverage` passed: EH-122 node and pgTAP suites are workflow-reachable with 51 covered suites and no orphaned/partial entries.
- [x] Authenticated browser relay on `original.pdf` (`3a060458-ef26-4f11-8518-0e72e43b8f1a`) confirmed the server projection and UI: 12 pending rows, 7 non-exact resolved matches, 5 incomplete rows, 0 eligible IDs, disabled batch action, and no application error. The OpenSpec policy requires `aliasMatchType = exact`; normalized and token-set matches remain individual-review only.
- [x] `pdftotext` extracted all six exact labels and explicit row-level `Specimen: whole blood` evidence from `QA/eh-122/fixtures/EH122-EXACT-01.pdf`; direct resolver/policy probes returned `eligible: true` with `matchType: exact`, reviewed resolution authority, and no exclusion codes for `hemoglobin_whole_blood`, `hematocrit_whole_blood`, `rbc_whole_blood`, `wbc_whole_blood`, `platelets_whole_blood`, and `mcv_whole_blood`. `pnpm test:cbc-regression` passed all 48 checks.
- [x] Authenticated browser relay on `EH122-EXACT-01` (`a9784202-a549-405f-9204-5cf1efd04073`) confirmed the server projection and UI: six extracted/matched rows, zero incomplete rows, six eligible IDs, default all-six selection, correct five-selected/one-left-unselected confirmation summary after deselection, and the missing `public.batch_verification_operations` schema-cache error on confirmation.

## Out of scope or not manually testable yet

- Automatic verification, batch correction, rejection, and reprocessing are out of scope for EH-122.
- The Wiki is a generated mirror and is not test evidence; repository documentation and the delivered product are authoritative.
- The repository now contains the de-identified `EH122-EXACT-01` fixture, and it has been uploaded and extracted in the authenticated staging account. UI-01 and UI-03 reached selection and summary checks; final confirmation remains blocked until staging applies EH-122 migrations `053`–`054` and refreshes the PostgREST schema cache. Keep UI-04 and UI-05 blocked until the corresponding concurrency and completed-batch fixtures exist; UI-06's batch-verified assertion remains blocked for the same reason.
