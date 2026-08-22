## Why

EasyHealth currently accepts every upload as an independent document, so an identical report can create duplicate review work and duplicate timeline inputs without an explicit, auditable decision. EH-130 needs a profile-scoped duplicate workflow now: detect exact content matches and high-confidence metadata matches, then let the owner keep both medical events or safely archive one without deleting either file.

## What Changes

- Add a `duplicate-document-detection` capability in the `documents` domain.
- Compute and persist a SHA-256 hash for every new original upload, and backfill the hash when a worker reprocesses a legacy document.
- Compare same-profile documents using exact file hashes plus deterministic metadata similarity (normalized filename, size, MIME type, document type, explicit medical date, and provider/lab when available).
- Persist one canonical duplicate-candidate row per document pair with match kind, score, reason codes, and an explicit review state; never delete or silently suppress a document when a candidate is created.
- Expose pending candidates in the document viewer and provide owner choices to keep both documents or archive exactly one document.
- Implement archive as a reversible-safe lifecycle marker that retains the original file and all audit evidence; archived documents leave active document/timeline/context projections and cannot be processed as active inputs.
- Resolve a candidate and its archive/keep-both decision transactionally through a service-only database function, with idempotent replay and append-only audit events containing only document/candidate identifiers, decision codes, and timestamps.
- Add focused unit-style verification for hash/metadata scoring and route contracts plus a synthetic database contract test for pair canonicalization, candidate states, safe archive, ownership isolation, and audit capture.
- Add the EH-130 tester checklist with synthetic/de-identified data and explicit developer evidence for database and concurrency guarantees.

## Capabilities

### New Capabilities

- `duplicate-document-detection`: Profile-scoped exact/near duplicate detection, pending candidate review, explicit keep/archive decisions, safe archive visibility rules, and non-PHI audit events.

### Modified Capabilities

- None. The current flat `openspec/specs/` set contains no document upload/viewer capability specification; this change introduces the new documents-domain capability rather than silently modifying an unrelated registry or timeline spec.
