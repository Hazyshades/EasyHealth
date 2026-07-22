## ADDED Requirements

### Requirement: Every accepted observation retains exact raw evidence

Every accepted document-derived observation SHALL retain immutable raw label, exact raw value text, nullable raw unit, raw reference text when present, source extraction id, and source location/evidence linkage. Raw value text SHALL preserve qualifiers, locale formatting, and qualitative values independently from parsed fields.

#### Scenario: Qualified numeric value is accepted

- **WHEN** CRP is printed as `< 0.20 mg/L`
- **THEN** the observation stores the exact raw value and unit
- **AND** parsed normalized fields may independently represent the threshold

#### Scenario: Unitless qualitative value is accepted

- **WHEN** a qualitative ELISA result is `Negative` with no printed unit
- **THEN** the observation stores `Negative` and a null raw unit
- **AND** the provenance snapshot is complete for the available source

### Requirement: Provenance supports every resolver state

Every accepted observation SHALL store resolution status and applicable extraction version, catalog manifest version and digest, resolver version, and normalization version. The catalog manifest identifies the EH-102 launch catalog release that participated; no bare `manifest_version` field is introduced. Analyte and measurement-definition links SHALL be nullable. Partial, ambiguous, or unmapped results MUST NOT receive fabricated concrete identifiers, and their resolver provenance MUST NOT be discarded merely because resolution was incomplete.

#### Scenario: Partial ALT is accepted

- **WHEN** ALT is recognized but specimen evidence is missing
- **THEN** the observation stores partial status, supported analyte identity, raw evidence, and resolver release metadata
- **AND** measurement-definition identity remains null

#### Scenario: Unmapped result is accepted

- **WHEN** no catalog record matches a result
- **THEN** the observation stores unmapped status, raw evidence, and applicable processing versions
- **AND** both semantic identity links remain null

### Requirement: Normalization revisions snapshot decision inputs

Every append-only normalization revision SHALL retain raw inputs, source extraction linkage, resolver state, optional semantic identifiers, evidence, and release versions. Its evidence hash SHALL include raw value text and other identity-bearing inputs.

#### Scenario: Reprocessing changes a mapping

- **WHEN** a later catalog release recognizes a previously unmapped row
- **THEN** a new revision records the new decision and release versions
- **AND** the prior revision and raw source evidence remain unchanged

### Requirement: Source extraction identity is recorded as immutable lineage

Document-derived acceptance SHALL record source extraction identity as immutable lineage. Repeating acceptance for the same source row MAY return or update the same observation projection, but a different source row MUST NOT overwrite it solely because semantic identity and time are equal. The canonical acceptance idempotency key and legacy identity removal are owned by EH-105.

#### Scenario: Same source row is accepted twice

- **WHEN** the same extracted row is accepted again with identical provenance
- **THEN** the operation is idempotent
- **AND** write-once provenance remains unchanged

#### Scenario: Two reports contain the same measurement and time

- **WHEN** distinct source rows share analyte, measurement definition, and observed time
- **THEN** one source result does not silently overwrite the other
- **AND** later deduplication remains an explicit auditable action

### Requirement: Observation provenance is write-once

Raw evidence, source identity, and processing-version snapshots SHALL be immutable after creation. Equal retries are valid; a different source or processing snapshot requires a new observation or append-only revision.

#### Scenario: Provenance mutation is attempted

- **WHEN** a write tries to replace an observation's raw value or extraction version
- **THEN** database and application validation reject the mutation
- **AND** instruct the caller to create a new source/revision path

### Requirement: The launch schema has no legacy-read contract

The pre-launch provenance foundation MAY be added and MAY reset disposable development data. A clean database migration and current API contract MUST pass; compatibility with nonexistent production legacy rows is not a release requirement.

#### Scenario: Clean launch database is created

- **WHEN** all migrations run from an empty database
- **THEN** observations require the launch provenance contract and support nullable semantic identity
- **AND** no legacy fallback columns or acceptance branch are required

### Requirement: Privacy-safe decision explainability is owned by EH-115

EH-103 SHALL NOT own resolver candidate explanation, accepted/rejected evidence explanation, candidate scores, winning-rule explanation, missing-axis explanation, or PII redaction. Those are owned by EH-115. EH-103 provides the immutable raw inputs, revision snapshots, version/digest provenance, and evidence hash that EH-115 consumes.

#### Scenario: Explainability is requested

- **WHEN** a user or support engineer needs to understand why a row resolved or remained incomplete
- **THEN** the explanation is served by EH-115 from the EH-103 revision/storage foundation
- **AND** EH-103 does not duplicate explanation or redaction logic
