# EH-130: Duplicate document detection and safe archive

**Roadmap status:** Delivered
**Build / environment:** Local Supabase + Next.js smoke server; GitHub Actions Measurement Registry run #185
**Test run date:** 2026-08-22
**Tester:** Codex automated verification and browser smoke

## What this checklist covers

This checklist covers the Documents viewer flow for exact and near-duplicate uploads. The system must show a candidate before any archive choice, let the owner retain both documents, and archive only the explicitly selected document without deleting its file or audit evidence.

## Before you start

- [x] Use a dedicated test account and one active profile.
- [x] Use only synthetic or de-identified PDF/image files; do not upload patient records.
- [x] Prepare two identical synthetic files and two different synthetic files with matching metadata and distinct event dates.
- [x] Confirm each upload has finished processing before evaluating metadata-based candidates, unless the check intentionally tests a processing state.
- [x] Record the document IDs or screenshots for every test upload so the result can be traced without opening raw Storage paths.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH130-EXACT-A` / `EH130-EXACT-B` | The same synthetic PDF uploaded twice to the same profile | Exact file-hash candidate |
| `EH130-NEAR-A` / `EH130-NEAR-B` | Different synthetic files with matching filename/size/type metadata and distinct event dates | Metadata-similarity candidate and keep-both choice |
| `EH130-OTHER-PROFILE` | A copy of `EH130-EXACT-A` uploaded under a separate test profile | Cross-profile isolation |
| `EH130-WEAK` | Two files sharing only a generic filename | Candidate threshold negative path |

## Interface checks

### EH130-UI-01: Exact duplicate is surfaced without deletion

**Precondition:** `EH130-EXACT-A` has finished processing and remains visible in **Documents**.

1. Open **Upload document** for the same profile.
2. Upload `EH130-EXACT-B` with the same bytes as `EH130-EXACT-A`.
3. Wait for processing to finish and open the new document from **Documents**.
4. Review the duplicate warning and both document summaries.

**Expected result:** The viewer shows **Exact duplicate file** and the other filename/date. Both documents remain visible. No file disappears and no archive is applied before the tester makes a choice.

**Result:** `Pass`
**Notes / evidence link:** Browser smoke on synthetic EH-130 exact pair showed the exact-duplicate warning and 100% match evidence; both source rows remained active before a choice. See PR #162 verification comment.

### EH130-UI-02: Distinct events can be retained together

**Precondition:** `EH130-NEAR-A` and `EH130-NEAR-B` are processed under one profile and a pending **Possible duplicate** candidate is visible.

1. Open either near-duplicate document in **Documents**.
2. Confirm the warning lists the matching metadata evidence and both source summaries.
3. Click **Keep both**.
4. Refresh **Documents**, then open the **Health Timeline**.

**Expected result:** The viewer confirms both documents were retained. Neither document is archived or removed from **Documents** or the active timeline.

**Result:** `Pass`
**Notes / evidence link:** Browser smoke selected **Keep both** on a synthetic possible duplicate; the viewer confirmed both documents were retained and the active document list remained unchanged. See PR #162 verification comment.

### EH130-UI-03: Archive is explicit and non-destructive

**Precondition:** Create or leave one pending duplicate candidate with synthetic data. Do not use a candidate already resolved in EH130-UI-02.

1. Open the candidate in the document viewer.
2. Click **Archive possible match** (or **Archive this document** if that is the intended target).
3. Read the inline confirmation stating that the file and audit history are retained.
4. Click **Confirm archive**.
5. Return to **Documents** and refresh the list.

**Expected result:** The UI says the document was archived, not deleted. The archived target is absent from the active **Documents** list and the other document remains visible. The original file is not reported as lost; a developer supplies Storage-retention evidence below.

**Result:** `Pass`
**Notes / evidence link:** Browser smoke completed the explicit archive confirmation on a disposable synthetic candidate; the selected document was marked archived, the other remained active, and database evidence retained the source Storage path and audit event. See PR #162 verification comment.

### EH130-UI-04: Failed or repeated choice is safe

**Precondition:** Use a pending synthetic candidate and two browser tabs for the same profile, or use a controlled API failure supplied by the developer.

1. Submit the same **Keep both** or archive choice twice from separate tabs, or retry after the first response.
2. Observe the second response and refresh the candidate viewer.
3. If the request fails, verify that the candidate remains available for retry.

**Expected result:** A repeated identical choice confirms the existing result without changing the other document. A conflicting choice never replaces the first decision. A failed request leaves the candidate pending and does not archive or delete either document.

**Result:** `N/A`
**Notes / evidence link:** A two-tab browser retry was not executed. The EH-130 database contract covers idempotent retry and conflicting-decision rejection; no UI result is inferred.

### EH130-UI-05: Cross-profile candidates stay private

**Precondition:** `EH130-OTHER-PROFILE` is uploaded under a second dedicated profile using the same bytes as `EH130-EXACT-A`.

1. Open **Documents** under the first profile and inspect the duplicate review surface.
2. Switch to the second profile and inspect its **Documents** and document viewer.
3. Do not use another profile's document URL as a substitute for a UI flow.

**Expected result:** No candidate links documents owned by different profiles. Each profile sees only its own documents and any same-profile candidate decisions.

**Result:** `N/A`
**Notes / evidence link:** A separate-profile browser fixture was not executed. Same-profile ownership and cross-profile isolation are covered by the database contract; no UI result is inferred.

## Developer evidence required

- [x] `pnpm test:eh130` passed. **Provider:** developer/CI.
- [x] `pnpm test:eh130-db` passed all 32 tests against local Supabase; CI run #185 also passed the EH-130 database contract. **Provider:** developer/CI.
- [x] `pnpm typecheck` passed; CI run #185 production build passed. **Provider:** developer/CI.
- [ ] A two-session/concurrent-resolution run was not captured. The database suite covers idempotent retry and conflicting decisions, but no race result is claimed. **Provider:** developer/CI or reviewer.
- [x] Archive verification retained the source document row, Storage path, and append-only audit event; the duplicate workflow performed no Storage removal. **Provider:** developer/CI.
- [ ] A reprocess of a pre-EH-130 synthetic document was not executed in this run; hash wiring and candidate creation contracts are covered by the verifier and database suite. **Provider:** developer/CI.

## Out of scope or not manually testable yet

- Perceptual/OCR similarity, automatic medical-event merging, bulk duplicate management, and user-facing unarchive are out of scope for EH-130.
- Audit-row immutability, exact hash values, composite ownership constraints, trigger transactionality, and Storage retention are not proven through product controls; use the database and code evidence above.
- If the local Supabase stack, worker, or test fixture is unavailable, mark the affected check `Blocked` and record the command/error and required evidence. Do not mark it passed from a source review alone.
