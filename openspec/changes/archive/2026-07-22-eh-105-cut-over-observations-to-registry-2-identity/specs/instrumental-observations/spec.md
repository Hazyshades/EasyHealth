## ADDED Requirements

### Requirement: Active instrumental paths contain no legacy observation-key operation

Active instrumental writers, readers, and maintenance tooling SHALL NOT select, insert, update, filter, or upsert `biomarker_key` on the `observations` table. The repository SHALL run a scoped static check over active application, worker, and script paths that distinguishes observation-table access from raw extraction fields and historical migrations.

#### Scenario: Legacy alias script is invoked after cutover

- **WHEN** a developer invokes the former observation alias-backfill utility
- **THEN** the utility fails fast with a retirement/migration message or is unavailable
- **AND** it does not issue an `observations.biomarker_key` query

## MODIFIED Requirements

### Requirement: Instrumental numeric measures promoted to observations

When instrumental extraction returns `numeric_measures`, the worker SHALL materialize immutable instrumental source records and corresponding `observations` through the service-only materialization path. Each resulting observation SHALL have `observation_kind = 'instrumental'`, a source-instrumental-measure link, and a source document; it SHALL not use a normalized `biomarker_key` as identity.

#### Scenario: Ejection fraction from echocardiogram

- **WHEN** an instrumental report extraction includes a numeric measure "Ejection Fraction" with value 55 and unit "%"
- **THEN** a source record and one linked observation are created with `observation_kind = 'instrumental'`
- **AND** the observation is linked to the source document through its instrumental source record

#### Scenario: No numeric measures

- **WHEN** instrumental extraction returns no numeric measures
- **THEN** no instrumental source record or observation is created from that document

### Requirement: Instrumental observations auto-accepted

Instrumental measure observations SHALL be materialized without a user review step after the source snapshot is validated. Their automatic materialization SHALL NOT cause them to enter laboratory assessment, readiness, unit-conversion, or laboratory biomarker payloads.

#### Scenario: Immediate typed availability

- **WHEN** instrumental processing completes with numeric measures
- **THEN** current typed instrumental observations are available to authorized document readers without an accept action
- **AND** they are excluded from laboratory assessment inputs

### Requirement: Deduplication of instrumental observations

The system SHALL make instrumental observation idempotency depend on `source_instrumental_measure_id`. It SHALL treat a model-generated measure key, profile/date tuple, and source document alone as insufficient identity. Reprocessing SHALL use source snapshot supersession rather than delete prior observations before replacement succeeds.

#### Scenario: Reprocess replaces measures safely

- **WHEN** a user reprocesses an instrumental document
- **THEN** the system atomically materializes the new source snapshot before superseding the prior current source records
- **AND** duplicate-looking source occurrences remain distinct

## REMOVED Requirements

### Requirement: Health Profile distinguishes instrumental sources

**Reason**: EH-105 establishes a safety boundary that excludes instrumental records from laboratory Health Profile aggregation; full instrumental display and UI wording are owned by EH-106 rather than this schema cutover.

**Migration**: Document observation readers expose explicit `observation_kind` now. EH-106 will introduce and validate the complete typed Health Profile/UI presentation contract.

