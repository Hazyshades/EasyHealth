## Context

The EH-105 RPC currently creates/reuses instrumental source rows and observations, marks the new hash current, and supersedes the previous hash in one transaction. The worker then generates summary and performs document completion, synthesis invalidation, and job completion through separate calls. A failure after the RPC commits therefore publishes an extraction that belongs to a failed processing attempt.

A hash identifies extraction content, not a publication event. Reusing only `(document_id, snapshot_hash)` cannot represent `A → B → A`, a repeated unchanged processing attempt, or distinct summary/finalization history without mutating old records.

## Goals / Non-Goals

**Goals:**

- Keep measures, findings, and impression invisible until one atomic finalizer publishes them with summary and completion state.
- Preserve immutable content while recording every publication transition, including `A → B → A`.
- Define deterministic hash, migration, reader, retry, stale-worker, and concurrency behavior.
- Share document-first locking and ownership rules with durable deletion.

**Non-Goals:**

- Generate LLM summary inside PostgreSQL.
- Treat compensation after a partial commit as correctness.
- Reconstruct historical findings that the current schema never versioned.
- Change laboratory active-revision behavior or EH-112 UX.

## Decisions

### 1. Separate immutable content from publication history

Introduce these logical entities (exact names may follow migration conventions):

- **snapshot content**: document/profile ownership, canonicalization version, canonical payload, hash, and immutable child measures/findings/impression; unique by `(document_id, canonicalization_version, snapshot_hash)`;
- **publication attempt**: processing attempt/lease, content id, state (`prepared`, `current`, `superseded`, `abandoned`), summary, completion-payload digest, and transition timestamps;
- **current pointer**: exactly one authoritative current publication per document.

`prepared → current` and `prepared → abandoned` are allowed. `current → superseded` is allowed. `superseded` and `abandoned` are terminal. Content has no publication state and is never mutated.

Summary belongs to the publication attempt because generation may differ between processing attempts. Measures, findings, and impression belong to immutable content and are shared when exact content is republished.

### 2. Define same-hash behavior by publication state

| Existing content/publication state | Same document, version, hash, and exact payload | Conflict behavior |
| --- | --- | --- |
| `PREPARED` for the same processing-attempt token | Return the same prepared publication id | Different payload for the claimed hash rejects |
| `PREPARED` for another live attempt | Reject as concurrent/stale under the one-active-job rule | Caller retries after the owning attempt becomes terminal |
| `CURRENT` and finalizer retry for the committed attempt | Return the committed publication/completion result without writes | Different completion payload rejects |
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

### 4. Finalize in one transaction

The finalizer validates and locks in this order:

1. document;
2. active processing job and attempt token;
3. document deletion/generation fence when present;
4. current-publication pointer;
5. target prepared publication;
6. content and child rows in stable id order;
7. synthesis row.

It then validates exact content/summary binding, supersedes the prior publication, marks the target current, advances the pointer, publishes its structured children, writes summary and document completion, completes the job, and invalidates synthesis. Any injected failure rolls back every step.

Only the fixed-search-path finalizer and prepare functions are executable by `service_role`; `PUBLIC`, `anon`, and `authenticated` receive no execution or direct mutation grants. Functions validate document/profile/job ownership internally.

### 5. Backfill populated databases without inventing history

Preflight classifies every instrumental document by source hash, current-row cardinality, ownership, observation linkage, job state, and attachable current findings/summary.

- Existing measure groups become `legacy-v1` immutable content using the known v1 canonicalization contract.
- Existing current and superseded groups receive publication-history rows preserving observed state.
- Current document-level findings/impression/summary attach only to the uniquely identified current legacy publication.
- Missing historical findings remain explicitly unavailable; the migration does not synthesize them.
- Ambiguous retained data aborts. Explicitly disposable environments may reset and reprocess through a separately guarded path.

During reader cutover, the finalizer maintains legacy `is_current` fields atomically for old readers. New readers first ship behind an equivalence check against the publication pointer; after all readers cut over, legacy current-state writes and the old replacement RPC are removed.

### 6. Clean orphan preparations conservatively

Cleanup may abandon an expired prepared publication only after its processing attempt is terminal or lease-expired and no finalizer can still own it. It never deletes immutable content referenced by current, superseded, or retained audit history. Repeated cleanup is idempotent.

## Risks / Trade-offs

- **[More rows for unchanged reprocessing]** → Publication history is intentionally separate from deduplicated content and provides the required audit trail.
- **[Worker and DB hashes diverge]** → DB is authoritative; golden fixtures and caller-hash rejection expose drift.
- **[Legacy findings cannot be assigned historically]** → Attach only provable current data and record the limitation instead of fabricating lineage.
- **[Deadlock with deletion/finalization]** → Both operations lock the document first and follow the shared deterministic order.
- **[Prepared rows accumulate after crashes]** → Terminal-attempt cleanup abandons attempts while retaining shared immutable content.
