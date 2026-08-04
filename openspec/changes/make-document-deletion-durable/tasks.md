## 1. Retained-data, storage, and consumer inventory

- [ ] 1.1 Inventory every document-derived database table/FK/cascade, service-role reader, signed-URL path, mutation/finalizer, and persisted report/synthesis consumer.
  - [ ] 1.1.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.1.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.1.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.2 Inventory generation-0 storage from document path columns, page preview/OCR columns, recursive legacy `${profileId}/${documentId}` prefixes, nested objects, and bucket pagination behavior.
  - [ ] 1.2.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.2.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.2.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.3 Preflight retained `reports` into exact-source and source-unknown groups; verify content/summary PHI and define whole-report invalidation/purge.
  - [ ] 1.3.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.3.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.3.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.4 Preflight `profile_health_synthesis`, `ai_invocations`, measurement-resolution/audit tables, and every retained metadata column; fail closed if a proposed non-PHI receipt/metadata row contains payload.
  - [ ] 1.4.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.4.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.4.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.5 Inventory every deployed worker version and keep deletion disabled until all unfenced storage/finalization workers can be paused and drained.
  - [ ] 1.5.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.5.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.5.c Publish attributable findings and block unresolved or unsafe results.

## 2. Shared lease, storage intents, and app upload broker

- [ ] 2.1 Extend PR 2 `document_processing_attempts` with random lease token, expiry, heartbeat, cancellation request, and guarded release; do not add another attempt/generation authority.
  - [ ] 2.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.1.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.2 Add service-only atomic lease/heartbeat/release/cancellation transitions that validate job/document/profile/attempt/generation ownership.
  - [ ] 2.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.2.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.3 Add storage-write intents with attempt or owner-upload principal, generation, server-generated bucket/path/content-type, operation kind, start/deadline/completion/recovery state, and no client path authority.
  - [ ] 2.3.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.3.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.3.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.4 Add DB RPCs `register_storage_write_intent` and `complete_storage_write_intent` that return intent/path metadata only (never a Storage signed URL) and reject stale/expired/cancelled/tombstoned/prior-generation callers.
  - [ ] 2.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.4.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.5 Implement the app upload broker ticket + late-exchange endpoints: authenticate owner session or worker lease, revalidate intent fence, issue one-time app ticket TTL ≤ min(intent deadline, 120s), consume ticket once, then mint Storage `createSignedUploadUrl` for the exact registered path.
  - [ ] 2.5.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.5.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.5.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.6 Update every worker storage write to register intent → broker ticket → late exchange → upload → completion RPC; never use unrestricted service-role Storage object creation.
  - [ ] 2.6.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 2.6.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 2.6.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 2.7 Redesign owner `/api/upload` to document/intent-first: create document reservation and intent before bytes, upload only through the broker, enqueue processing only after intent completion, and fail closed with orphan cleanup on partial failure.
  - [ ] 2.7.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.7.b Execute the stated action through its approved boundary.
  - [ ] 2.7.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.8 Add orphan sweeper for expired/failed intents and incomplete document reservations; remove registered objects that never completed.
  - [ ] 2.8.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.8.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.8.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.9 Remove worker and upload-route reliance on service-role Storage create/upload credentials; keep Storage create secret only in the broker and storage-maintenance cleanup path.
  - [ ] 2.9.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 2.9.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 2.9.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 2.10 Add generation-scoped path builders for future artifacts and preserve explicit generation-0 inventory for legacy objects.
  - [ ] 2.10.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.10.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.10.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.11 Define quiescence against intent state, app-ticket expiry/consumption, and bounded post-exchange window rather than Storage’s residual ~2h upload-URL TTL.
  - [ ] 2.11.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.11.b Execute the stated action through its approved boundary.
  - [ ] 2.11.c Verify expected and failure behavior and record attributable evidence.

## 3. Database lifecycle and authoritative operation queue

- [ ] 3.1 Add document lifecycle state compatible with existing processing status and monotonic deletion transitions.
  - [ ] 3.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.1.c Exercise focused success and failure cases and capture evidence.

- [ ] 3.2 Add retained non-PHI `document_deletion_operations` as the sole transactional outbox/queue/status/receipt with claim lease, retry/error/evidence, retention, and no cascading document FK.
  - [ ] 3.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.2.c Exercise focused success and failure cases and capture evidence.

- [ ] 3.3 Implement the owner-scoped idempotent tombstone RPC that locks the document, increments shared write generation, requests cancellation, invalidates reports/synthesis, inserts one operation, and returns its id/status.
  - [ ] 3.3.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.3.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.3.c Exercise focused success and failure cases and capture evidence.

- [ ] 3.4 Add indexes, constraints, fixed search paths, ownership checks, RLS/grants, and revoke PUBLIC/anon/authenticated cleanup/finalizer execution and direct lifecycle mutation.
  - [ ] 3.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.4.c Exercise focused success and failure cases and capture evidence.

- [ ] 3.5 Implement service-only skip-locked operation claim, guarded transition, retry/backoff, lease takeover, and safe status serialization.
  - [ ] 3.5.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 3.5.b Implement the stated operation only at its designated authority boundary.
  - [ ] 3.5.c Exercise focused success and failure cases and capture evidence.

## 4. Cross-domain tombstone visibility and derivative retention

- [ ] 4.1 Deny/exclude deleting documents in document list/detail/file/page/thumbnail/reprocess/mutation and signed-URL minting paths.
  - [ ] 4.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.1.b Execute the stated action through its approved boundary.
  - [ ] 4.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.2 Exclude deleting-document observations and sources in Biomarkers and Health Profile service-role queries before normalization/projection.
  - [ ] 4.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.2.b Execute the stated action through its approved boundary.
  - [ ] 4.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.3 Add report actual-source-set and source-known/invalidation fields; backfill explicit document ids and mark `document_ids = NULL` reports source-unknown without invented sources.
  - [ ] 4.3.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 4.3.b Implement the stated operation only at its designated authority boundary.
  - [ ] 4.3.c Exercise focused success and failure cases and capture evidence.

- [ ] 4.4 Implement the atomic report writer with the global lock DAG (documents sorted → synthesis → reports), exact source ids, content-epoch write-generation revalidation at commit, and revoke direct runtime DML on `reports`.
  - [ ] 4.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 4.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 4.4.c Exercise focused success and failure cases and capture evidence.

- [ ] 4.5 Revalidate report sources at eligibility/load/commit; tombstone exact-source reports containing the document and conservatively invalidate every source-unknown report for that profile.
  - [ ] 4.5.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.5.b Execute the stated action through its approved boundary.
  - [ ] 4.5.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.6 Make report list/detail/structured-context hide invalidated reports and make final purge delete each whole invalidated report, including multi-source content/summary.
  - [ ] 4.6.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.6.b Execute the stated action through its approved boundary.
  - [ ] 4.6.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.7 Implement the atomic holistic-synthesis writer with the global lock DAG (documents sorted → synthesis), exact source ids/generations, commit-time tombstone/content-epoch checks, and revoke direct runtime DML on `profile_health_synthesis`.
  - [ ] 4.7.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 4.7.b Implement the stated operation only at its designated authority boundary.
  - [ ] 4.7.c Exercise focused success and failure cases and capture evidence.

- [ ] 4.8 Invalidate/remove `profile_health_synthesis` in the tombstone transaction and make regeneration/loaders use active sources only.
  - [ ] 4.8.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.8.b Execute the stated action through its approved boundary.
  - [ ] 4.8.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.9 Restrict `ai_invocations.error_code` to the allowlisted non-PHI codes, stop persisting `error.message`, and conservatively purge/redact legacy profile-level report/synthesis rows with `document_id IS NULL`.
  - [ ] 4.9.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.9.b Execute the stated action through its approved boundary.
  - [ ] 4.9.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.10 Define document-linked `ai_invocations` clearing versus purge from populated preflight and explicitly purge every other document-derived extraction, revision, shadow, and audit row.
  - [ ] 4.10.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.10.b Execute the stated action through its approved boundary.
  - [ ] 4.10.c Verify expected and failure behavior and record attributable evidence.

## 5. Storage cleanup and final database purge

- [ ] 5.1 Implement writer quiescence using cancellation state, attempt leases, unresolved storage intents, bounded request deadlines, and the documented stability interval.
  - [ ] 5.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 5.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 5.1.c Exercise focused success and failure cases and capture evidence.

- [ ] 5.2 Implement complete paginated recursive storage inventory/removal for every registered generation and all generation-0 paths/prefixes; treat not-found as idempotent success.
  - [ ] 5.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 5.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 5.2.c Exercise focused success and failure cases and capture evidence.

- [ ] 5.3 Require at least two complete empty listings separated by the stability interval and restart purge/verification when a late object appears.
  - [ ] 5.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 5.3.b Execute the stated action through its approved boundary.
  - [ ] 5.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 5.4 Implement the final transaction with the global lock DAG, evidence/generation/writer revalidation, direct observation/lineage and derivative deletion, document deletion, and independent receipt completion.
  - [ ] 5.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 5.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 5.4.c Exercise focused success and failure cases and capture evidence.

- [ ] 5.5 Remove the legacy lineage-nulling purge function and `easyhealth.purge_lineage` authority only when the direct-delete finalizer and all callers are deployed.
  - [ ] 5.5.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 5.5.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 5.5.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 5.6 Add cleanup receipt retention/expiry and monitoring without retaining filename, raw path, extracted text, clinical value, generated narrative, or document content.
  - [ ] 5.6.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 5.6.b Implement the stated operation only at its designated authority boundary.
  - [ ] 5.6.c Exercise focused success and failure cases and capture evidence.

## 6. API and worker cutover

- [ ] 6.1 Change `DELETE /api/documents/:id` to call tombstone/enqueue and return `202 Accepted` with safe operation status; repeated DELETE returns the same operation.
  - [ ] 6.1.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 6.1.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 6.1.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 6.2 Add owner-scoped deletion-operation status and ensure cross-profile requests return 403/404 without identity or PHI leakage.
  - [ ] 6.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 6.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 6.2.c Exercise focused success and failure cases and capture evidence.

- [ ] 6.3 Deploy lease-aware processing workers and cleanup workers with shared document-first lock order; pause/drain all legacy workers before enabling DELETE.
  - [ ] 6.3.a Prepare the target environment, entry criteria, and rollback decision.
  - [ ] 6.3.b Execute the stated operation within the declared safety gates.
  - [ ] 6.3.c Capture attributable smoke, negative-case, and completion evidence.

- [ ] 6.4 Ensure cached application reads are evicted after tombstone and document the existing 900-second residual signed-URL behavior without claiming synchronous revocation.
  - [ ] 6.4.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 6.4.b Execute the stated action through its approved boundary.
  - [ ] 6.4.c Verify expected and failure behavior and record attributable evidence.

## 7. Verification

- [ ] 7.1 Add pgTAP for tombstone idempotency, generation increment, operation uniqueness/survival, report/synthesis invalidation, grants, owner isolation, and direct final purge rollback.
  - [ ] 7.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.1.c Exercise focused success and failure cases and capture evidence.

- [ ] 7.2 Add populated migration tests for explicit and NULL report scopes, observability payload fail-closed behavior, generation-0 paths, nested legacy objects, and all delete cascades.
  - [ ] 7.2.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.2.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.2.c Exercise focused success and failure cases and capture evidence.

- [ ] 7.3 Add real two-session tests for delete versus finalization, delete versus report/synthesis persist, report versus synthesis lock-order deadlock absence, republish/content-epoch drift versus report/synthesis persist, stale broker ticket/exchange after tombstone, cleanup versus storage-intent completion, competing cleanup claims, lease expiry/takeover, and repeated DELETE.
  - [ ] 7.3.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.3.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.3.c Exercise focused success and failure cases and capture evidence.

- [ ] 7.4 Add storage adapter integration tests for pagination, nested prefixes, partial failures, not-found retry, late object after first empty listing, and repeated stable-empty verification.
  - [ ] 7.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.4.c Exercise focused success and failure cases and capture evidence.

- [ ] 7.5 Add API integration for list/detail/file/page/thumbnail/reprocess/mutation denial, no new signed URL, Biomarkers/Health Profile exclusion, report invalidation, synthesis invalidation, operation status, and owner isolation.
  - [ ] 7.5.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.5.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.5.c Exercise focused success and failure cases and capture evidence.

- [ ] 7.6 Inject failure after every tombstone, cleanup transition, storage page/remove, verification, and final-purge mutation; prove no false completion or damaged active document.
  - [ ] 7.6.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 7.6.b Execute the stated action through its approved boundary.
  - [ ] 7.6.c Verify expected and failure behavior and record attributable evidence.

- [ ] 7.7 Add negative tests proving unrestricted service-role Storage upload is unused by workers and `/api/upload`, broker ticket reuse/expiry fails, exchange without valid ticket fails, and direct report/synthesis table writes are denied.
  - [ ] 7.7.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.7.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.7.c Exercise focused success and failure cases and capture evidence.

- [ ] 7.8 Add upload-lifecycle tests for document/intent-first success, insert-after-upload regression denial, and orphan sweeper removal of incomplete reservations/objects.
  - [ ] 7.8.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 7.8.b Implement the stated operation only at its designated authority boundary.
  - [ ] 7.8.c Exercise focused success and failure cases and capture evidence.

## 8. Rollout and QA

- [ ] 8.1 Confirm atomic instrumental publication is deployed, then pause/drain legacy workers, run retained database/storage/report/observability preflight, and abort on unclassified PHI or paths.
  - [ ] 8.1.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 8.1.b Perform the stated review or preflight against the defined invariants.
  - [ ] 8.1.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 8.2 Deploy additive schema/read filters and lease-aware workers before enabling the tombstone route and cleanup claims.
  - [ ] 8.2.a Prepare the target environment, entry criteria, and rollback decision.
  - [ ] 8.2.b Execute the stated operation within the declared safety gates.
  - [ ] 8.2.c Capture attributable smoke, negative-case, and completion evidence.

- [ ] 8.3 Run target smoke for active-worker cancellation, late upload, paginated/nested storage, retryable storage error, report/synthesis hiding, cross-profile denial, signed-URL residual behavior, and final receipt.
  - [ ] 8.3.a Prepare the target environment, entry criteria, and rollback decision.
  - [ ] 8.3.b Execute the stated operation within the declared safety gates.
  - [ ] 8.3.c Capture attributable smoke, negative-case, and completion evidence.

- [ ] 8.4 Update `QA/eh-104/checklist.md` with safe owner deletion/status checks and separate developer evidence; do not mark TTL expiry, storage absence, or cleanup smoke passed unless observed.
  - [ ] 8.4.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 8.4.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 8.4.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 8.5 Record monitoring, retry ownership, receipt retention, removal of the temporary provenance purge exception, and production cleanup evidence before Sprint 1 closure.
  - [ ] 8.5.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 8.5.b Perform the stated review or preflight against the defined invariants.
  - [ ] 8.5.c Publish attributable findings and block unresolved or unsafe results.

