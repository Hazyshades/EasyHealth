## Context

The current owner DELETE route runs a database lineage purge, performs unverified object-storage removals, then deletes the document. PostgreSQL and Supabase Storage cannot share one transaction, and an active worker can upload previews/OCR after cleanup has listed or removed objects. A durable design therefore needs a database tombstone, an authoritative retry queue, writer fencing, and proof of storage absence before final database purge.

Current signed URLs have a 900-second TTL. Once issued they are not individually revocable by the application; deletion of the underlying object or TTL expiry ends access.

Deletion also crosses database domains. `reports.content` and `summary_preview` can contain source PHI while `reports.document_ids = NULL` loses the actual historical source set. `profile_health_synthesis.synthesis_text` can retain deleted-document content. Observations and extraction rows remain physically present during asynchronous storage cleanup and therefore require tombstone-aware read boundaries.

Atomic instrumental publication precedes this change and owns `documents.write_generation` plus retained `document_processing_attempts`. Deletion extends those primitives; it does not replace them.

## Goals / Non-Goals

**Goals:**

- Return `202 Accepted` only after a durable tombstone and deletion operation exist.
- Prevent direct and cross-domain access after tombstone.
- Fence already-running lease-aware workers by extending the shared processing-attempt model.
- Purge every generation-0 and future storage path with pagination and stable-empty verification.
- Define exact report, synthesis, extraction, observation, and observability retention behavior.
- Retain an owner-queryable, non-PHI operation receipt after document hard purge.

**Non-Goals:**

- Claim object storage participates in a PostgreSQL transaction.
- Promise that a previously issued signed URL is synchronously revoked before its object is removed.
- Rewrite a multi-document report to remove one source while preserving its generated narrative.
- Preserve document-derived clinical data after the requested hard purge.
- Support unfenced legacy workers during rollout.

## Decisions

### 1. Use one operation row as tombstone outbox and queue

`document_deletion_operations` is inserted in the same transaction that tombstones the document. It is the authoritative operation status, retry schedule, and cleanup queue; no second outbox is maintained.

The operation stores its own immutable `document_id`, owner/profile reference, request and completion timestamps, attempt/error state, purge-manifest digest, and non-PHI evidence. Its document FK is absent or uses `ON DELETE SET NULL`, so completion survives document hard purge. Retention duration and eventual receipt deletion are explicit policy values.

Workers claim eligible operations with `FOR UPDATE SKIP LOCKED` and a bounded cleanup lease. States are `queued`, `waiting_for_writers`, `cleaning_storage`, `verifying_storage`, `purging_database`, `retryable_error`, and `completed`.

### 2. Tombstone, derivative invalidation, and fencing share one transaction

The owner deletion RPC locks the document, returns the existing operation for an idempotent repeat, otherwise:

1. changes document lifecycle to `deleting`;
2. increments the existing `write_generation`;
3. denies new reads, signed URLs, mutations, reprocess, and publication finalization;
4. cancels queued jobs and marks active processing attempts cancellation-requested;
5. invalidates affected persisted reports from owner-visible APIs;
6. invalidates/deletes the profile synthesis cache;
7. inserts the authoritative deletion operation;
8. commits and returns `202 Accepted`.

All mutation/finalization RPCs validate the document generation and reject a tombstoned document. The deletion migration and route remain disabled until all document, Biomarkers, Health Profile, Reports, and structured-context readers exclude deleting documents and invalidated derivatives.

### 3. Extend the shared attempt model with leases and storage-write intents

A worker claim continues to create the PR 2 `document_processing_attempts` row and additionally receives a random lease token, expiry, and heartbeat obligation bound to the captured generation. Every database mutation validates `(processing_attempt_id, lease_token, write_generation, not deleting)`.

Before storage upload, the worker registers a storage-write intent containing the attempt, lease token, generation, server-generated generation-scoped path, operation kind, start time, and bounded request deadline. The worker marks it complete only after upload and a post-upload fence check. If the post-check fails, it attempts immediate removal and leaves the intent recoverable by deletion cleanup.

Tombstone prevents new intents. Cleanup cannot pass `waiting_for_writers` until:

- every prior-generation processing lease is released or expired;
- every registered write intent is completed or takeover-eligible;
- the maximum bounded storage request duration has elapsed after the last unresolved intent/lease;
- no compatible worker can still publish through a valid finalizer token.

This fences already-running lease-aware workers. Rollout must pause and drain old workers that do not implement attempts/leases/intents before the tombstone API is enabled; database fencing cannot make an already-issued unfenced storage request observable.

### 4. Inventory generation 0 and every future storage path

Future object paths are server-generated under a generation scope and registered before upload. Deletion enumerates all registered generations, not only the latest.

Existing documents are generation `0`. Tombstone cleanup builds their authoritative purge inventory from:

- `documents.storage_path`;
- `documents.original_storage_path`;
- `documents.normalized_storage_path`;
- `documents.thumbnail_storage_path`;
- `document_pages.preview_storage_path`;
- `document_pages.ocr_json_storage_path`;
- every recursively listed object under the legacy `${profileId}/${documentId}` prefix;
- any additional registered path discovered by retained-data preflight.

Listing follows every nested prefix and storage page without fixed first-page assumptions. After quiescence, cleanup removes registered paths and every generation/legacy prefix, waits the defined consistency interval, then performs at least two complete paginated listings that are empty and separated by the stability interval. A late object restarts purge/verification rather than allowing completion.

### 5. Make persisted report source and invalidation policy explicit

New reports store both requested scope and the exact non-null `source_document_ids` used to generate `content` and `summary_preview`. Existing reports with explicit `document_ids` backfill that exact source set. Existing `document_ids = NULL` reports cannot prove their historical inputs and are marked `source_scope_known = false` rather than assigned invented sources.

At tombstone:

- every report whose exact source set contains the document becomes inaccessible and is marked for purge;
- every source-unknown legacy report for that profile is conservatively invalidated because it may contain the deleted document;
- a multi-document report is invalidated as a whole; its generated text is never rewritten by removing an id;
- report list/detail APIs exclude invalidated rows.

The final database transaction deletes those invalidated report rows. This preserves atomic final database purge while preventing PHI exposure during asynchronous storage cleanup.

### 6. Invalidate synthesis and every cross-domain read boundary

The tombstone transaction removes or invalidates `profile_health_synthesis` for the profile. Regeneration uses only active documents; a cached synthesis containing the deleting document is never served.

Biomarkers and Health Profile exclude document-derived observations whose document is deleting. Report generation and structured context resolve only active eligible document ids and current publication content. Document list/detail/file/page/thumbnail/reprocess/mutation APIs deny the tombstoned document. These filters are required even though service-role reads bypass RLS.

### 7. Define non-PHI observability retention

`ai_invocations` may retain provider/model/stage/token/latency/success metadata under the existing audit policy with its document FK cleared only if populated preflight verifies that the table contains no prompt, response, filename, raw path, extracted text, or clinical payload. If the schema or retained rows contain such payload, the rows become part of final purge instead. `measurement_resolution_shadow_events.context` and every extraction/revision/audit child tied to the document are purged through explicit deletion or verified cascades.

The retained deletion receipt follows the stricter non-PHI contract and contains no filename, storage path, extracted data, clinical value, or generated narrative.

### 8. Define signed-URL behavior honestly

After tombstone, APIs never mint or return a new document, page, or thumbnail URL and cached application entries are evicted where the client receives deletion state. A previously issued URL may continue to work until cleanup removes the object or its existing 900-second TTL expires. The operation remains non-completed during storage cleanup; the product must not claim immediate cryptographic URL revocation.

### 9. Purge database data only after storage proof

After stable-empty verification, one final transaction locks in this order:

1. document;
2. deletion operation;
3. jobs, processing attempts/leases, and write intents in id order;
4. prepared/current publication pointer and history in id order;
5. observations, normalization/extraction/audit rows, invalidated reports, and other derived rows in deterministic table/id order;
6. document;
7. retained independent deletion receipt completion.

It revalidates generation, tombstone state, no live writers, and storage-verification evidence; then hard-purges derived rows and the document and marks the independent operation receipt completed. Failure rolls back the database purge and leaves the operation retryable.

The final purge deletes observations directly before the document, so `observations.document_id ON DELETE SET NULL` never mutates immutable identity. Cutover removes the legacy lineage-nulling purge and `easyhealth.purge_lineage` authority. Strict provenance is deployed only afterward.

### 10. Preserve idempotency across crashes

Repeated owner DELETE returns the same operation. Cleanup claims are leased. Each storage removal treats not-found as success; every listing is paginated. Each transition is guarded by expected prior state/generation. A retry after any failure resumes from authoritative database state and repeats verification.

## Risks / Trade-offs

- **[Previously issued URL remains temporarily valid]** → Bound exposure by the existing 900-second TTL and start object removal immediately; do not report completion early.
- **[Storage upload finishes after a first empty listing]** → Registered intents, quiescence, generation prefixes, and repeated stable-empty listings prevent final completion.
- **[Legacy worker ignores fences]** → Pause/drain it during rollout before enabling the new DELETE contract.
- **[Source-unknown reports are over-invalidated]** → Prefer privacy-safe deletion to retaining narrative that may contain deleted-document PHI.
- **[Cross-domain reader misses tombstone filtering]** → Inventory and test every service-role consumer before enabling the route.
- **[Observability metadata later gains payload fields]** → Retention preflight fails closed and final purge includes those rows.
- **[Operation receipt retains PHI]** → Store identifiers/state/digests only; prohibit filename, extracted text, raw path, or clinical payload.
- **[Deletion and finalization deadlock]** → Both lock document first and use the shared order.
