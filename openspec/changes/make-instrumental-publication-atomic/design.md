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
- Define the shared processing-attempt and content-epoch `write_generation` foundation that durable deletion later extends and that report/synthesis writers use to detect republish during LLM latency.
- Define deterministic hash, populated migration, retry, stale-worker, concurrency, and orphan behavior.
- Share the global lock DAG with durable deletion and report/synthesis writers: documents → jobs/attempts/publication → synthesis → reports.

**Non-Goals:**

- Generate LLM summary inside PostgreSQL.
- Treat compensation after a partial commit as correctness.
- Reconstruct historical findings that the current schema never versioned.
- Introduce lease expiry, heartbeats, or storage intents; durable deletion owns those extensions.
- Change laboratory active-revision behavior or EH-112 UX.

## Decisions

### 1. Separate immutable content from publication history

Introduce these logical entities (exact names may follow migration conventions):

- **snapshot content**: document/profile ownership, canonicalization version, canonical payload (including `facility_name`), hash, and immutable child measures/findings/impression; unique by `(document_id, canonicalization_version, snapshot_hash)` and also `unique (id, profile_id, document_id)` for composite ownership FKs;
- **publication attempt**: processing attempt id, content id, state (`prepared`, `current`, `superseded`, `abandoned`), summary, completion-payload digest, and transition timestamps; owns `(profile_id, document_id)` matching its content;
- **current pointer**: exactly one authoritative current publication per document, keyed by document and carrying matching `(profile_id, document_id, snapshot_content_id)`.

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
- study date, modality, body region, and `facility_name` (provider/facility display label; may be null when absent on the source document);
- every persisted immutable measure field, with explicit nulls and deterministic order by source locator plus occurrence;
- every persisted immutable finding/impression field, with explicit source locator/ordinal and deterministic order.

`facility_name` is part of immutable content and therefore part of the hash. Changing only the facility label produces a new content version. Document projection `documents.lab_name` equals current content.`facility_name` (null stays null).

It excludes document/profile ids because uniqueness is already document-scoped, database ids, job/attempt ids, timestamps, publication state, and summary.

The prepare RPC accepts structured payload and an optional caller digest, constructs the canonical JSONB with ordered arrays, computes SHA-256 with `pgcrypto`, and rejects a mismatched caller digest. Exact reuse compares stored canonical payload as well as version/hash; hash equality alone is never trusted. Cross-language golden fixtures prove worker and database representations agree.

### 4. Enforce composite ownership FKs for every publication entity

Follow the EH-105 instrumental measure pattern (`unique (id, profile_id, document_id)` + composite child FKs). Single-uuid parent FKs alone are insufficient because a child could attach a valid parent id under a mismatched profile/document.

Exact ownership matrix:

| Child | Parent | FK columns | Parent uniqueness required | ON DELETE |
| --- | --- | --- | --- | --- |
| snapshot content | `documents` / `profiles` | `document_id`, `profile_id` | existing document/profile PKs | `RESTRICT` or finalizer-only explicit delete (no silent cascade into observations) |
| snapshot content | — | — | `unique (id, profile_id, document_id)` | — |
| finding versions | snapshot content | `(snapshot_content_id, profile_id, document_id)` | content `unique (id, profile_id, document_id)` | `RESTRICT` |
| measures (content children) | snapshot content | `(snapshot_content_id, profile_id, document_id)` | same | `RESTRICT` |
| publication attempt/history | snapshot content | `(snapshot_content_id, profile_id, document_id)` | same | `RESTRICT` |
| publication attempt/history | processing attempt / document | attempt id + matching `profile_id`/`document_id` | attempt ownership unique | `RESTRICT` |
| current pointer | publication / content | `(publication_id or snapshot_content_id, profile_id, document_id)` | matching parent composite unique | `RESTRICT` |
| processing attempts | document/profile/job | `document_id`, `profile_id`, `job_id` with matching ownership checks | one-active-attempt partial unique | no client cascade authority |

Writers MUST insert children with the same `(profile_id, document_id)` as the locked parent. pgTAP negatives MUST attempt cross-profile/cross-document attachment through a valid parent uuid and expect FK/check rejection.

### 5. Introduce one retained processing attempt and a content-epoch write generation


This change introduces `documents.write_generation bigint not null default 0` and `document_processing_attempts`. `write_generation` is a **content epoch**, not a deletion-only counter:

- claim captures the current epoch on the attempt row;
- a successful finalizer commit that advances the authoritative current publication MUST increment `write_generation` by exactly one in the same transaction (covers first publish, republish, reprocess, and `A → B → A`);
- idempotent finalizer replay of an already-committed attempt MUST NOT increment again;
- prepare, failed finalize, abandoned preparation, and equal no-op retries MUST NOT increment;
- durable deletion later increments the same field on tombstone.

Every atomic claim creates a new attempt row containing at least id, job/document/profile ownership, attempt number, captured write generation, lifecycle state, claim timestamp, and terminal timestamp. One partial constraint permits only one active attempt for a job/document according to the existing one-active-job policy.

The worker receives `processing_attempt_id`; prepare, finalize, attempt failure/requeue, and orphan cleanup validate it against the active job and captured generation. A reclaimed or retried job receives a new attempt id, so the old worker cannot publish. A new attempt may reuse immutable content but creates its own publication event and, on successful current advancement, a new content epoch.

Durable deletion reuses these rows and adds random lease token, expiry, heartbeat, cancellation, and storage-write-intent semantics. It must not introduce another attempt/lease table or a competing generation field.

### 6. Finalize in one transaction

The finalizer validates and locks in the shared global DAG (aligned with durable deletion / report / synthesis writers):

1. document;
2. active processing job;
3. active processing attempt and captured write generation;
4. current-publication pointer;
5. target prepared publication;
6. content and child rows in stable id order;
7. `profile_health_synthesis` row when invalidated.

It does not lock `reports` unless a future extension requires it; report writers lock reports after synthesis under the same DAG.

It validates exact content/summary/completion binding, supersedes the prior publication, marks the target current, advances the pointer, increments `documents.write_generation` by one when this commit newly advances the current publication, updates compatibility projections, writes summary and document completion, completes the job/attempt, and invalidates synthesis. Idempotent replay of an already-committed finalizer result returns success without a second generation increment. Any injected failure rolls back every step, including the generation increment.

Only fixed-search-path claim, prepare, finalizer, attempt-transition, and cleanup functions are executable by `service_role`; `PUBLIC`, `anon`, and `authenticated` receive no execution or direct state-mutation grants. Functions validate document/profile/job/attempt ownership internally.

### 7. Replace findings storage with an exact current-only security-invoker view

Exact cutover decision (not "view or equivalent"):

1. Pause/drain old instrumental workers.
2. Rename the physical table `public.document_extracted_findings` → `public.document_extracted_finding_versions`.
3. Add composite ownership to finding versions: `unique (id, profile_id, document_id)` if needed for downstream FKs, and `foreign key (snapshot_content_id, profile_id, document_id) references snapshot_content (id, profile_id, document_id) ON DELETE RESTRICT`. Keep `document_id`/`profile_id` on every version row and drop any uniqueness that implied one current row set by document alone. Historical/prepared/superseded rows live only in this versioned table.
4. Recreate `public.document_extracted_findings` as a PostgreSQL view with `WITH (security_invoker = true)` that projects the legacy PostgREST shape from the authoritative current pointer only.

Logical view definition:

```sql
create view public.document_extracted_findings
with (security_invoker = true)
as
select
  v.id,
  v.document_id,
  v.profile_id,
  v.modality,
  v.body_region,
  v.finding_text,
  v.impression,
  v.source_page,
  v.source_text,
  v.confidence,
  v.extraction_method,
  v.processing_version,
  v.extraction_model,
  'accepted'::text as status,
  v.created_at
from public.document_instrumental_current_publication cp
join public.document_extracted_finding_versions v
  on v.snapshot_content_id = cp.snapshot_content_id
 and v.document_id = cp.document_id
 and v.profile_id = cp.profile_id;
```

(`document_instrumental_current_publication` is the authoritative one-current pointer relation introduced by this change; exact table name may follow migration naming, but the join keys above are mandatory.)

Security, grants, and isolation:

- Underlying `document_extracted_finding_versions` keeps RLS enabled.
- The view uses `security_invoker = true`, so PostgREST/service callers do not inherit owner bypass; privileges and RLS of the invoker apply to the underlying tables.
- Grant `SELECT` on the view to `service_role` only. Revoke `INSERT`/`UPDATE`/`DELETE` on the view from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- Revoke direct DML on `document_extracted_finding_versions` from runtime roles; only prepare/finalize SECURITY DEFINER functions write versions.
- Profile isolation is enforced by `profile_id`/`document_id` equality through the current pointer. Service-role reads still MUST filter by the authenticated owner in application queries; pgTAP proves a cross-profile current pointer cannot surface another profile's findings through the view.
- PostgREST shape remains the existing resource name `document_extracted_findings` with the projected columns above. No new embed hint is required for current readers.

Old workers MUST NOT write through the compatibility view. Replacement workers write only through prepare/finalize RPCs into versioned storage.

### 8. Keep every document-level current projection equal to the current publication

At finalizer commit, these document columns MUST equal the authoritative current publication and MUST roll back with it:

| Document projection | Equality source on current publication |
| --- | --- |
| `document_summary` | publication-attempt summary text/hash |
| `observed_at` | immutable content study/observed date |
| `modality` | immutable content modality |
| `lab_name` | immutable content `facility_name` (null when content.facility_name is null) |
| `processing_version` | immutable content processing version |
| `extraction_model` | immutable content extraction model |

Additionally:

- legacy instrumental-measure `is_current` flags MUST equal the current pointer's content membership;
- `document_extracted_findings` view rows MUST equal the current content's findings;
- no prepared/superseded/abandoned child may appear in any of the above projections.

New readers cut over behind equivalence checks comparing pointer-backed reads to these projections. Compatibility projections and the old replacement RPC are removed only in a later gated cleanup after worker/reader inventory passes.

### 9. Backfill populated databases without inventing history

Preflight classifies every instrumental document by source hash, current-row cardinality, ownership, observation linkage, job state, attachable current findings/summary, and generation-0 attempt state.

- Existing measure groups become `legacy-v1` immutable content using the known v1 canonicalization contract.
- Existing current and superseded groups receive publication-history rows preserving observed state.
- Current document-level findings/impression/summary attach only to the uniquely identified current legacy publication.
- Missing historical findings remain explicitly unavailable; the migration does not synthesize them.
- Existing jobs/claims are quiesced; retained current state receives generation `0` and only provable attempt linkage.
- Ambiguous retained data aborts. Explicitly disposable environments may reset and reprocess through a separately guarded path.

### 10. Clean orphan preparations conservatively

Before durable deletion adds leases, cleanup may abandon a prepared publication only after its processing attempt is terminal and no finalizer can still own it. After the lease extension, lease expiry is additional evidence but never a substitute for deterministic lock/state validation. Cleanup never deletes immutable content referenced by current, superseded, or retained audit history. Repeated cleanup is idempotent.

## Risks / Trade-offs

- **[More rows for unchanged reprocessing]** → Publication history is intentionally separate from deduplicated content and provides the required audit trail.
- **[Worker and DB hashes diverge]** → DB is authoritative; golden fixtures and caller-hash rejection expose drift.
- **[Legacy findings cannot be assigned historically]** → Attach only provable current data and record the limitation instead of fabricating lineage.
- **[Old worker writes to the compatibility view]** → Pause/drain old workers before migration, revoke DML on the view/versioned table, and resume only the RPC-based worker.
- **[security_invoker view still leaks across profiles]** → Join through owner-scoped current pointer keys and add cross-profile negative tests for the view and PostgREST resource.
- **[Document projections drift from current publication]** → Finalizer updates summary/date/modality/lab_name/processing_version/extraction_model in the same transaction as the pointer; equivalence suite fails closed on drift.
- **[Attempt and deletion leases diverge]** → PR 2 owns the base attempt/generation schema; durable deletion only extends it.
- **[Deadlock with deletion/finalization/report/synthesis]** → All follow the same global DAG starting with documents.
- **[Generation increments twice on idempotent finalize retry]** → Only a commit that newly advances current publication increments; replay returns the committed result without a second bump.
- **[Prepared rows accumulate after crashes]** → Terminal-attempt cleanup abandons publications while retaining shared immutable content.
- **[`lab_name` drifts from content]** → `facility_name` is in canonical v2/hash; finalizer copies content.facility_name into `documents.lab_name`; golden fixtures cover null and non-null facility changes as content changes.
- **[Child attaches valid parent uuid under wrong profile/document]** → Composite ownership FKs reject the write; single-uuid parent FKs are not sufficient.
