## 1. Contract and transition policy

- [x] 1.1 Define shared `resolution_status`, `verification_status`, and `record_status` types plus lifecycle/reason-code unions without treating rejection or supersession as verification.
- [x] 1.2 Implement a pure, table-driven transition policy covering raw retention, user verification, automatic verification, manual correction, reversal, rejection, supersession, and protected human decisions.
- [x] 1.3 Define stable authorization, stale-snapshot, protected-decision, incomplete-outcome, and invalid-transition error codes for API/service/UI use.
- [x] 1.4 Add deterministic fixtures for active, rejected, superseded, resolved, partial, ambiguous, unmapped, auto-verified, user-verified, corrected, reversed, and stale snapshots.

## 2. Database lifecycle and audit foundation

- [x] 2.1 Add an additive migration for source `record_status`, lifecycle reason codes, and an unambiguous backfill/preflight from `status`, `is_current`, and `superseded_at`.
- [x] 2.2 Enforce lifecycle/source-lineage invariants so direct runtime updates to `record_status`, `is_current`, or `superseded_at` cannot bypass the trusted transition seam.
- [x] 2.3 Add service-only reject and supersede transition procedures with row locks, owner/source checks, expected snapshots, request-hash idempotency, and terminal-state guards.
- [x] 2.4 Add the service-only automatic verification writer wrapper and database actor/status guards for `auto_verified` system decisions.
- [x] 2.5 Extend the EH-121 event enum, ledger metadata, trigger capture, and read model with lifecycle states, automatic verification, and non-PII reason codes.
- [x] 2.6 Add pgTAP coverage for backfill/preflight, grants, transition guards, automatic actor metadata, append-only revisions, source lineage, event idempotency, and direct-write denial.

## 3. Trusted server and worker integration

- [x] 3.1 Extend normalization writer/result types and RPC seams to represent `auto_verified` while preserving existing user acceptance, correction, value-correction, and reversal behavior.
- [x] 3.2 Wire `decideAutomaticPromotion` to the approved resolver/catalog quality gate and current-source recomputation; keep the path disabled when approval is absent.
- [x] 3.3 Implement owner-scoped rejection service and route with confirmation payload, reason validation, source/revision CAS, and stable failure mapping.
- [x] 3.4 Change document reprocessing to supersede laboratory sources through the lifecycle seam and retain old raw evidence/revision history.
- [x] 3.5 Preserve EH-116 protection for active user decisions and make changed candidates skipped, pending, or retryable without overwriting human revisions.
- [x] 3.6 Verify EH-122 batch verification and reversal consume the same lifecycle/source contract without creating a second batch API or bypassing audit/CAS rules.
- [x] 3.7 Update laboratory observation read boundaries and Health Profile/report projections to exclude rejected or superseded source records while preserving raw-history visibility.

## 4. Document review API and UI

- [x] 4.1 Add lifecycle-aware fields, persisted/preview trace state, action availability, and stable exclusion reasons to document bootstrap and biomarker responses.
- [x] 4.2 Add owner-only rejection confirmation with safe English reason labels, stale/authorization errors, and explicit post-transition feedback.
- [x] 4.3 Render independent resolver, verification, and record-lifecycle labels, including a read-only automatic-verification state.
- [x] 4.4 Render superseded rows as historical/read-only evidence with replacement/reprocessing context and no current selection actions.
- [x] 4.5 Keep incomplete raw acceptance, manual correction, individual reversal, and EH-122 batch selection semantics unchanged and regression-tested.
- [x] 4.6 Add API/service tests for forged status/actor payloads, foreign ownership, stale transitions, rejection, supersession, automatic promotion, and protected decisions.

## 5. Verification, documentation, and delivery evidence

- [x] 5.1 Add the focused EH-120 unit/runtime verifier and package scripts for transition policy, automatic verification, lifecycle projection, and audit read-model behavior.
- [x] 5.2 Add the focused EH-120 database verifier and register it in the CI suite-coverage policy after the migration tests pass.
- [x] 5.3 Run EH-104, EH-111, EH-116, EH-119, EH-121, and EH-122 regression suites plus typecheck/build; resolve any introduced contract drift.
- [x] 5.4 Create `QA/eh-120/checklist.md` with safe synthetic/de-identified data, product-interface steps, expected results, and separate blocked authenticated/concurrency evidence.
- [x] 5.5 Update canonical resolver, document-review, and Health Profile projection documentation; run biomarker documentation generation/check/test and review the generated Wiki mirror.
- [x] 5.6 Update the single EH-120 delivery/tracking issue with implementation links, test commands, QA status, Wiki publication status, and remaining blockers before claiming completion.
- [x] 5.7 Record the EH-123 handoff contract: lifecycle transition identity, prior/next versions, retry/failure semantics, and the event fields required for deterministic recalculation.
