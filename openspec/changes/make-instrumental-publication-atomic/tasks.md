## 1. Canonical content and state model

- [ ] 1.1 Define the immutable v2 canonical payload field list, null/numeric/string rules, array ordering, and SHA-256 version prefix in shared types and golden fixtures.
- [ ] 1.2 Add database canonicalization/digest computation and reject caller hash or exact-payload mismatches.
- [ ] 1.3 Add snapshot-content, publication-attempt/history, and authoritative current-pointer schema with terminal-state and one-current constraints.
- [ ] 1.4 Link measures, findings, and impression to immutable content and bind summary/completion digest to publication attempts.
- [ ] 1.5 Add indexes and ownership constraints for document/version/hash reuse, processing attempts, state cleanup, and current-reader lookup.

## 2. Populated migration and reader bridge

- [ ] 2.1 Implement retained-database preflight for ownership, hash groups, current cardinality, observation linkage, job state, and attachable findings/summary.
- [ ] 2.2 Backfill provable measure groups as `legacy-v1` content/publications without fabricating unavailable historical findings.
- [ ] 2.3 Add an explicitly guarded disposable reset/reprocess path and abort retained migration on ambiguous rows.
- [ ] 2.4 Add a transition projection that keeps legacy `is_current` fields equivalent to the authoritative pointer while old readers exist.
- [ ] 2.5 Add populated migration fixtures for clean, ambiguous, mixed-current, missing-link, and `A → B → A` histories.

## 3. Prepare and atomic finalize RPCs

- [ ] 3.1 Implement service-only prepare with internal ownership/job validation, DB hash verification, exact-payload reuse, and full same-hash state matrix.
- [ ] 3.2 Implement atomic finalize with document-first deterministic lock order, prepared-summary binding, publication/current-pointer transitions, document/job completion, and synthesis invalidation.
- [ ] 3.3 Implement exact idempotent finalizer replay and reject divergent completion payload, stale attempt, cross-owner, terminal-job, and deletion-generation calls.
- [ ] 3.4 Implement conservative orphan-preparation abandonment/cleanup with terminal-attempt and lock checks.
- [ ] 3.5 Fix function search paths and revoke direct state mutation/execute from PUBLIC, anon, and authenticated; grant only required service operations.

## 4. Worker and reader cutover

- [ ] 4.1 Change instrumental extraction to prepare measures/findings/impression as one immutable content version before summary generation.
- [ ] 4.2 Bind generated summary to the exact prepared id/version/hash and invoke only the atomic finalizer for success.
- [ ] 4.3 Ensure summary, prepare, and finalize failures follow retry/failure policy without publishing prepared content or superseding prior current content.
- [ ] 4.4 Cut document detail, document observations, reports, and structured context to the current-publication pointer with transition equivalence checks.
- [ ] 4.5 Remove the legacy publish-on-materialize RPC and row-level reader authority only after worker/reader inventory proves cutover.

## 5. Database and worker verification

- [ ] 5.1 Add pgTAP for PREPARED, CURRENT, SUPERSEDED, and ABANDONED same-hash behavior, including unchanged replay and `A → B → A`.
- [ ] 5.2 Add DB/worker golden tests for v1/v2 canonicalization, field changes, reordered arrays, hash conflict, and exact-payload comparison.
- [ ] 5.3 Add real two-session tests for competing prepare/finalize, cleanup versus finalize, stale attempt, and current-pointer serialization.
- [ ] 5.4 Add role/grant negative tests for direct table mutation and prepare/finalize/cleanup execution.
- [ ] 5.5 Inject failure after every finalize step and prove full rollback plus idempotent retry.
- [ ] 5.6 Add reader/API regressions proving prepared, superseded, and abandoned children never leak and coherent content switches at commit.

## 6. Rollout and QA

- [ ] 6.1 Pause/drain instrumental jobs, run populated preflight, choose retained abort or explicitly disposable reset, and apply additive migration/backfill.
- [ ] 6.2 Deploy compatible worker/readers, verify transition equivalence, resume jobs, and record unchanged retry, changed reprocess, `A → B → A`, stale, and forced-failure smoke.
- [ ] 6.3 Update `QA/eh-105/checklist.md` with tester-facing coherent-version checks and separate developer evidence; do not mark unavailable smoke passed.
- [ ] 6.4 Record the EH-105 2.5/4.3 corrective evidence and keep production/Sprint 1 closure pending until all mandatory gates pass.
