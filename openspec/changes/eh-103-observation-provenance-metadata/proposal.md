## Why

EH-102 now targets a pre-launch Registry 2.0 hard cutover. Observations may be concretely resolved, partially recognized, ambiguous, or unmapped, but every accepted result must remain auditable and reprocessable from exact raw evidence. The previous EH-103 proposal optimized for nullable legacy reads and dual legacy/shadow/promote paths that are no longer part of the launch architecture.

EH-103 defines the complete observation provenance and revision-storage foundation for the new observation model from its first production release. The observation identity/uniqueness cutover and consumer migration are owned by EH-105; resolver-outcome vs verification-state semantics are owned by EH-104; privacy-safe decision explainability is owned by EH-115.

## What Changes

- Store immutable raw label, exact raw value text, nullable raw unit, raw reference text, source location, extraction version, and provenance schema version for every accepted document-derived observation.
- Store resolution status plus nullable analyte and measurement-definition identity as an additive link; the legacy `biomarker_key` identity removal and uniqueness cutover are owned by EH-105.
- Snapshot the catalog manifest version and digest, resolver version, and normalization version that actually participated; partial and unmapped rows retain applicable resolver lineage without fabricated concrete identity. The catalog manifest belongs to the EH-102 launch catalog.
- Extend append-only normalization revisions with exact raw inputs and include raw value text in evidence hashing.
- Record source extraction identity as immutable lineage and prevent a semantic upsert from overwriting distinct raw results; EH-105 establishes source extraction identity as the canonical acceptance idempotency key.
- Make provenance write-once from the first launch schema; no nullable historical compatibility contract or speculative backfill is required.
- Permit a pre-production migration that adds the provenance foundation; the legacy identity replacement and any development-data reset are owned by EH-105.

## Capabilities

### New Capabilities

- `observation-provenance-metadata`: Complete immutable raw, semantic-resolution linkage, and processing-version lineage for launch observations and normalization revisions.

### Modified Capabilities

- `extraction-provenance`: Acceptance copies exact raw value, unit, reference text, and source location.
- `observation-identity`: Source extraction identity is recorded as immutable lineage with nullable semantic links; the final identity/uniqueness cutover remains with EH-105.

## Impact

- Database: additive launch observation provenance foundation; required raw fields where source data exists; nullable semantic links and naturally nullable raw unit.
- Documents: extraction, bulk acceptance, manual review, and reprocessing populate one provenance contract for all resolver states.
- APIs: observation/document payloads expose raw evidence, resolution status, semantic links, and version snapshots.
- No production legacy-row compatibility, legacy/shadow acceptance branch, or historical backfill is required.
- The assessment algorithm version contract is owned by the scoring change (EH-145 / `strict-system-score-readiness-2`), not EH-103.

## Scope Boundary

- EH-103 owns: immutable raw evidence, source document/page/location metadata, processing release identifiers, nullable analyte/measurement-definition links, append-only normalization revisions, write-once provenance, provenance schema version, and the storage foundation for reprocessing/explainability.
- EH-105 owns: legacy `biomarker_key` identity removal, legacy uniqueness-constraint removal, canonical source-id idempotency enforcement, API/consumer migration, and clean-database cutover.
- EH-104 owns: resolver-outcome vs verification-state semantics.
- EH-115 owns: privacy-safe decision explainability and candidate traces.

## Out of Scope

- Legacy identity removal → EH-105.
- Resolver candidate explanation and PII redaction → EH-115.
- Scoring algorithm version → scoring cluster / EH-145 (`strict-system-score-readiness-2`).
