## Why

Document deletion currently commits laboratory lineage purge before unchecked storage removal and final document deletion, which can return success with PHI objects retained or leave a surviving document with damaged lineage. Synchronous best-effort storage calls cannot provide a durable deletion guarantee, especially while an already-running worker can still upload after cleanup begins.

## What Changes

- Replace synchronous destructive deletion with a tombstone transaction that marks the document `deleting`, increments its write generation, blocks new reads/signed URLs/mutations, cancels jobs, and inserts one authoritative deletion operation/queue row before returning `202 Accepted`.
- Add generation-fenced worker leases and registered storage-write intents. Cleanup cannot finish while an old-generation lease or potentially in-flight storage write can still produce an object.
- Require generation-scoped storage paths, bounded write timeouts, lease expiry/release, a quiescence interval, paginated purge, and repeated stable-empty verification before final database purge.
- Make the deletion operation itself the transactional outbox and authoritative queue; do not maintain a second queue whose state can diverge.
- Define previously issued signed URLs: no new URL is issued after tombstone, while an already issued URL may remain usable until its object is removed or its current 900-second TTL expires. The API does not report final success during that interval.
- Hard-purge derived database data only after storage absence is verified, then retain a non-PHI deletion-operation receipt after the document row is removed.
- Make request, claim, cleanup, retry, verification, and completion idempotent and failure-injectable.
- Remove the temporary laboratory provenance-purge bypass after the durable final-purge transaction no longer requires lineage nulling.

## Capabilities

### New Capabilities

- `document-deletion-lifecycle`: Tombstone, fencing, authoritative deletion queue, PHI storage cleanup, final purge, and retained deletion-status contract.

### Modified Capabilities

- `documents-api`: Change owner deletion from immediate final success to an asynchronous `202 Accepted` operation and deny access once tombstoned.
- `document-worker-reliability`: Add generation-fenced leases and storage-write intent recovery so stale workers cannot outlive deletion.
- `document-processing`: Prevent prepared or current publication finalization after a document enters deletion.

## Impact

- **Domain:** documents.
- **API:** `DELETE /api/documents/:id` becomes asynchronous and exposes an owner-scoped operation status.
- **Database:** document lifecycle/generation, job leases, storage-write intents, and retained deletion operations.
- **Storage:** generation-scoped object writes, complete pagination, retryable purge, and stable-empty verification.
- **Worker:** processing and cleanup workers share document-first lock order and generation fencing.
- **Delivery:** depends on atomic instrumental publication so deletion can fence all prepared/current publication states; production and Sprint 1 closure remain blocked until target-environment cleanup smoke passes.
