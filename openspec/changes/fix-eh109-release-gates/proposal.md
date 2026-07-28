## Why

PR #94 is mergeable but blocked by two independently verified CI failures: the Registry 2.0 candidate release approvals remain bound to the pre-EH-109 candidate hash despite unchanged 44/44 corpus outcomes, and the master processing-attempt claim RPC contains an ambiguous unqualified `document_id` reference. The release evidence and additive database repair must be explicit and reproducible before merge.

## What Changes

- Renew the Registry 2.0 candidate release approval records against the EH-109 resolver v6 candidate-input hash only after confirming every threshold passes, all expected classifications match, and false concrete resolutions remain zero.
- Add an append-only Supabase migration that replaces `claim_document_processing_job(uuid)` with the same contract and lock order while qualifying processing-attempt column references.
- Add regression evidence proving the candidate release is launchable, the database claim RPC no longer raises PL/pgSQL ambiguity, and the existing EH-105 ownership/atomicity contract remains intact.
- Push the repair through PR #94 and merge only after all required GitHub checks are green.

## Capabilities

### New Capabilities
- `release-gate-integrity`: Hash-bound Registry 2.0 release approvals may be renewed only for a fully verified candidate input and must make stale approvals fail closed.
- `document-processing-claim-integrity`: Document processing claims use unambiguous qualified SQL while preserving the existing atomic claim, ownership, and lock-order contract in the `documents` domain.

### Modified Capabilities

None. The existing resolver and alias requirements remain unchanged; this change repairs their release evidence and a pre-existing database function in `master`.

## Impact

- `registry/candidate-release/v1/approvals.json`: renewed hash-bound release, false-resolution, and score-affecting approval evidence.
- A new migration after `036_pr2_document_processing_attempts.sql`: additive `CREATE OR REPLACE FUNCTION` repair for `claim_document_processing_job(uuid)`.
- Candidate corpus, EH-105 database, registry verification, and PR #94 required checks.
- No resolver scoring, measurement identity, API, UI, or stored observation behavior changes.