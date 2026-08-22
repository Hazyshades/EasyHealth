## Context

The current upload route (`src/app/api/upload/route.ts`) writes the original object before inserting `documents`, but it does not persist a content fingerprint or compare the new row with existing profile-owned documents. The worker already computes a SHA-256 digest while reading the original file and derives explicit metadata such as document type, lab/provider, and medical date, but that digest is not persisted. The Documents hub and viewer have no duplicate-review surface, and the existing explicit document DELETE path is not an appropriate merge mechanism.

The repository uses Supabase migrations plus server-side service-role access after session authentication. Migration 036 already provides the `(documents.id, documents.profile_id)` ownership anchor, so duplicate candidates can enforce same-profile ownership with composite foreign keys. Existing timeline, Health Profile, report-context, and structured-context readers are the active projections that must stop presenting an archived duplicate as an active source.

## Goals / Non-Goals

**Goals:**

- Persist a lower-case SHA-256 fingerprint for every new upload and for worker reprocessing of legacy rows.
- Detect exact same-profile content matches and deterministic high-confidence metadata matches without comparing raw clinical text or using an opaque model.
- Store one canonical candidate per document pair, including match kind, score, reason codes, and review state.
- Let an authenticated owner explicitly keep both documents or archive exactly one candidate document.
- Make archive non-destructive: retain the original object, document row, derived rows, and audit evidence while excluding the archived row from active document/timeline/report/context projections.
- Make candidate resolution atomic, ownership-scoped, idempotent, and auditable.
- Provide focused verification for pure scoring, endpoint contracts, database ownership/candidate state, and the user-facing viewer flow.

**Non-Goals:**

- Perceptual image similarity, OCR-text similarity, semantic medical-event merging, or automatic selection of a canonical document.
- Cross-profile duplicate matching; a hash is only meaningful inside the owning profile's candidate set.
- Automatic archive or deletion based solely on a score.
- Hard deletion, storage cleanup, report rewriting, or migration of the separate durable document-deletion workflow.
- User-facing unarchive or bulk duplicate management; the decision surface is one pending candidate at a time.

## Decisions

### 1. Persist the upload/worker SHA-256 as the exact-match authority

Add nullable `documents.content_sha256` with a 64-hex check and a partial `(profile_id, content_sha256)` index. The upload route hashes the bytes it already materializes before storage/row creation. The worker includes the digest it already computes in the existing document completion payload, so reprocessing a legacy row upgrades detection without a second file read or a new hash authority.

A database trigger invokes duplicate detection after document insert and after updates to the hash or comparison metadata. This keeps detection in the same transaction as the metadata write and avoids a best-effort application call that could return a successful upload while silently missing an exact candidate.

**Alternatives considered:**

- Application-only comparison after upload: simpler, but a failed follow-up call leaves the upload successful and undetected; it also misses worker-discovered metadata.
- A unique hash constraint: rejected because identical medical files must remain separate until the owner chooses keep-both or archive.
- OCR/perceptual hashing: rejected for this roadmap item because it adds false-positive risk, model/version drift, and raw-content handling beyond the acceptance criteria.

### 2. Use deterministic metadata scoring for near candidates

`eh130_metadata_similarity` compares only same-profile document metadata:

- normalized filename: 0.30;
- file size: 0.25;
- MIME type: 0.15;
- document type: 0.15;
- explicit medical date: 0.10;
- normalized lab/provider name: 0.05.

A score of at least `0.70` creates a `metadata` candidate. A matching non-null SHA-256 creates an `exact` candidate regardless of metadata. Reason codes are ordered field identifiers (`file_hash`, `filename`, `file_size`, `mime_type`, `document_type`, `observed_at`, `lab_name`); no raw filename, hash, or clinical payload is copied into candidate or audit metadata. The TypeScript helper mirrors the formula for deterministic unit verification; the database function remains authoritative for persisted rows.

**Alternatives considered:**

- Filename-only matching: too many false positives for repeated exports such as `report.pdf`.
- A configurable/learned threshold: unnecessary variability for a P1 data-quality safety flow; a versioned constant is inspectable and testable.
- Comparing all profiles: violates tenant isolation and creates user-visible candidates for documents the owner cannot act on.

### 3. Canonical candidate rows and explicit state machine

Create `document_duplicate_candidates` with `left_document_id < right_document_id`, same `profile_id`, a unique pair constraint, `match_kind` (`exact` or `metadata`), bounded score, ordered reason codes, and states `pending`, `kept_both`, `archived_left`, and `archived_right`. Detection upserts match evidence while preserving any already-resolved state. A candidate is never auto-archived and is never a delete instruction.

The owner-scoped read helper loads pending candidates for the current document and joins only the two same-profile document summaries. The document bootstrap response includes `duplicate_candidates`, so the viewer does not need a second client-side race-prone fetch.

**Alternatives considered:**

- A boolean `is_duplicate` on `documents`: cannot represent a pair, the owner's choice, or an audit trail.
- Two directional rows per pair: doubles UI and resolution races; canonical UUID ordering makes retries and unique constraints deterministic.
- Storing raw metadata snapshots: duplicates PHI-adjacent filenames and creates stale copies; source document rows remain the display authority.

### 4. Resolve through one security-definer RPC and append-only audit events

Add `eh130_resolve_duplicate_candidate(p_candidate_id, p_profile_id, p_decision)` returning the resulting state and archived document id. The RPC locks the candidate, then the two documents in canonical order, verifies ownership, accepts only `keep_both`, `archive_left`, or `archive_right`, and updates the candidate plus the target document in one transaction. A repeated identical decision returns the stored result; a conflicting decision fails with a stable conflict error.

`documents.archived_at` and `archive_reason = 'duplicate_document'` are the safe archive marker. The RPC never calls a delete operation or Storage removal. `document_duplicate_audit_events` records a non-PHI `detected` event once per candidate and the owner's resolution action with candidate/document identifiers, decision, match kind, score, actor profile id, and timestamps. An append-only trigger rejects audit updates and deletes. Runtime roles receive only execute access to the RPC; table DML remains service-only.

**Alternatives considered:**

- Direct multi-request Supabase updates in the route: archive and candidate state can diverge on a crash or concurrent click.
- Reusing the existing document DELETE route: destructive, not reversible, and unable to prove the user's choice.
- A generic application log: not queryable as a durable domain audit and not protected by a database append-only guard.

### 5. Archive at active read boundaries, not by destructive cascade

`getOwnedDocument` excludes archived rows, so document detail, page/file/observation mutation routes and reprocessing do not reopen an archived source. The Documents hub, health timeline, Health Profile snapshot, report eligibility, structured context, and Biomarkers projection exclude archived source documents. The rows and Storage objects remain available to the separate retention/deletion lifecycle, and the decision response tells the UI which document was archived.

The viewer presents a compact inline review panel (no modal-first flow): match kind/score, the two filenames and explicit dates, a keep-both action, and archive actions with an inline confirmation explaining that the file is retained but removed from active views. Archive and keep-both buttons have loading, error, and resolved states; if the current document is archived, the viewer returns to Documents after the RPC succeeds.

**Alternatives considered:**

- Keep archived rows in every projection: safe storage retention but leaves duplicate events in active health views.
- Hard-delete only derived rows: risks losing evidence and conflicts with the no-silent-deletion acceptance criterion.
- A modal dialog: adds a second focus/escape path for a small, reversible decision; inline progressive confirmation fits the existing viewer vocabulary.

### 6. Verification contracts

Add `src/lib/documents/duplicate-detection.ts` for pure filename normalization, weighted metadata scoring, decision/state labels, and response types. Add a focused `scripts/verify-eh130-duplicate-documents.ts` that exercises exact-vs-metadata scoring, threshold boundaries, reason order, decision validation, and source-contract assertions for upload, worker completion, active filters, API resolution, and viewer controls. Add `supabase/tests/eh130_duplicate_document_detection.sql` plus `test:eh130-db` using synthetic profiles/documents to verify canonical uniqueness, cross-profile isolation, candidate creation, keep-both, safe archive, append-only audit, and idempotent resolution.

## Risks / Trade-offs

- **False positives from common filenames:** require a multi-field score threshold, label the result as a candidate, and never auto-archive; the owner can keep both.
- **Metadata arrives after upload:** the trigger reruns on worker completion metadata, so an initially unmatched upload can become a pending candidate without another user action.
- **Large profiles make trigger comparison expensive:** the indexed exact-hash path is cheap, while metadata comparison currently scans one profile's document metadata; this is acceptable for the roadmap scope and can later move to a normalized metadata index.
- **Concurrent detection/resolution:** the unique canonical pair and RPC row/document locks make duplicate candidates converge; a concurrent resolution either replays the same decision or returns a stable conflict.
- **Archived derived rows remain stored:** active readers filter at the source-document boundary, while the separate deletion/retention work remains responsible for physical cleanup.
- **Legacy documents without hashes remain undetected until reprocessing:** no Storage-wide backfill is attempted because it would require unbounded object reads; the worker persists a hash whenever a legacy document is processed again.
- **Existing API clients do not know the new bootstrap field:** `duplicate_candidates` is additive, and resolution uses a new route; existing upload and document responses remain valid.
