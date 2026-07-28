## Why

EH-104 Phase A and EH-106 left the durable integrity rules staged but unenforced: actor/cross-axis guards, same-source `MATCH FULL`, append-only revisions, controlled purge, and legacy promotion RPC removal still wait on a populated-data preflight gate. Without Phase B, incomplete or half-linked rows can still be written outside the v2 path, and document delete can leave inconsistent lineage. Sprint 1 data integrity is not closed until those invariants are live.

## What Changes

- Run the existing read-only populated-data preflight as a hard Phase B release gate and record the abort-or-disposable-reset decision. **No automatic semantic repair.**
- **BREAKING (database writers):** Attach INSERT/UPDATE actor and verified-cross-axis guards on `observation_normalization_revisions`, including the trusted reviewed-maturity check for verified definitions.
- **BREAKING (database writers):** Add the final four-value `resolver_result` constraint on pre-acceptance extracted biomarker rows after preflight is clean.
- **BREAKING (database writers):** Replace the standalone observation→revision FK with the composite same-source relation and `MATCH FULL`, rejecting half-linked laboratory observations.
- Make normalization revisions append-only for ordinary runtime writers; reject direct revision deletes.
- Add a service-only controlled purge primitive that atomically nulls both observation lineage columns before deleting document-derived extracted lineage, and route document delete through it.
- **BREAKING:** Drop `promote_observation_normalization_revision` (legacy) after verifying every acceptance/correction path uses v2 only.
- Extend `pnpm test:eh104-db` / Phase B pgTAP coverage for guard attachment, composite lineage, purge, preflight abort, disposable reset, and legacy-RPC absence.
- Update QA checklist and issue #4 delivery evidence for Phase B completion; leave scoring eligibility and incomplete UX to EH-112/EH-120.

## Capabilities

### New Capabilities

- `observation-resolution-verification`: Durable Phase B database contract for resolver/verification separation—guards, same-source lineage, append-only revisions, controlled purge, preflight gate, and legacy-RPC removal. (Capability was specified only inside the EH-104 change delta; this change promotes the enforceable Phase B surface into the main-spec set.)

### Modified Capabilities

- `documents-api`: Document delete MUST clear laboratory observation lineage as a full null pair through the controlled purge path before removing document-derived extracted rows; it MUST NOT leave half-linked observations.
- `document-extraction-review`: Acceptance/correction remain on the EH-106 v2 writer only; legacy promotion RPC is unavailable after Phase B.
- `observation-identity`: Laboratory source/revision identity becomes a full same-source pair under `MATCH FULL`; half-linked laboratory rows are rejected. Instrumental lineage from EH-105 remains exclusive and unchanged.

## Impact

- **Domain:** documents (observation lineage, delete/purge), health-profile consumers unchanged for scoring eligibility.
- **Database:** new Phase B migration(s) after `033_eh106_*`; triggers, constraints, composite FK, purge RPC, drop legacy promote RPC.
- **API/runtime:** `DELETE /api/documents/:id` and any admin/service document cleanup path; static ban that no caller references the legacy promote RPC.
- **Ops:** `preflight:eh104` becomes a required gate before applying enforcement in non-disposable environments; disposable reset remains explicit and guarded.
- **Verification:** Phase B pgTAP + writer static checks + QA/eh-104 checklist update; CI `test:eh104-db` after `supabase db reset`.
- **Dependencies already satisfied:** EH-104 Phase A (`031`), EH-105 instrumental lineage (`032`), EH-106 v2 writers (`033` + runtime cutover).
- **Explicit non-goals:** EH-112 incomplete DTO/UX; EH-120 rejection workflow / batch idempotency; EH-107 CBC fixtures; scoring filter changes.
