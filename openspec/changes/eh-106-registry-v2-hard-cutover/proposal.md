## Why

EH-104 Phase A provides a service-only V2 compare-and-swap promotion primitive, but the acceptance and manual-review writers still make multiple independent writes and call the legacy promotion RPC. That leaves accepted incomplete rows without an authoritative active revision, permits partial failure between revision, observation, and extracted-row updates, and blocks EH-104 Phase B lineage enforcement and legacy-RPC removal.

EasyHealth also needs a bounded proof that the Registry 2.0 runtime can replace Registry v1 before launch. The current 44-row fixture list and declared manifest fixture do not yet define expected outcomes, immutable approval evidence, or CI enforcement. This change closes the hard-cutover gap without taking ownership of later resolver expansion, public batch workflow, or final score/readiness policy.

## What Changes

- Add a service-only, per-row database transaction for laboratory acceptance, manual correction, and undo. It creates the revision, synchronizes the extracted snapshot, upserts the source-identified observation, activates the revision through V2 CAS, and records extracted acceptance status as one commit-or-rollback unit.
- Replace every acceptance/correction/undo use of the legacy promotion RPC with that transactional writer. A raw accepted `partial`, `ambiguous`, or `unmapped` result creates an active `pending` revision; it is authoritative for the accepted observation while retaining null concrete identity where appropriate.
- Keep `POST /api/documents/:id/biomarkers/accept` as a per-row `ids[]` operation, returning stable result codes for each requested row and allowing the viewer to distinguish complete from partial success. `PATCH /api/documents/:id/biomarkers` remains a single-row correction/undo operation. Durable idempotency resources, batch jobs, rejection workflow, and automatic-verification activation remain EH-120.
- Move remaining runtime readers to Registry 2.0 observation identity and reviewed assessment bindings: document-observations DTOs, biomarker presentation/trends, structured context, reports, conversion, and Health Profile. This change does not define final system-score/readiness semantics owned by EH-141 through EH-147.
- Remove Registry v1 runtime adapters, fallback/compatibility paths, feature flags, and dual-read/shadow telemetry; retain the frozen Registry v1 snapshot solely for migration/audit tooling. Correct the registry CI workflow so its push gate protects the repository default branch.
- Establish the minimum hard-cutover candidate-release gate: expected outcomes for the committed 44-row corpus and existing negative cases; a non-mutating run; raw-preservation, false-concrete-resolution, and assessment-impact checks; an immutable versioned approval artifact; and CI rejection of missing or unapproved release evidence.
- Record explicit handoffs: EH-107 through EH-116 expand fixtures, resolver policy, UX, metrics, decision traces, and reprocessing; EH-120 owns durable public batch/retry and automatic-verification workflow; EH-141 through EH-147 own final score/readiness rules and their golden gate.

**BREAKING**: successful acceptance changes from an opaque `acceptedIds` response to a per-row result contract, and no runtime Registry v1 fallback remains available after the cutover.

## Capabilities

### New Capabilities

- `registry-v2-write-path`: Atomic, service-only acceptance, correction, undo, V2 activation, retry, and per-row result behavior for Registry 2.0 observations.
- `registry-v2-consumer-cutover`: Runtime consumer rules that use active Registry 2.0 revisions and reviewed bindings without taking ownership of final score/readiness policy.

### Modified Capabilities

- `measurement-registry-governance`: Define the minimum hard-cutover corpus contract, versioned approval artifact, thresholds, and CI gate while delegating corpus expansion to later roadmap items.
- `document-extraction-review`: Surface complete or partial selected-row acceptance results and preserve raw incomplete acceptance as a first-class review outcome.
- `documents-api`: Expose active-revision resolver and verification dimensions from the authoritative observation lineage.
- `biomarkers-overview`: Use Registry 2.0 measurement identity for safe presentation and definition-specific trends.
- `health-profile-api`: Consume resolved reviewed Registry 2.0 assessment bindings while leaving final verification/readiness semantics to later roadmap work.

## Impact

- **Database:** a new transactional service-role writer/RPC; EH-104 V2 promotion integration; later Phase B preflight, composite lineage enforcement, and legacy-RPC removal.
- **API/UI:** `POST /api/documents/:id/biomarkers/accept`, `PATCH /api/documents/:id/biomarkers`, document observations, biomarkers overview, and review feedback.
- **Runtime consumers:** structured context, reports, unit conversion, Health Profile, trends, and Registry v1 import/fallback checks.
- **Release engineering:** committed candidate manifest/report/approval artifacts, CI checks (including the default branch), and clean/disposable database verification inherited from EH-105 and EH-104 Phase B.
- **Roadmap boundaries:** consumes EH-102–105 foundations; hands off future resolver/corpus/reprocessing work to EH-107–116, public workflow to EH-120, and final score readiness to EH-141–147.
