## Why

PR #94 is mergeable but blocked by release-gate and database CI failures: the Registry 2.0 candidate approvals remain bound to a pre-EH-109 candidate hash despite unchanged 44/44 corpus outcomes, while the master claim and instrumental-publication RPCs contain unqualified column references that collide with PL/pgSQL `RETURNS TABLE` output names. The release evidence and additive database repair must be explicit and reproducible before merge.

## What Changes

- Renew the Registry 2.0 candidate release approval records against the EH-109 resolver v6 candidate-input hash only after confirming every threshold passes, all expected classifications match, and false concrete resolutions remain zero.
- Add an append-only Supabase migration that replaces `claim_document_processing_job(uuid)` and `prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text)` with the same contracts and lock order while qualifying ambiguous table columns.
- Add regression evidence proving the candidate release is launchable, both database RPCs execute without PL/pgSQL ambiguity, and the existing EH-105 ownership/atomicity contract remains intact.
- Push the repair through PR #94 and merge only after all required GitHub checks are green.

## Capabilities

### New Capabilities
- `release-gate-integrity`: Hash-bound Registry 2.0 release approvals may be renewed only for a fully verified candidate input and must make stale approvals fail closed.
- `document-processing-claim-integrity`: Document processing claim and publication-preparation RPCs use unambiguous qualified SQL while preserving their atomic ownership and lock-order contracts in the `documents` domain.

### Modified Capabilities

None. The existing resolver and alias requirements remain unchanged; this change repairs their release evidence and pre-existing database functions in `master`.

## Impact

- `registry/candidate-release/v1/approvals.json`: renewed hash-bound release, false-resolution, and score-affecting approval evidence.
- A new migration after migrations 036–037: additive `CREATE OR REPLACE FUNCTION` repairs for `claim_document_processing_job(uuid)` and `prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text)`.
- Candidate corpus, EH-105 database, registry verification, and PR #94 required checks.
- No resolver scoring, measurement identity, API, UI, or stored observation behavior changes.