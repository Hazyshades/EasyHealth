# EH-122: Batch verification for low-risk exact matches

**Roadmap status:** Implemented; authenticated manual QA blocked
**Build / environment:** Local Supabase; Windows workspace; local Documents route smoke-tested
**Test run date:** 2026-08-13
**Tester:** Engineering automation

## What this checklist covers

This checklist covers the document-review workflow that lets a user verify several low-risk exact laboratory matches at once. Only rows with a reviewed exact match, complete compatible evidence, and no human edits or prior human decision may join the batch; incomplete, ambiguous, edited, or otherwise unsafe rows remain individual/raw-review work and must explain why they were skipped.

This checklist does not cover automatic verification, batch value/mapping correction, record rejection, or registry reprocessing.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test documents have completed extraction and are visible under **Documents**.
- [ ] Confirm the authenticated environment contains the delivered EH-122 build and its database migration.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH122-EXACT-01` | A synthetic laboratory document with at least three pending-review rows that have a reviewed exact match, complete compatible evidence, active source evidence, and no edits or prior human decision. | Normal batch-verification path. |
| `EH122-MIXED-02` | A synthetic laboratory document that includes one eligible exact row plus partial, ambiguous, normalized/OCR/fuzzy, incomplete-evidence, and manually corrected rows. | Exclusion explanations and individual-review preservation. |
| `EH122-STALE-03` | A synthetic document with at least two eligible rows; use two authenticated sessions or a prepared test hook to change one row after the first session opens confirmation. | Partial completion and stale-row feedback. |
| `EH122-UNDO-04` | A completed EH-122 batch with at least two verified rows; change one row individually after the batch. | Audit-safe partial undo. |

## Interface checks

### EH122-UI-01: Verify eligible exact matches

**Precondition:** `EH122-EXACT-01` is open in **Documents** and all listed rows are awaiting review.

1. Open **Documents** and select `EH122-EXACT-01`.
2. In **Extracted biomarkers**, review the batch-verification selection.
3. Click **Verify eligible matches**.
4. Read the confirmation summary.
5. Confirm the action.
6. Wait for the review workspace to refresh.

**Expected result:** Only the eligible exact rows are selected by default. The confirmation summary reports the selected count and states that the current user will verify them. After confirmation, the rows show a verified-by-user state and remain linked to their source evidence; no raw extraction text or value is overwritten.

**Result:** Blocked
**Notes / evidence link:** Blocked — the local **Documents** route now renders and redirects to `/?signin=required`, but this workspace has no authenticated product session or prepared synthetic test documents. Execute in a deployed authenticated environment.

### EH122-UI-02: Explain skipped rows and preserve individual review

**Precondition:** `EH122-MIXED-02` is open in **Documents**.

1. Open the document's **Extracted biomarkers** review pane.
2. Review rows that are partial, ambiguous, normalized/OCR/fuzzy, low-confidence, or corrected.
3. Open **Verify eligible matches** if it is available.
4. Read the exclusion section of the confirmation summary.
5. Cancel the confirmation.
6. Use the existing individual/raw-review affordance on one incomplete row without choosing a measurement mapping.

**Expected result:** Unsafe rows are not selectable for batch verification. The summary gives a clear skip reason for each excluded category. An incomplete row remains available for its existing individual/raw-acceptance path and is not presented as a verified concrete measurement.

**Result:** Blocked
**Notes / evidence link:** Blocked — the local **Documents** route now renders and redirects to `/?signin=required`, but this workspace has no authenticated product session or prepared synthetic test documents. Execute in a deployed authenticated environment.

### EH122-UI-03: Deselect an otherwise eligible row

**Precondition:** `EH122-EXACT-01` is reset to pending review with at least two eligible rows.

1. Open **Verify eligible matches**.
2. Deselect one eligible row before opening confirmation.
3. Read the confirmation summary.
4. Confirm the remaining selection.
5. Refresh the document review pane.

**Expected result:** The summary distinguishes the deselected row from excluded rows. Only the still-selected rows become verified; the deselected row remains pending review and can be reviewed later.

**Result:** Blocked
**Notes / evidence link:** Blocked — the local **Documents** route now renders and redirects to `/?signin=required`, but this workspace has no authenticated product session or prepared synthetic test documents. Execute in a deployed authenticated environment.

### EH122-UI-04: Partial result after a concurrent change

**Precondition:** `EH122-STALE-03` is open in two authenticated sessions.

1. In the first session, open the batch-verification confirmation but do not confirm it.
2. In the second session, edit or otherwise change one selected row using the normal individual flow.
3. Return to the first session and confirm the batch.
4. Read the outcome message and refresh the review pane.

**Expected result:** The changed row is not batch verified and has an actionable stale/changed explanation. Independent unchanged rows complete normally. The result clearly reports a partial outcome rather than incorrectly claiming full success.

**Result:** Blocked
**Notes / evidence link:** Blocked — the local **Documents** route now renders and redirects to `/?signin=required`, but this workspace has no authenticated product session or prepared synthetic test documents. Execute in a deployed authenticated environment.

### EH122-UI-05: Undo only unchanged batch rows

**Precondition:** `EH122-UNDO-04` has a completed batch and one result has since been changed individually.

1. Open the document's batch result or history entry.
2. Start **Undo batch verification** and read the summary.
3. Confirm undo with a reason if prompted.
4. Refresh the review workspace and open **Change history** for both rows.

**Expected result:** The unchanged batch row returns to pending verification through a new history entry. The later-changed row is not overwritten and is reported as unavailable for undo. The history remains readable and shows an additional reversal transition rather than edited or deleted prior history.

**Result:** Blocked
**Notes / evidence link:** Blocked — the local **Documents** route now renders and redirects to `/?signin=required`, but this workspace has no authenticated product session or prepared synthetic test documents. Execute in a deployed authenticated environment.

### EH122-UI-06: Downstream safety regression

**Precondition:** Complete `EH122-EXACT-01`, then navigate to **Biomarkers** and **Health Profile**.

1. Open **Biomarkers** and locate one batch-verified row.
2. Open **Health Profile**.
3. Return to the document and inspect an incomplete/raw-accepted row from `EH122-MIXED-02`.

**Expected result:** A batch-verified exact row is displayed with its verified state and source document. The incomplete/raw-accepted row does not acquire a concrete definition or become eligible for downstream health-profile use merely because it was retained.

**Result:** Blocked
**Notes / evidence link:** Blocked — the local **Documents** route now renders and redirects to `/?signin=required`, but this workspace has no authenticated product session or prepared synthetic test documents. Execute in a deployed authenticated environment.

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

## Out of scope or not manually testable yet

- Automatic verification, batch correction, rejection, and reprocessing are out of scope for EH-122.
- The Wiki is a generated mirror and is not test evidence; repository documentation and the delivered product are authoritative.
- Authenticated manual review cannot be executed in the current Windows workspace: the local route renders but redirects to sign-in, and no test account or synthetic documents are provisioned. Mark affected interface checks **Blocked** with this limitation; execute this checklist in a deployed/authenticated environment before delivery is claimed.
