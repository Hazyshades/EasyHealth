## Context

The EH-105 RPC currently creates/reuses instrumental source rows and observations, marks the new hash current, and supersedes the previous hash in one transaction. The worker then generates summary and performs document completion, synthesis invalidation, and job completion through separate calls. A failure after the RPC commits therefore publishes an extraction that belongs to a failed processing attempt.

A hash identifies extraction content, not a publication event. Reusing only `(document_id, snapshot_hash)` cannot represent `A → B → A`, a repeated unchanged processing attempt, or distinct summary/finalization history without mutating old records.

`document_extracted_findings` currently has neither a snapshot/version id nor a current flag, and existing readers select every accepted row by document. Retaining historical findings in that relation would mix versions; moving them without a compatibility relation would make old readers lose current findings.

Current processing jobs expose only a mutable attempt count. Publication needs a retained per-claim identity and document generation before durable deletion can extend the same ownership model with leases.

## Goals / Non-Goals

**Goals:**

- Keep measures, findings, and impression invisible until one atomic finalizer publishes them with summary and completion state.
- Preserve immutable content while recording every publication transition, including `A → B → A`.
- Keep old findings readers current-only throughout a controlled worker/reader cutover.
- Define the shared processing-attempt and generation foundation that durable deletion later extends.
- Define deterministic hash, populated migration, retry, stale-worker, concurrency, and orphan behavior.
- Share document-first locking and ownership rules with durable deletion.

**Non-Goals:**

- Generate LLM summary inside PostgreSQL.
- Treat compensation after a partial commit as correctness.
- Reconstruct historical findings that the current schema never versioned.
- Introduce lease expiry, heartbeats, or storage intents; durable deletion owns those extensions.
- Change laboratory active-revision behavior or EH-112 UX.

## Decisions

### 1. Separate immutable content from publication history

Introduce these logical entities (exact names may follow migration conventions):

- **snapshot content**: document/profile ownership, canonicalization version, canonical payload, hash, and immutable child measures/findings/impression; unique by `(document_id, canonicalization_version, snapshot_hash)`;
- **publication attempt**: processing attempt id, content id, state (`prepared`, `current`, `superseded`, `abandoned`), summary, completion-payload digest, and transition timestamps;
- **current pointer**: exactly one authoritative current publication per document.

`prepared → current` and `prepared → abandoned` are allowed. `current → superseded` is allowed. `superseded` and `abandoned` are terminal. Content has no publication state and is never mutated.

Summary belongs to the publication attempt because generation may differ between processing attempts. Measures, findings, and impression belong to immutable content and are shared when exact content is republished. A publication digest binds the content id/hash, exact summary payload/hash, and completion payload; replay with a different digest is rejected.

### 2. Define same-hash behavior by publication state

| Existing content/publication state | Same document, version, hash, and exact payload | Conflict behavior |
| --- | --- | --- |
| `PREPARED` for the same processing attempt | Return the same prepared publication id | Different payload for the claimed hash rejects |
| `PREPARED` for another active attempt | Reject as concurrent/stale under the one-active-attempt rule | Caller retries after the owning attempt becomes terminal |
| `CURRENT` and finalizer retry for the committed attempt | Return the committed publication/completion result without writes | Different publication/completion digest rejects |
| `CURRENT` from an older processing attempt | Create a new prepared publication referencing the same content; finalization records a new publication event | Never mutate the existing current event in place |
| `SUPERSEDED` | Create a new prepared publication referencing the immutable content | Finalization may republish it, enabling `A → B → A` |
| `ABANDONED` | Keep the abandoned event terminal; a new eligible attempt creates a new prepared publication referencing the content | An abandoned attempt cannot be revived |

For `A → B → A`, publication 1 references content A and becomes superseded, publication 2 references B and becomes superseded, and publication 3 references the original immutable A content and becomes current.

### 3. Make the database authoritative for canonicalization and hashing

Canonicalization version `eh105.instrumental-snapshot.v2` includes:

- extraction schema, processing, and model versions;
- study date, modality, and body region;
- every persisted immutable measure field, with explicit nulls and deterministic order by source locator plus occurrence;
- every persisted immutable finding/impression field, with explicit source locator/ordinal and deterministic order.

It excludes document/profile ids because uniqueness is already document-scoped, database ids, job/attempt ids, timestamps, publication state, and summary.

The prepare RPC accepts structured payload and an optional caller digest, constructs the canonical JSONB with ordered arrays, computes SHA-256 with `pgcrypto`, and rejects a mismatched caller digest. Exact reuse compares stored canonical payload as well as version/hash; hash equality alone is never trusted. Cross-language golden fixtures prove worker and database representations agree.

### 4. Introduce one retained processing attempt per claim

This change introduces `documents.write_generation bigint not null default 0` and `document_processing_attempts`. Every atomic claim creates a new attempt row containing at least id, job/document/profile ownership, attempt number, captured write generation, lifecycle state, claim timestamp, and terminal timestamp. One partial constraint permits only one active attempt for a job/document according to the existing one-active-job policy.

The worker receives `processing_attempt_id`; prepare, finalize, attempt failure/requeue, and orphan cleanup validate it against the active job and captured generation. A reclaimed or retried job receives a new attempt id, so the old worker cannot publish. A new attempt may reuse immutable content but creates its own publication event.

Durable deletion reuses these rows and adds random lease token, expiry, heartbeat, cancellation, and storage-write-intent semantics. It increments the same `documents.write_generation` on tombstone. It must not introduce another attempt/lease table or a competing generation field.

### 5. Finalize in one transaction

The finalizer validates and locks in this order:

1. document;
2. active processing job;
3. active processing attempt and captured write generation;
4. current-publication pointer;
5. target prepared publication;
6. content and child rows in stable id order;
7. synthesis row.

It validates exact content/summary/completion binding, supersedes the prior publication, marks the target current, advances the pointer, updates compatibility projections, writes summary and document completion, completes the job/attempt, and invalidates synthesis. Any injected failure rolls back every step.

Only fixed-search-path claim, prepare, finalizer, attempt-transition, and cleanup functions are executable by `service_role`; `PUBLIC`, `anon`, and `authenticated` receive no execution or direct state-mutation grants. Functions validate document/profile/job/attempt ownership internally.

### 6. Preserve old findings readers with a current-only relation

Rollout pauses and drains old instrumental workers before the physical findings table changes. The migration moves/backfills instrumental findings into an immutable versioned relation linked to snapshot content, then preserves the existing PostgREST name `document_extracted_findings` as a read-compatible current-only view or equivalent projection with the columns old readers expect.

The compatibility relation resolves through the authoritative current pointer, so accepted historical, prepared, superseded, and abandoned findings never appear to old document-detail, report-eligibility, or structured-context readers. Old workers are not allowed to write through the compatibility relation; the replacement worker writes only through prepare/finalize RPCs.

The finalizer keeps legacy instrumental-measure `is_current` projections equivalent to the pointer for old observation readers. New readers cut over behind equivalence checks. Compatibility projections and the old replacement RPC are removed only in a later gated cleanup after worker/reader inventory passes.

### 7. Backfill populated databases without inventing history

Preflight classifies every instrumental document by source hash, current-row cardinality, ownership, observation linkage, job state, attachable current findings/summary, and generation-0 attempt state.

- Existing measure groups become `legacy-v1` immutable content using the known v1 canonicalization contract.
- Existing current and superseded groups receive publication-history rows preserving observed state.
- Current document-level findings/impression/summary attach only to the uniquely identified current legacy publication.
- Missing historical findings remain explicitly unavailable; the migration does not synthesize them.
- Existing jobs/claims are quiesced; retained current state receives generation `0` and only provable attempt linkage.
- Ambiguous retained data aborts. Explicitly disposable environments may reset and reprocess through a separately guarded path.

### 8. Clean orphan preparations conservatively

Before durable deletion adds leases, cleanup may abandon a prepared publication only after its processing attempt is terminal and no finalizer can still own it. After the lease extension, lease expiry is additional evidence but never a substitute for deterministic lock/state validation. Cleanup never deletes immutable content referenced by current, superseded, or retained audit history. Repeated cleanup is idempotent.

## Risks / Trade-offs

- **[More rows for unchanged reprocessing]** → Publication history is intentionally separate from deduplicated content and provides the required audit trail.
- **[Worker and DB hashes diverge]** → DB is authoritative; golden fixtures and caller-hash rejection expose drift.
- **[Legacy findings cannot be assigned historically]** → Attach only provable current data and record the limitation instead of fabricating lineage.
- **[Old worker writes to the compatibility view]** → Pause/drain old workers before migration and resume only the RPC-based worker.
- **[Attempt and deletion leases diverge]** → PR 2 owns the base attempt/generation schema; durable deletion only extends it.
- **[Deadlock with deletion/finalization]** → Both operations lock the document first and follow the shared order.
- **[Prepared rows accumulate after crashes]** → Terminal-attempt cleanup abandons publications while retaining shared immutable content.
