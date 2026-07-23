## 1. Retained-data, storage, and consumer inventory

- [ ] 1.1 Inventory every document-derived database table/FK/cascade, service-role reader, signed-URL path, mutation/finalizer, and persisted report/synthesis consumer.
- [ ] 1.2 Inventory generation-0 storage from document path columns, page preview/OCR columns, recursive legacy `${profileId}/${documentId}` prefixes, nested objects, and bucket pagination behavior.
- [ ] 1.3 Preflight retained `reports` into exact-source and source-unknown groups; verify content/summary PHI and define whole-report invalidation/purge.
- [ ] 1.4 Preflight `profile_health_synthesis`, `ai_invocations`, measurement-resolution/audit tables, and every retained metadata column; fail closed if a proposed non-PHI receipt/metadata row contains payload.
- [ ] 1.5 Inventory every deployed worker version and keep deletion disabled until all unfenced storage/finalization workers can be paused and drained.

## 2. Shared lease and storage-intent extension

- [ ] 2.1 Extend PR 2 `document_processing_attempts` with random lease token, expiry, heartbeat, cancellation request, and guarded release; do not add another attempt/generation authority.
- [ ] 2.2 Add service-only atomic lease/heartbeat/release/cancellation transitions that validate job/document/profile/attempt/generation ownership.
- [ ] 2.3 Add storage-write intents with attempt, lease token, generation, server-generated path, operation kind, start/deadline/completion/recovery state, and no client path authority.
- [ ] 2.4 Update every document storage write to register before upload, enforce bounded request time, post-check document/lease/generation, record completion, and leave failed cleanup recoverable.
- [ ] 2.5 Add generation-scoped path builders for future artifacts and preserve explicit generation-0 inventory for legacy objects.

## 3. Database lifecycle and authoritative operation queue

- [ ] 3.1 Add document lifecycle state compatible with existing processing status and monotonic deletion transitions.
- [ ] 3.2 Add retained non-PHI `document_deletion_operations` as the sole transactional outbox/queue/status/receipt with claim lease, retry/error/evidence, retention, and no cascading document FK.
- [ ] 3.3 Implement the owner-scoped idempotent tombstone RPC that locks the document, increments shared write generation, requests cancellation, invalidates reports/synthesis, inserts one operation, and returns its id/status.
- [ ] 3.4 Add indexes, constraints, fixed search paths, ownership checks, RLS/grants, and revoke PUBLIC/anon/authenticated cleanup/finalizer execution and direct lifecycle mutation.
- [ ] 3.5 Implement service-only skip-locked operation claim, guarded transition, retry/backoff, lease takeover, and safe status serialization.

## 4. Cross-domain tombstone visibility and derivative retention

- [ ] 4.1 Deny/exclude deleting documents in document list/detail/file/page/thumbnail/reprocess/mutation and signed-URL minting paths.
- [ ] 4.2 Exclude deleting-document observations and sources in Biomarkers and Health Profile service-role queries before normalization/projection.
- [ ] 4.3 Add report actual-source-set and source-known/invalidation fields; backfill explicit document ids and mark `document_ids = NULL` reports source-unknown without invented sources.
- [ ] 4.4 Revalidate report sources at eligibility/load/commit; tombstone exact-source reports containing the document and conservatively invalidate every source-unknown report for that profile.
- [ ] 4.5 Make report list/detail/structured-context hide invalidated reports and make final purge delete each whole invalidated report, including multi-source content/summary.
- [ ] 4.6 Invalidate/remove `profile_health_synthesis` in the tombstone transaction and make regeneration/loaders use active sources only.
- [ ] 4.7 Define `ai_invocations` linkage clearing versus purge from populated preflight and explicitly purge every other document-derived extraction, revision, shadow, and audit row.

## 5. Storage cleanup and final database purge

- [ ] 5.1 Implement writer quiescence using cancellation state, attempt leases, unresolved storage intents, bounded request deadlines, and the documented stability interval.
- [ ] 5.2 Implement complete paginated recursive storage inventory/removal for every registered generation and all generation-0 paths/prefixes; treat not-found as idempotent success.
- [ ] 5.3 Require at least two complete empty listings separated by the stability interval and restart purge/verification when a late object appears.
- [ ] 5.4 Implement the final transaction with deterministic document-first lock order, evidence/generation/writer revalidation, direct observation/lineage and derivative deletion, document deletion, and independent receipt completion.
- [ ] 5.5 Remove the legacy lineage-nulling purge function and `easyhealth.purge_lineage` authority only when the direct-delete finalizer and all callers are deployed.
- [ ] 5.6 Add cleanup receipt retention/expiry and monitoring without retaining filename, raw path, extracted text, clinical value, generated narrative, or document content.

## 6. API and worker cutover

- [ ] 6.1 Change `DELETE /api/documents/:id` to call tombstone/enqueue and return `202 Accepted` with safe operation status; repeated DELETE returns the same operation.
- [ ] 6.2 Add owner-scoped deletion-operation status and ensure cross-profile requests return 403/404 without identity or PHI leakage.
- [ ] 6.3 Deploy lease-aware processing workers and cleanup workers with shared document-first lock order; pause/drain all legacy workers before enabling DELETE.
- [ ] 6.4 Ensure cached application reads are evicted after tombstone and document the existing 900-second residual signed-URL behavior without claiming synchronous revocation.

## 7. Verification

- [ ] 7.1 Add pgTAP for tombstone idempotency, generation increment, operation uniqueness/survival, report/synthesis invalidation, grants, owner isolation, and direct final purge rollback.
- [ ] 7.2 Add populated migration tests for explicit and NULL report scopes, observability payload fail-closed behavior, generation-0 paths, nested legacy objects, and all delete cascades.
- [ ] 7.3 Add real two-session tests for delete versus finalization, delete versus report generation, cleanup versus storage-intent completion, competing cleanup claims, lease expiry/takeover, and repeated DELETE.
- [ ] 7.4 Add storage adapter integration tests for pagination, nested prefixes, partial failures, not-found retry, late object after first empty listing, and repeated stable-empty verification.
- [ ] 7.5 Add API integration for list/detail/file/page/thumbnail/reprocess/mutation denial, no new signed URL, Biomarkers/Health Profile exclusion, report invalidation, synthesis invalidation, operation status, and owner isolation.
- [ ] 7.6 Inject failure after every tombstone, cleanup transition, storage page/remove, verification, and final-purge mutation; prove no false completion or damaged active document.

## 8. Rollout and QA

- [ ] 8.1 Confirm atomic instrumental publication is deployed, then pause/drain legacy workers, run retained database/storage/report/observability preflight, and abort on unclassified PHI or paths.
- [ ] 8.2 Deploy additive schema/read filters and lease-aware workers before enabling the tombstone route and cleanup claims.
- [ ] 8.3 Run target smoke for active-worker cancellation, late upload, paginated/nested storage, retryable storage error, report/synthesis hiding, cross-profile denial, signed-URL residual behavior, and final receipt.
- [ ] 8.4 Update `QA/eh-104/checklist.md` with safe owner deletion/status checks and separate developer evidence; do not mark TTL expiry, storage absence, or cleanup smoke passed unless observed.
- [ ] 8.5 Record monitoring, retry ownership, receipt retention, removal of the temporary provenance purge exception, and production cleanup evidence before Sprint 1 closure.
