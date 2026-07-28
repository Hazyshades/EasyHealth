## Context

EH-102 defines one pre-launch Registry 2.0 runtime, optional analyte/measurement identity, four resolver states, and append-only normalization decisions. The product has no production observation dataset requiring an additive legacy migration. EH-103 can therefore establish the correct provenance and revision-storage foundation before launch instead of carrying nullable compatibility behavior indefinitely.

EH-103 is the provenance and storage foundation. The observation identity/uniqueness cutover (EH-105), resolver-outcome vs verification-state semantics (EH-104), and privacy-safe decision explainability (EH-115) are owned by those changes. The assessment algorithm version is owned by the scoring change (EH-145 / `strict-system-score-readiness-2`).

## Goals / Non-Goals

**Goals:**

- Make every accepted result reconstructable from immutable raw evidence.
- Support resolved, ambiguous, partial, and unmapped observations without fabricated semantic keys.
- Snapshot only the processing releases that actually participated.
- Make reprocessing append-only and preserve earlier decisions.
- Prevent same-time or same-analyte source rows from overwriting distinct source results.
- Provide the storage foundation that later reprocessing (EH-116) and explainability (EH-115) build on.

**Non-Goals:**

- Preserve disposable development observations through the schema cutover.
- Remove the legacy `biomarker_key` persistence identity or legacy composite uniqueness constraints (EH-105).
- Guess missing raw values, units, specimens, methods, or versions.
- Persist assessment runs or change health-score formulas.
- Own resolver candidate explanation or PII redaction (EH-115).
- Own the assessment algorithm version (scoring change / EH-145).

## Decisions

### 1. Store a complete immutable observation snapshot

Each document-derived observation stores raw label, exact raw value text, nullable raw unit, raw reference text, source page/region/text linkage, extraction version, provenance schema version, source extraction id, resolution status, nullable analyte key, nullable measurement-definition key, and active normalization revision id.

The snapshot is intentionally denormalized from source extraction and revision rows so normal observation reads remain auditable even when later processing creates new rows.

### 2. Preserve raw value as text

`raw_value_text` retains thresholds, decimal commas, inequality signs, qualitative terms, and formatting independently of parsed numeric/qualitative fields. `raw_unit` is nullable because unitless qualitative results are valid.

### 3. Snapshot applicable releases without fabricating identity

Every accepted row stores extraction version. If the launch resolver ran, it stores the catalog manifest version and digest, resolver version, and normalization version even when the outcome is partial, ambiguous, or unmapped. A null measurement-definition key means no concrete identity was selected; it does not erase resolver provenance.

The **catalog manifest** is the launch catalog manifest owned by EH-102 (`catalog_manifest_version`, `catalog_manifest_digest`). Both fields refer to the same EH-102 launch catalog release; do not introduce a separate undefined `manifest_version` field, and do not treat `catalog version` and `catalog digest` as unrelated releases.

### 4. Make normalization revisions the append-only decision log

Each revision snapshots raw inputs, source extraction, resolver state, optional semantic identifiers, evidence, and release versions. The evidence hash includes raw value text and other identity-bearing input so distinct source results cannot collapse into one decision record.

### 5. Record source extraction identity as immutable lineage

`source_extracted_biomarker_id` is recorded on every accepted observation as immutable lineage/reference to its source extraction row. EH-103 does NOT declare the full identity/uniqueness cutover complete: the canonical acceptance idempotency key, removal of the legacy composite `(profile_id, biomarker_key, observed_at, specimen, modifier)` uniqueness, and the legacy `biomarker_key` removal are owned by EH-105.

Re-accepting the same source row is idempotent at the lineage level. A different source row never overwrites an observation merely because analyte, definition, or timestamp matches. Cross-document deduplication is a separate explicit workflow owned by later review, not by EH-103.

### 6. Enforce write-once provenance at the database boundary

Raw/source/version provenance cannot change in place. A new extraction or resolver decision creates a new source row and/or normalization revision. Application and database checks permit identical retries but reject mutation of populated provenance.

### 7. Use catalog manifest terminology linked to EH-102

Processing-release identifiers are: `extraction_version`, `catalog_manifest_version`, `catalog_manifest_digest`, `resolver_version`, `normalization_version`. The catalog manifest version/digest identify the EH-102 launch catalog release that participated. No bare `manifest_version` field is introduced; if only one manifest signal is needed, use `catalog_manifest_digest`.

### 8. Prefer a pre-launch schema addition

EH-103 adds the provenance foundation via a deterministic, clean-database migration. The legacy observation identity replacement and any development-data reset are owned by EH-105 and need not be performed by EH-103.

## Roadmap Ownership / Scope Boundary

- **EH-103** owns provenance and revision storage: immutable raw evidence, source document/page/location metadata, processing release identifiers, nullable analyte/measurement-definition links, append-only normalization revisions, write-once provenance, provenance schema version.
- **EH-105** owns identity, uniqueness and consumer cutover: legacy `biomarker_key` removal, legacy uniqueness-constraint removal, canonical source-id idempotency enforcement, API/consumer migration, clean-database cutover. EH-105 depends on EH-103 and uses its foundation; it does not re-add the same fields or tables.
- **EH-104** owns resolver-outcome vs verification-state semantics.
- **EH-115** owns privacy-safe decision explainability and candidate traces (accepted/rejected evidence, candidate scores, winning rule, missing-axis explanation, rejected candidates, PII redaction). EH-103 must not absorb explainability/redaction scope.

## Risks / Trade-offs

- [Schema cutover touches many readers] -> Coordinate EH-102 identity consumers and EH-103 provenance in the same pre-launch integration window; EH-105 performs the identity cutover.
- [Nullable semantic identity complicates consumers] -> Require each consumer to declare resolved-only, analyte-level, or raw-display behavior.
- [Snapshots duplicate source data] -> Use transactional writes and write-once enforcement; auditability is worth bounded duplication.
- [Source-row identity does not deduplicate equivalent results] -> Keep ingestion idempotency separate from later reviewed deduplication.
- [Assessment version can drift] -> Owned by the scoring change; EH-103 does not stamp observations with an assessment version.

## Migration Plan

1. Add the additive provenance foundation: source extraction lineage, resolution status, nullable analyte/measurement-definition links, active revision linkage.
2. Add required raw/provenance snapshots and append-only revision inputs.
3. Update all launch acceptance and reprocessing paths to write the same contract.
4. Add database write-once enforcement and source-id lineage.
5. Expose provenance and semantic status in document/observation APIs.
6. Assessment version output is owned by the scoring change, not EH-103.
7. Verify from a clean database plus the launch corpus.

Rollback before production is a coordinated development schema/code rollback or database reset. It does not reinstate a permanent legacy observation path.

## Open Questions

- Whether cross-document duplicate results should later be linked as equivalent observations or remain separate source facts.
- If persisted assessment runs are introduced later, their snapshot and retention policy require a separate change.
