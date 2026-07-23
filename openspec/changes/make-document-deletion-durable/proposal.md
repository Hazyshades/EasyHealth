## Why

Document deletion currently commits laboratory lineage purge before unchecked storage removal and final document deletion, which can return success with PHI objects retained or leave a surviving document with damaged lineage. Synchronous best-effort storage calls cannot provide a durable deletion guarantee, especially while an already-running worker can still upload after cleanup begins. Persisted reports and holistic synthesis can also retain deleted-document PHI unless their source and visibility lifecycle is explicit.

## What Changes

- Replace synchronous destructive deletion with a tombstone transaction that marks the document `deleting`, increments the shared write generation introduced by atomic publication, blocks new direct and cross-domain reads/signed URLs/mutations, cancels jobs, and inserts one authoritative deletion operation/queue row before returning `202 Accepted`.
- Extend the shared `document_processing_attempts` model with generation-fenced lease token, expiry, heartbeat, cancellation, and registered storage-write intents. Do not create a second attempt or generation authority.
- Require generation-scoped storage paths, bounded write timeouts, lease expiry/release, a quiescence interval, paginated purge, and repeated stable-empty verification before final database purge.
- Inventory and purge generation `0`: every legacy storage column, page preview/OCR path, arbitrary legacy document prefix, nested object, and later registered generation path.
- Make the deletion operation itself the transactional outbox and authoritative queue; do not maintain a second queue whose state can diverge.
- Persist the actual source-document set for every new report. Tombstone affected reports immediately from owner-visible APIs, conservatively invalidate source-unknown legacy reports, invalidate holistic synthesis, and exclude deleting-document observations/findings from Biomarkers, Health Profile, Reports, and structured context.
- Define report retention: a multi-document report containing the deleted source is invalidated as a whole and hard-purged at final deletion rather than rewritten; legacy `document_ids = NULL` reports are treated as source-unknown and conservatively invalidated for that profile.
- Define non-PHI observability retention explicitly: `ai_invocations` metadata may retain its existing audit fields with document linkage cleared only while preflight proves it contains no prompt, filename, raw path, extracted content, or clinical payload.
- Define previously issued signed URLs: no new URL is issued after tombstone, while an already issued URL may remain usable until its object is removed or its current 900-second TTL expires. The API does not report final success during that interval.
- Hard-purge all document-derived database data and invalidated persisted derivatives only after storage absence is verified, then retain a non-PHI deletion-operation receipt after the document row is removed.
- Make request, claim, cleanup, retry, verification, and completion idempotent and failure-injectable.
- Remove the legacy laboratory lineage-nulling purge and forgeable GUC path during cutover; strict provenance is deployed afterward against the direct-delete lifecycle.

## Capabilities

### New Capabilities

- `document-deletion-lifecycle`: Tombstone, fencing, authoritative deletion queue, PHI storage/derivative cleanup, final purge, and retained deletion-status contract.

### Modified Capabilities

- `documents-api`: Change owner deletion from immediate final success to an asynchronous `202 Accepted` operation and deny access once tombstoned.
- `document-worker-reliability`: Extend shared processing attempts with generation-fenced leases and storage-write intent recovery so stale workers cannot outlive deletion.
- `document-processing`: Prevent extraction persistence or publication finalization after a document enters deletion and govern generation-0/future storage artifacts.
- `biomarkers-overview`: Exclude observations whose source document is deleting.
- `health-profile`: Exclude deleting documents and their observations from source lists and deterministic presentation.
- `multi-source-reports`: Persist actual source sets and invalidate/purge reports derived from a deleting document.
- `holistic-health-profile`: Invalidate synthesis at tombstone and regenerate only from active source documents.

## Impact

- **Domains:** documents, health-profile, reports.
- **API:** `DELETE /api/documents/:id` becomes asynchronous and exposes an owner-scoped operation status; all cross-domain readers honor tombstone visibility.
- **Database:** document lifecycle, extensions to shared processing attempts, storage-write intents, report source/invalidation metadata, retained deletion operations, and deterministic final purge.
- **Storage:** generation-0 plus generation-scoped object inventory, complete pagination, retryable purge, and stable-empty verification.
- **Worker:** processing and cleanup workers share document-first lock order and generation fencing.
- **Delivery:** depends on atomic instrumental publication and its processing-attempt/generation foundation; strict provenance follows this change. Production and Sprint 1 closure remain blocked until target-environment cleanup smoke passes.
