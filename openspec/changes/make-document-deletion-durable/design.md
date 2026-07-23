## Context

The current owner DELETE route runs a database lineage purge, performs unverified object-storage removals, then deletes the document. PostgreSQL and Supabase Storage cannot share one transaction, and an active worker can upload previews/OCR after cleanup has listed or removed objects. A durable design therefore needs a database tombstone, an authoritative retry queue, writer fencing, and proof of storage absence before final database purge.

Current signed URLs have a 900-second TTL. Once issued they are not individually revocable by the application; deletion of the underlying object or TTL expiry ends access.

## Goals / Non-Goals

**Goals:**

- Return `202 Accepted` only after a durable tombstone and deletion operation exist.
- Prevent new writers and finalizers after tombstone, and fence already-running lease-aware workers.
- Purge every generation/path with pagination and stable-empty verification.
- Retain an owner-queryable, non-PHI operation receipt after document hard purge.

**Non-Goals:**

- Claim object storage participates in a PostgreSQL transaction.
- Promise that a previously issued signed URL is synchronously revoked before its object is removed.
- Preserve document-derived clinical data after the requested hard purge unless a separate retention policy explicitly requires it.
- Support unfenced legacy workers during rollout.

## Decisions

### 1. Use one operation row as tombstone outbox and queue

`document_deletion_operations` is inserted in the same transaction that tombstones the document. It is the authoritative operation status, retry schedule, and cleanup queue; no second outbox is maintained.

The operation stores its own immutable `document_id`, owner/profile reference, request and completion timestamps, attempt/error state, purge-manifest digest, and non-PHI evidence. Its document FK is absent or uses `ON DELETE SET NULL`, so completion survives document hard purge. Retention duration and eventual receipt deletion are explicit policy values.

Workers claim eligible operations with `FOR UPDATE SKIP LOCKED` and a bounded cleanup lease. States are `queued`, `waiting_for_writers`, `cleaning_storage`, `verifying_storage`, `purging_database`, `retryable_error`, and `completed`.

### 2. Tombstone and fence in one database transaction

The owner deletion RPC locks the document, returns the existing operation for an idempotent repeat, otherwise:

1. changes document lifecycle to `deleting`;
2. increments `write_generation`;
3. denies new reads, signed URLs, mutations, reprocess, and publication finalization;
4. cancels queued jobs and marks processing jobs `cancellation_requested`;
5. inserts the authoritative deletion operation;
6. commits and returns `202 Accepted`.

All mutation/finalization RPCs lock or validate the document generation and reject a tombstoned document.

### 3. Fence workers with generation-bound leases and storage-write intents

A worker claim receives a random lease token, the document's current generation, expiry, and heartbeat obligation. Every database mutation validates `(job_id, lease_token, generation, not deleting)`.

Before storage upload, the worker registers a storage-write intent containing the lease token, generation, server-generated generation-scoped path, operation kind, start time, and bounded request deadline. The worker marks it complete only after upload and a post-upload fence check. If the post-check fails, it attempts immediate removal and leaves the intent recoverable by deletion cleanup.

Tombstone prevents new intents. Cleanup cannot pass `waiting_for_writers` until:

- every prior-generation processing lease is released or expired;
- every registered write intent is completed or takeover-eligible;
- the maximum bounded storage request duration has elapsed after the last unresolved intent/lease;
- no compatible worker can still publish through a valid finalizer token.

After quiescence, cleanup purges all generation prefixes, waits the defined consistency interval, then performs at least two complete paginated listings that are empty and separated by the stability interval. A late object restarts purge/verification rather than allowing completion.

This fences already-running lease-aware workers. Rollout must pause and drain old workers that do not implement leases/intents before the tombstone API is enabled; database fencing cannot make an already-issued unfenced storage request observable.

### 4. Define signed-URL behavior honestly

After tombstone, APIs never mint or return a new document, page, or thumbnail URL and cached application entries are evicted where the client receives deletion state. A previously issued URL may continue to work until cleanup removes the object or its existing 900-second TTL expires. The operation remains non-completed during storage cleanup; the product must not claim immediate cryptographic URL revocation.

### 5. Purge database data only after storage proof

After stable-empty verification, one final transaction locks in this order:

1. document;
2. deletion operation;
3. jobs/leases and write intents in id order;
4. prepared/current publication pointer and history in id order;
5. observations and derived extraction rows in deterministic table/id order;
6. document.

It revalidates generation, tombstone state, no live writers, and the storage-verification evidence; then hard-purges derived rows and the document and marks the independent operation receipt completed. Failure rolls back the database purge and leaves the operation retryable.

The final purge deletes laboratory observations/derived rows directly, so the temporary provenance trigger exception and legacy lineage-nulling purge are removed after cutover.

### 6. Preserve idempotency across crashes

Repeated owner DELETE returns the same operation. Cleanup claims are leased. Each storage removal treats not-found as success; every listing is paginated. Each transition is guarded by expected prior state/generation. A retry after any failure resumes from authoritative database state and repeats verification.

## Risks / Trade-offs

- **[Previously issued URL remains temporarily valid]** → Bound exposure by the existing 900-second TTL and start object removal immediately; do not report completion early.
- **[Storage upload finishes after a first empty listing]** → Registered intents, quiescence, generation prefixes, and repeated stable-empty listings prevent final completion.
- **[Legacy worker ignores fences]** → Pause/drain it during rollout before enabling the new DELETE contract.
- **[Operation receipt retains PHI]** → Store identifiers/state/digests only; prohibit filename, extracted text, raw path, or clinical payload.
- **[Deletion and finalization deadlock]** → Both lock document first and use the shared order.
