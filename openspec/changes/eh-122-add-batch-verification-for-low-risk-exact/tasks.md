## 1. Eligibility policy and regression fixtures

- [x] 1.1 Inventory the bootstrap normalization review payload, current source fields, canonical preview candidate evidence, and active-revision protections required to prove an active reviewed exact alias without fold fallback; do not require a persisted trace before first verification.
- [x] 1.2 Implement a pure batch-verification eligibility policy with typed stable exclusion codes and user-facing reason labels.
- [x] 1.3 Cover the policy with exact/complete compatible eligible, normalized/OCR/fuzzy/fold/provisional excluded, incomplete excluded, manual-decision excluded, missing-trace excluded, and stale-source/revision fixtures.
- [x] 1.4 Project one document-level eligibility summary for selection, confirmation, and execution without duplicating client eligibility logic.

## 2. Durable database and writer transitions

- [x] 2.1 Design and add the ordered Supabase migration for batch operation and batch-row metadata, ownership-aware access controls, idempotency constraints, and minimal no-PHI storage.
- [x] 2.2 Extend the canonical normalization writer delegate and wrappers only as required for an append-only `verification_reversal` transition; preserve EH-115 wrappers, CAS, source ownership, and existing write kinds.
- [x] 2.3 Add database coverage for idempotency binding, grants/RLS, no-source-content metadata, eligible verification actor/time, pending successor reversal, append-only records, and EH-121 audit capture.
- [x] 2.4 Verify first-promotion reversal semantics using a real writer transaction; block UI undo until the migration proves no revision, observation, or audit event is deleted or updated.

## 3. Document batch-verification service and API

- [x] 3.1 Implement a focused service that loads current rows/revisions, re-evaluates eligibility, binds operation idempotency, and invokes the existing normalization writer independently per eligible row.
- [x] 3.2 Add the authenticated document-owner-scoped batch-verification endpoint with request validation, stable aggregate/row outcomes, deterministic request hashes, and no-store responses.
- [x] 3.3 Add the authenticated document-owner-scoped batch-reversal endpoint that reverses only unchanged resulting revisions and reports changed-since-batch rows independently.
- [x] 3.4 Add service/API regression coverage for ownership, duplicate ids, idempotent replay/conflicting reuse, stale confirmation, partial completion, no-op, and partial reversal.

## 4. Review workspace experience

- [x] 4.1 Refactor review selection so generic raw acceptance remains intact while batch verification defaults only to eligible exact rows.
- [x] 4.2 Render per-row batch eligibility/exclusion state without hiding incomplete/raw-acceptance affordances or exposing a candidate identity for incomplete outcomes.
- [x] 4.3 Build accessible confirmation UI with selected, deselected eligible, and exclusion-reason counts plus explicit verification/reversal consequences.
- [x] 4.4 Execute batch verification from the confirmation contract, render completed/partial/no-op outcomes, reload authoritative review/history data, and expose actionable per-row errors.
- [x] 4.5 Add operation-level audit-safe undo UI; disable or explain it when all rows changed since batch, and refresh the EH-121 history panel after reversal.
- [x] 4.6 Add focused workspace regression coverage for default selection, exclusion summaries, confirmation state, partial outcomes, raw-acceptance preservation, and undo availability.

## 5. Verification, QA, and delivery evidence

- [x] 5.1 Run the focused pure-policy, document-review, writer-seam, EH-119, EH-121, and EH-122 database/API suites; add the new EH-122 commands to the relevant package/CI registry if project conventions require it.
- [x] 5.2 Run typecheck and production build; inspect changed diagnostics and resolve introduced failures.
- [x] 5.3 Create and execute `QA/eh-122/checklist.md` in an authenticated environment using only synthetic/de-identified documents; record actual outcomes and explicitly mark unavailable UI checks as blocked.
- [x] 5.4 Validate this OpenSpec change strictly and record final issue/PR/CI evidence only after implementation is complete.