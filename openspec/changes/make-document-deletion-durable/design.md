## Context

The current owner DELETE route runs a database lineage purge, performs unverified object-storage removals, then deletes the document. PostgreSQL and Supabase Storage cannot share one transaction, and an active worker can upload previews/OCR after cleanup has listed or removed objects. A durable design therefore needs a database tombstone, an authoritative retry queue, writer fencing, and proof of storage absence before final database purge.

Current signed URLs have a 900-second TTL. Once issued they are not individually revocable by the application; deletion of the underlying object or TTL expiry ends access.

Deletion also crosses database domains. `reports.content` and `summary_preview` can contain source PHI while `reports.document_ids = NULL` loses the actual historical source set. `profile_health_synthesis.synthesis_text` can retain deleted-document content. Observations and extraction rows remain physically present during asynchronous storage cleanup and therefore require tombstone-aware read boundaries.

Atomic instrumental publication precedes this change and owns `documents.write_generation` plus retained `document_processing_attempts`. `write_generation` is a **content epoch**: PR 2 increments it on every successful finalizer commit that advances the current publication (including republish/reprocess/`A → B → A`); this change also increments it on tombstone. Idempotent finalizer replay of an already-committed attempt does not increment again. Deletion extends those primitives; it does not replace them or invent a second generation field.

## Goals / Non-Goals

**Goals:**

- Return `202 Accepted` only after a durable tombstone and deletion operation exist.
- Prevent direct and cross-domain access after tombstone.
- Fence already-running lease-aware workers with leases plus a constrained app upload broker instead of unrestricted service-role Storage uploads.
- Replace the impossible “DB RPC returns a Storage signed upload URL” contract with an app-ticket + late-exchange broker that respects Supabase’s fixed ~2h `createSignedUploadUrl` TTL.
- Make initial owner upload document-row/intent-first with orphan recovery, not object-before-row.
- Purge every generation-0 and future storage path with pagination and stable-empty verification.
- Define atomic report/synthesis writers, exact retention behavior, and allowlisted non-PHI ai_invocations policy.
- Enforce one global lock DAG shared by deletion, publication finalization, and report/synthesis writers: documents (sorted UUID) → jobs/attempts/intents/publication → profile_health_synthesis → reports → deletion receipt.
- Treat `write_generation` as a content epoch: advanced by successful current-publication finalize/republish/reprocess (PR 2) and by tombstone (this change).
- Retain an owner-queryable, non-PHI operation receipt after document hard purge.

**Non-Goals:**

- Claim object storage participates in a PostgreSQL transaction.
- Claim PostgreSQL can mint Supabase Storage signed upload URLs or override Storage’s fixed ~2h upload-URL TTL.
- Promise that a previously issued signed download URL is synchronously revoked before its object is removed.
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

### 3. Extend the shared attempt model with leases and an app upload broker

A worker claim continues to create the PR 2 `document_processing_attempts` row and additionally receives a random lease token, expiry, and heartbeat obligation bound to the captured generation. Every database mutation validates `(processing_attempt_id, lease_token, write_generation, not deleting)`.

#### 3.1 Why a broker exists

PostgreSQL SECURITY DEFINER functions cannot mint Supabase Storage signed upload URLs. Supabase JS `createSignedUploadUrl()` has a **fixed ~2 hour TTL** and does not accept `expiresIn`. Therefore this change MUST NOT require “DB RPC returns a short-TTL Storage signed upload URL.”

Chosen architecture:

1. **Database** owns fencing and path authority only.
2. **App upload broker** (Next.js API route or Edge Function in the existing app trust boundary) owns the Storage secret and capability minting.
3. **Short-lived one-time app tickets** provide the application TTL fence.
4. **Late exchange** mints the Storage signed upload URL only immediately before bytes are sent.

Rejected alternatives:

- Worker-local signer: keeps Storage create credentials on every worker and weakens least privilege.
- Accept bare 2h Storage URLs as the fence: forces deletion `waiting_for_writers` ≥ 2h after every capability.
- Always proxy bytes through the broker: workable, but unnecessary if late exchange keeps Storage URL minting inside the broker and consumes the app ticket first.

#### 3.2 Exact upload capability flow

Direct service-role Storage object creation is removed from document workers and from owner `/api/upload`. Object creation uses this sequence only:

```
caller (worker or owner upload)
        │
        ▼
DB RPC register_storage_write_intent
  - locks document/attempt (worker) or creates/locks document row (initial upload)
  - rejects tombstoned/cancelled/expired/stale generation
  - server-generates exact bucket/path/content-type
  - inserts intent row: pending, intent_id, path, generation, deadline
  - returns intent_id + path metadata only (NO Storage URL)
        │
        ▼
App broker POST /api/storage/upload-ticket (name may follow repo convention)
  - authenticates owner session OR worker attempt/lease token
  - revalidates intent fence via DB
  - issues one-time app ticket TTL ≤ min(intent deadline, 120s)
  - binds ticket to intent_id, bucket, path, content-type, generation, caller
        │
        ▼
App broker POST /api/storage/upload-exchange
  - consumes app ticket exactly once
  - revalidates intent still pending/active/non-tombstoned
  - only then calls Storage createSignedUploadUrl for the exact registered path
  - returns the Storage upload URL for immediate use
        │
        ▼
caller uploads bytes to Storage URL
        │
        ▼
DB RPC complete_storage_write_intent
  - verifies object presence at registered path
  - re-checks fence
  - marks intent completed
```

Rules:

- The DB never returns a Storage signed upload URL.
- The app ticket is the short-TTL, one-time capability. Ticket reuse/expiry fails closed.
- The Storage signed upload URL is an implementation detail of late exchange. Fence and deletion quiescence are keyed off intent state, app-ticket expiry/consumption, and a bounded post-exchange upload window (≤ intent deadline), **not** off Storage’s residual 2h URL lifetime.
- If exchange succeeds but completion fails, the registered path is remove-best-effort and remains recoverable by deletion/orphan cleanup.
- Cleanup listing/removal uses a separate service-only storage maintenance path that cannot create objects outside registered deletion inventories.

#### 3.3 Initial owner upload is document/intent-first

Current `/api/upload` uploads the object, then inserts the document row. If insert fails, Storage retains an orphan outside deletion inventory.

Required lifecycle:

1. Authenticate owner and validate file metadata.
2. Allocate `document_id` and create the document row (or an equivalent durable pre-upload reservation) in generation `0` with server-chosen original path, without claiming the object already exists.
3. Register a storage-write intent for that exact original path.
4. Mint app ticket → late-exchange → upload through the broker.
5. Complete the intent only after object presence verification.
6. Enqueue processing only after intent completion.
7. On any failure before completion: mark document/upload failed or delete the incomplete document reservation, and enqueue orphan cleanup for the registered path.

An orphan sweeper MUST periodically:

- remove Storage objects for expired/failed intents whose completion never happened;
- remove or finalize incomplete document reservations with no completed original-object intent;
- ignore completed intents and active non-expired tickets still inside their bounded window.

#### 3.4 Writer quiescence after tombstone

Tombstone prevents new intents and app-ticket minting/exchange. Cleanup cannot pass `waiting_for_writers` until:

- every prior-generation processing lease is released or expired;
- every registered write intent is completed, failed/terminal, or takeover-eligible;
- every unexpired app ticket for the document/generation is expired or consumed;
- the bounded post-exchange upload window after the last consumed ticket has elapsed;
- no compatible worker can still publish through a valid finalizer token.

This fences already-running lease-aware workers without waiting a blanket 2 hours for every Storage URL. Rollout must pause and drain old workers/routes that still call `storage.upload` with the service key before the tombstone API is enabled.

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

**Global lock DAG (mandatory for every writer in this change and PR 2):**

1. source `documents` in sorted UUID order;
2. jobs / processing attempts / storage intents in id order when touched;
3. publication pointer / content children in id order when touched;
4. `profile_health_synthesis` for the profile when touched;
5. `reports` rows / report contention keys when touched;
6. deletion operation / receipt when touched.

Writer contract:

1. Accept owner/profile, requested scope, exact non-null `source_document_ids`, per-document `write_generation` snapshot captured before LLM work, title/type/detail flags, and generated content/summary.
2. Lock only in the global DAG: every source document (sorted UUID), then `profile_health_synthesis` if contended, then the report write keys. Never lock synthesis or reports before documents.
3. At commit, revalidate each source id is owned, active/not deleting, and still at the captured write generation; reject if any source was tombstoned **or** advanced to a newer content epoch by successful republish/reprocess/finalize during LLM latency.
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
2. Lock only in the global DAG: every source document in sorted UUID order, then the `profile_health_synthesis` row. Never lock synthesis before documents.
3. At commit, revalidate each source is owned, active/not deleting, and still at the captured write generation; reject if tombstone or content-epoch drift (successful republish/reprocess/finalize) occurred during LLM latency.
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

After stable-empty verification, one final transaction locks in the global DAG:

1. document;
2. jobs, processing attempts/leases, and write intents in id order;
3. prepared/current publication pointer and history in id order;
4. `profile_health_synthesis` when present;
5. invalidated reports and other derived rows in deterministic table/id order;
6. observations, normalization/extraction/audit rows in deterministic table/id order;
7. deletion operation / retained independent receipt;
8. document hard delete last among PHI rows, then receipt completion.

It revalidates generation, tombstone state, no live writers, and storage-verification evidence; then hard-purges derived rows and the document and marks the independent operation receipt completed. Failure rolls back the database purge and leaves the operation retryable.

The final purge deletes observations directly before the document, so `observations.document_id ON DELETE SET NULL` never mutates immutable identity. Cutover removes the legacy lineage-nulling purge and `easyhealth.purge_lineage` authority. Strict provenance is deployed only afterward.

### 10. Preserve idempotency across crashes

Repeated owner DELETE returns the same operation. Cleanup claims are leased. Each storage removal treats not-found as success; every listing is paginated. Each transition is guarded by expected prior state/generation. A retry after any failure resumes from authoritative database state and repeats verification.

## Risks / Trade-offs

- **[Previously issued URL remains temporarily valid]** → Bound exposure by the existing 900-second TTL and start object removal immediately; do not report completion early.
- **[Storage upload finishes after a first empty listing]** → Registered intents, quiescence, generation prefixes, and repeated stable-empty listings prevent final completion.
- **[Legacy worker/route ignores fences]** → Pause/drain old workers and `/api/upload` before enabling the new DELETE contract; revoke service-role Storage create/upload from worker runtime credentials; force all object creation through the broker.
- **[App ticket or exchanged Storage URL is stolen or reused]** → One-time short-TTL app ticket; exchange consumes it; completion RPC rejects path/generation mismatch; orphan sweeper removes incomplete registered paths.
- **[Storage URL still valid ~2h after exchange]** → Do not key quiescence on Storage TTL; key it on ticket consumption + bounded post-exchange window + intent completion/failure; treat late objects via registered-path cleanup and stable-empty verification.
- **[Initial upload fails after document reservation]** → Document/intent-first lifecycle plus orphan sweeper removes reservation and registered object; processing is not enqueued until intent completion.
- **[Report/synthesis LLM finishes after tombstone]** → DB writers revalidate sorted document locks and write generations at commit and reject the persist.
- **[ai_invocations stores error.message PHI]** → Allowlisted codes only; CI grep and logger tests forbid raw message persistence.
- **[Source-unknown reports are over-invalidated]** → Prefer privacy-safe deletion to retaining narrative that may contain deleted-document PHI.
- **[Cross-domain reader misses tombstone filtering]** → Inventory and test every service-role consumer before enabling the route.
- **[Observability metadata later gains payload fields]** → Retention preflight fails closed and final purge includes those rows.
- **[Operation receipt retains PHI]** → Store identifiers/state/digests only; prohibit filename, extracted text, raw path, or clinical payload.
- **[Deletion and finalization deadlock]** → Every writer follows the same global DAG: documents (sorted) → jobs/attempts/intents/publication → synthesis → reports → deletion receipt.
- **[Report/synthesis miss a republish during LLM latency]** → Content-epoch `write_generation` advances on successful finalize/republish/reprocess as well as tombstone; commit-time generation revalidation rejects the stale persist.

## Open Questions

- Exact Next.js route vs Edge Function hosting for the broker endpoints (same-process Next API is acceptable if secrets stay server-only).
- Whether initial-upload document reservation is the final `documents` row in a pre-ready state or a separate reservation table that promotes on intent completion. Prefer the final `documents` row if existing status machine can represent “upload pending.”
