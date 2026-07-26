## Context

The current owner DELETE route runs a database lineage purge, performs unverified object-storage removals, then deletes the document. PostgreSQL and Supabase Storage cannot share one transaction, and an active worker can upload previews/OCR after cleanup has listed or removed objects. A durable design therefore needs a database tombstone, an authoritative retry queue, writer fencing, and proof of storage absence before final database purge.

Current signed URLs have a 900-second TTL. Once issued they are not individually revocable by the application; deletion of the underlying object or TTL expiry ends access.

Deletion also crosses database domains. `reports.content` and `summary_preview` can contain source PHI while `reports.document_ids = NULL` loses the actual historical source set. `profile_health_synthesis.synthesis_text` can retain deleted-document content. Observations and extraction rows remain physically present during asynchronous storage cleanup and therefore require tombstone-aware read boundaries.

Atomic instrumental publication precedes this change and owns `documents.write_generation` plus retained `document_processing_attempts`. Deletion extends those primitives; it does not replace them.

## Goals / Non-Goals

**Goals:**

- Return `202 Accepted` only after a durable tombstone and deletion operation exist.
- Prevent direct and cross-domain access after tombstone.
- Fence already-running lease-aware workers with leases plus constrained signed upload capabilities instead of unrestricted service-role Storage uploads.
- Purge every generation-0 and future storage path with pagination and stable-empty verification.
- Define atomic report/synthesis writers, exact retention behavior, and allowlisted non-PHI ai_invocations policy.
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

### 3. Extend the shared attempt model with leases and a constrained upload capability

A worker claim continues to create the PR 2 `document_processing_attempts` row and additionally receives a random lease token, expiry, and heartbeat obligation bound to the captured generation. Every database mutation validates `(processing_attempt_id, lease_token, write_generation, not deleting)`.

Direct service-role Storage upload is removed from document workers. Upload capability is minted only after a storage-write intent is registered:

1. Worker calls a fixed-search-path SECURITY DEFINER RPC with attempt id, lease token, generation, and operation kind.
2. The RPC locks the document/attempt, rejects tombstoned/cancelled/expired/stale generations, server-generates the exact generation-scoped object path, inserts the intent (`pending`), and returns a **one-time signed upload capability** bound to that exact bucket/path/content-type and a short TTL ≤ the intent deadline.
3. The worker uploads only through that signed capability. It never uses the unrestricted service-role key for object creation.
4. After upload, the worker calls a completion RPC that verifies object presence at the registered path, re-checks the fence, and marks the intent `completed`. Fence failure triggers immediate remove-best-effort and leaves the intent recoverable by deletion cleanup.

A stale, expired, cancelled, or prior-generation worker cannot mint a capability and cannot upload an unregistered path even if it still holds an old service credential for DB access. Cleanup listing/removal uses a separate service-only storage maintenance path that cannot create objects outside registered deletion inventories.

Tombstone prevents new intents and capability minting. Cleanup cannot pass `waiting_for_writers` until:

- every prior-generation processing lease is released or expired;
- every registered write intent is completed or takeover-eligible;
- the maximum bounded storage request duration has elapsed after the last unresolved intent/lease;
- no compatible worker can still publish through a valid finalizer token;
- no unexpired signed upload capability remains for the document/generation.

This fences already-running lease-aware workers. Rollout must pause and drain old workers that still call `storage.upload` with the service key before the tombstone API is enabled.

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

### 5. Persist reports only through an atomic DB-guarded writer

New reports MUST be inserted only by a fixed-search-path SECURITY DEFINER writer (for example `persist_owner_report`). Direct `INSERT`/`UPDATE`/`DELETE` on `public.reports` are revoked from `service_role`, `authenticated`, `anon`, and `PUBLIC`.

Writer contract:

1. Accept owner/profile, requested scope, exact non-null `source_document_ids`, per-document `write_generation` snapshot captured before LLM work, title/type/detail flags, and generated content/summary.
2. Lock every source document row in sorted UUID order, then lock the profile synthesis/report contention keys needed for the write.
3. At commit, revalidate each source id is owned, active/not deleting, and still at the captured write generation; reject if any source was tombstoned or republished under a new generation.
4. Persist both requested scope and the exact `source_document_ids` used to generate `content`/`summary_preview`.
5. Existing reports with explicit `document_ids` backfill that exact source set. Existing `document_ids = NULL` reports are marked `source_scope_known = false` rather than assigned invented sources.

At tombstone:

- every report whose exact source set contains the document becomes inaccessible and is marked for purge;
- every source-unknown legacy report for that profile is conservatively invalidated because it may contain the deleted document;
- a multi-document report is invalidated as a whole; its generated text is never rewritten by removing an id;
- report list/detail APIs exclude invalidated rows.

The final database transaction deletes those invalidated report rows. Deletion-versus-report-generation races are covered by two-session tests that tombstone between context load and persist.

### 6. Persist holistic synthesis through an atomic DB-guarded writer and invalidate on tombstone

`profile_health_synthesis` upserts MUST go only through a fixed-search-path SECURITY DEFINER writer (for example `persist_profile_health_synthesis`). Direct table DML is revoked from runtime roles.

Writer contract:

1. Accept profile id, exact sorted `source_document_ids`, per-document write generations captured before LLM work, input hash, model metadata, and synthesis text.
2. Lock the synthesis row and every source document in sorted UUID order.
3. At commit, revalidate each source is owned, active/not deleting, and still at the captured write generation; reject if tombstone or generation drift occurred during LLM latency.
4. Upsert only after those checks pass.

The tombstone transaction removes or invalidates `profile_health_synthesis` for the profile. Regeneration uses only active documents; a cached synthesis containing the deleting document is never served. Deletion-versus-synthesis races are covered by two-session tests that tombstone between context load and upsert.

Biomarkers and Health Profile exclude document-derived observations whose document is deleting. Report generation and structured context resolve only active eligible document ids and current publication content. Document list/detail/file/page/thumbnail/reprocess/mutation APIs deny the tombstoned document. These filters are required even though service-role reads bypass RLS.

### 7. Define non-PHI observability retention and ai_invocations policy

`ai_invocations.error_code` MUST store only an allowlisted non-PHI code (`timeout`, `rate_limited`, `provider_unavailable`, `provider_error`, `schema_validation_failed`, `context_too_large`, `cancelled`, `unknown_error`). Runtime MUST NEVER persist `error.message`, filenames, prompts, responses, raw paths, or clinical text in `error_code` or any other `ai_invocations` column.

Document-linked invocations retain provider/model/stage/token/latency/success metadata and are purged or FK-cleared only after populated preflight proves the table contains no payload fields. If payload fields exist, those rows are part of final purge.

Profile-level report/synthesis invocations historically written with `document_id IS NULL` cannot prove exclusion of a deleted document. Policy:

- new multi-document stages MUST persist an exact `source_document_ids uuid[]` (or equivalent non-null linkage) before relying on selective retention;
- until that linkage exists, tombstone conservatively deletes profile-level `ai_invocations` rows for report/synthesis stages for that profile, or redacts them according to the same non-PHI fail-closed preflight;
- document-scoped stages with a matching `document_id` are purged with the document.

`measurement_resolution_shadow_events.context` and every extraction/revision/audit child tied to the document are purged through explicit deletion or verified cascades. The retained deletion receipt contains no filename, storage path, extracted data, clinical value, or generated narrative.

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
- **[Legacy worker ignores fences]** → Pause/drain it during rollout before enabling the new DELETE contract; revoke service-role Storage create/upload from worker runtime credentials.
- **[Signed upload capability is stolen or reused]** → One-time path-bound TTL token minted only for a registered intent; completion RPC rejects path/generation mismatch.
- **[Report/synthesis LLM finishes after tombstone]** → DB writers revalidate sorted document locks and write generations at commit and reject the persist.
- **[ai_invocations stores error.message PHI]** → Allowlisted codes only; CI grep and logger tests forbid raw message persistence.
- **[Source-unknown reports are over-invalidated]** → Prefer privacy-safe deletion to retaining narrative that may contain deleted-document PHI.
- **[Cross-domain reader misses tombstone filtering]** → Inventory and test every service-role consumer before enabling the route.
- **[Observability metadata later gains payload fields]** → Retention preflight fails closed and final purge includes those rows.
- **[Operation receipt retains PHI]** → Store identifiers/state/digests only; prohibit filename, extracted text, raw path, or clinical payload.
- **[Deletion and finalization deadlock]** → Both lock document first and use the shared order.
