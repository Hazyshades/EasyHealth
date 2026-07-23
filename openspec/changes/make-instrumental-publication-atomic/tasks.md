## 1. Processing-attempt and generation foundation

- [ ] 1.1 Add `documents.write_generation` with retained legacy value `0` and monotonic constraints compatible with later deletion fencing.
- [ ] 1.2 Add retained `document_processing_attempts` with job/document/profile ownership, attempt number, captured generation, lifecycle/timestamps, and one-active-attempt constraints.
- [ ] 1.3 Replace client select-then-update claim with one fixed-search-path atomic claim RPC that creates and returns `processing_attempt_id`.
- [ ] 1.4 Update guarded retry, failure, reclaim, and completion transitions so every new claim has a new attempt and stale attempts cannot mutate job/document state.
- [ ] 1.5 Document the extension boundary: durable deletion adds lease token/expiry/heartbeat/cancellation/intents to these attempts and reuses the same write generation.

## 2. Canonical content and publication state

- [ ] 2.1 Define the immutable v2 canonical payload field list, null/numeric/string rules, array ordering, and SHA-256 version prefix in shared types and golden fixtures.
- [ ] 2.2 Add database canonicalization/digest computation and reject caller hash or exact-payload mismatches.
- [ ] 2.3 Add snapshot-content, publication-history, and authoritative current-pointer schema with terminal-state and one-current constraints.
- [ ] 2.4 Link measures, findings, and impression to immutable content and bind summary/publication/completion digests to processing-attempt-owned publication events.
- [ ] 2.5 Add indexes and ownership constraints for document/version/hash reuse, attempt ownership, state cleanup, and current-reader lookup.

## 3. Populated migration and compatibility reader bridge

- [ ] 3.1 Implement retained-database preflight for ownership, hash groups, current cardinality, observation linkage, job/attempt state, attachable findings/summary, and generation-0 backfill.
- [ ] 3.2 Backfill provable measure groups as `legacy-v1` content/publications and attach only provable current findings/summary without fabricating history or attempt identity.
- [ ] 3.3 Pause/drain old instrumental workers, migrate the physical findings storage to immutable content, and preserve `document_extracted_findings` as a current-only read-compatible relation.
- [ ] 3.4 Add a transition projection that keeps legacy measure `is_current` fields equivalent to the authoritative pointer while old readers exist.
- [ ] 3.5 Add an explicitly guarded disposable reset/reprocess path and abort retained migration on ambiguous rows.
- [ ] 3.6 Add populated fixtures for clean, ambiguous, mixed-current, missing-link, source-unknown findings, active-attempt, and `A → B → A` histories.

## 4. Prepare and atomic finalize RPCs

- [ ] 4.1 Implement service-only prepare with attempt/generation ownership validation, DB hash verification, exact-payload reuse, and full same-hash state matrix.
- [ ] 4.2 Implement atomic finalize with document-first deterministic lock order, attempt/generation and prepared-summary binding, publication/current-pointer transitions, compatibility projections, document/job/attempt completion, and synthesis invalidation.
- [ ] 4.3 Implement exact idempotent finalizer replay and reject divergent publication/completion digest, stale attempt, cross-owner, terminal-job, and generation mismatch calls.
- [ ] 4.4 Implement conservative orphan-preparation abandonment with terminal-attempt and lock checks; leave lease-expiry extension to durable deletion.
- [ ] 4.5 Fix function search paths and revoke direct state mutation/execute from PUBLIC, anon, and authenticated; grant only required service operations.

## 5. Worker and reader cutover

- [ ] 5.1 Change instrumental extraction to use its processing attempt and prepare measures/findings/impression as one immutable content version before summary generation.
- [ ] 5.2 Bind generated summary and completion payload to the exact prepared id/version/hash/attempt and invoke only the atomic finalizer for success.
- [ ] 5.3 Ensure summary, prepare, and finalize failures follow guarded retry/failure policy without publishing prepared content or superseding prior current content.
- [ ] 5.4 Prove old document-detail, report-eligibility, and structured-context findings readers remain current-only through the compatibility relation.
- [ ] 5.5 Cut document detail, document observations, reports, and structured context to the current-publication pointer with transition equivalence checks.
- [ ] 5.6 Remove the legacy publish-on-materialize RPC and row-level reader authority only after worker/reader inventory proves cutover; defer compatibility-relation removal to a later cleanup.

## 6. Database and worker verification

- [ ] 6.1 Add pgTAP for atomic claim, unique attempts, generation capture, stale-attempt rejection, and guarded retry/reclaim.
- [ ] 6.2 Add pgTAP for PREPARED, CURRENT, SUPERSEDED, and ABANDONED same-hash behavior, including unchanged replay and `A → B → A`.
- [ ] 6.3 Add DB/worker golden tests for v1/v2 canonicalization, field changes, reordered arrays, hash conflict, and exact-payload comparison.
- [ ] 6.4 Add real two-session tests for competing claim/prepare/finalize, cleanup versus finalize, stale attempt, and current-pointer serialization.
- [ ] 6.5 Add role/grant negative tests for direct attempt/publication/content mutation and claim/prepare/finalize/cleanup execution.
- [ ] 6.6 Inject failure after every finalize step and prove full rollback plus idempotent retry.
- [ ] 6.7 Add reader/API regressions proving the compatibility relation and new pointer never leak prepared, superseded, or abandoned children and switch coherent content at commit.

## 7. Rollout and QA

- [ ] 7.1 Pause/drain instrumental jobs, run populated preflight, choose retained abort or explicitly disposable reset, and apply attempt/content/compatibility migration and backfill.
- [ ] 7.2 Deploy attempt-aware worker/readers, verify legacy/current-pointer equivalence, resume jobs, and record unchanged retry, changed reprocess, `A → B → A`, stale-attempt, and forced-failure smoke.
- [ ] 7.3 Update `QA/eh-105/checklist.md` with tester-facing coherent-version checks and separate developer evidence; do not mark unavailable smoke passed.
- [ ] 7.4 Record the EH-105 2.5/4.3 corrective evidence and keep production/Sprint 1 closure pending until all mandatory gates pass.
