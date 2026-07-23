## 1. Database lifecycle and queue

- [ ] 1.1 Add document deletion lifecycle and monotonic write-generation fields with guards against revival from `deleting`.
- [ ] 1.2 Add retained non-PHI `document_deletion_operations` as the sole transactional outbox/queue with claim lease, retry, error, evidence, and retention fields.
- [ ] 1.3 Add generation-bound job lease/heartbeat/cancellation fields and storage-write intent schema with server-generated registered paths.
- [ ] 1.4 Add indexes, fixed-search-path functions, RLS/grants, and constraints for one operation, lease ownership, operation retention after hard purge, and no client mutation.

## 2. Tombstone and API boundaries

- [ ] 2.1 Implement the owner-scoped idempotent tombstone RPC that locks the document, increments generation, requests job cancellation, and inserts/returns one operation.
- [ ] 2.2 Change `DELETE /api/documents/:id` to return `202 Accepted` with operation id/status and never final success before cleanup.
- [ ] 2.3 Add owner-scoped deletion-operation status API that remains available after document purge without exposing PHI.
- [ ] 2.4 Deny/exclude deleting documents across list/detail/file/page/thumbnail/signed-URL/reprocess/mutation/publication paths and evict client signed-URL cache when deletion is observed.
- [ ] 2.5 Document the bounded residual behavior of already issued 900-second signed URLs and avoid any immediate-revocation claim.

## 3. Processing worker fencing

- [ ] 3.1 Change job claim/reclaim to issue and heartbeat random lease tokens bound to document generation.
- [ ] 3.2 Validate lease token, generation, active document, and cancellation state on every database mutation and atomic publication finalizer.
- [ ] 3.3 Register every storage write before upload with bounded deadline and generation-scoped path; add post-upload fence check and recoverable cleanup behavior.
- [ ] 3.4 Make workers stop, reconcile intents, and release leases when cancellation or generation mismatch is observed.
- [ ] 3.5 Add rollout inventory/gate that pauses claims and drains or terminates every legacy unfenced worker before tombstone deletion is enabled.

## 4. Idempotent storage cleanup

- [ ] 4.1 Implement transactional operation claims and explicit queued/waiting/cleaning/verifying/retryable/completed transitions.
- [ ] 4.2 Wait for old-generation lease release/expiry, intent completion/takeover, and the bounded request quiescence interval before purge.
- [ ] 4.3 Purge registered paths and every paginated nested object under every document generation; treat not-found as success and record real errors.
- [ ] 4.4 Require repeated complete stable-empty listings separated by the consistency interval; restart purge if a late object appears.
- [ ] 4.5 Persist non-PHI storage manifest/evidence digests and retry schedule without retaining filenames, raw paths, or clinical data.

## 5. Transactional final purge

- [ ] 5.1 Implement document-first deterministic final-purge locking shared with atomic publication and revalidate generation, operation, writer quiescence, and storage proof.
- [ ] 5.2 Hard-purge prepared/current/superseded document publications, observations, extraction/derived rows, jobs/intents, and document in one transaction according to retention policy.
- [ ] 5.3 Mark the independent deletion receipt completed in the same final transaction and preserve owner status access after document removal.
- [ ] 5.4 Remove the legacy lineage-nulling purge path and temporary provenance authorization after every delete caller uses final hard purge.

## 6. Concurrency, failure, and role verification

- [ ] 6.1 Add real two-session tests for delete versus finalize/reprocess, competing DELETE, competing cleanup claims, lease expiry/takeover, and cleanup versus intent completion.
- [ ] 6.2 Inject failure at every tombstone, claim, listing, removal, verification, and final database purge step; prove retry convergence and no false completion.
- [ ] 6.3 Add multi-page/nested storage fixtures, late-object-after-empty behavior, old-generation artifacts, not-found idempotency, and stable-empty timing tests.
- [ ] 6.4 Add negative grants/ownership tests for tombstone, operation polling, queue claims, lease/intents, final purge, and retained receipts.
- [ ] 6.5 Add API regressions for 202/status behavior, access denial after tombstone, repeated DELETE, cached URL handling, and non-PHI responses.

## 7. Rollout and QA

- [ ] 7.1 Confirm atomic instrumental publication is deployed, then pause/drain legacy workers and deploy lease-aware processing/cleanup workers before enabling the DELETE route.
- [ ] 7.2 Run target smoke for active-writer deletion, paginated storage, retryable storage error, late upload, final purge, and retained operation status.
- [ ] 7.3 Update `QA/eh-104/checklist.md` with safe owner deletion/status checks and separate developer evidence; do not mark signed-URL expiry or cleanup smoke passed unless observed.
- [ ] 7.4 Record production cleanup monitoring, retry ownership, alert thresholds, and the completed removal of the temporary provenance purge exception.
