## ADDED Requirements

### Requirement: Observation kind selects its document source lineage

Every new document-derived observation SHALL declare `observation_kind` as `lab` or `instrumental`. A laboratory observation SHALL use the laboratory extraction lineage established by EH-103 and EH-104. An instrumental observation SHALL use exactly one instrumental source measure lineage and SHALL not be represented as a laboratory normalization candidate or definition-bound result. EH-105 SHALL not introduce a standalone observation kind.

#### Scenario: Laboratory source lineage remains available

- **WHEN** a laboratory extraction row is accepted
- **THEN** the observation uses `source_extracted_biomarker_id` according to the EH-103/EH-104 lifecycle
- **AND** EH-105 does not substitute an instrumental source ID

#### Scenario: Instrumental source lineage is selected

- **WHEN** an instrumental numeric measure is materialized
- **THEN** the observation has `observation_kind = 'instrumental'` and `source_instrumental_measure_id`
- **AND** it has no laboratory extraction or normalization-revision lineage

## MODIFIED Requirements

### Requirement: Expanded uniqueness constraint

The system SHALL enforce observation idempotency by immutable source identity, not by a legacy biomarker key, observed date, specimen, or modifier. A laboratory observation SHALL be unique for a non-null `source_extracted_biomarker_id`; an instrumental observation SHALL be unique for a non-null `source_instrumental_measure_id`. Semantic Registry 2.0 links remain nullable and SHALL NOT be used to collapse distinct source occurrences.

#### Scenario: Serum and urine same semantic key same day

- **WHEN** two accepted laboratory source rows share a semantic label and date but have distinct source extraction identities
- **THEN** both observations are stored without uniqueness conflict

#### Scenario: Repeated instrumental occurrence

- **WHEN** two instrumental source occurrences share the same displayed name, generated key, and study date
- **THEN** both observations are stored when their instrumental source IDs differ
- **AND** neither is collapsed by a key/date uniqueness rule

#### Scenario: True source retry still upserts

- **WHEN** a writer replays the same laboratory or instrumental source identity
- **THEN** the system reuses or upserts the existing observation for that source
- **AND** does not create a duplicate observation

### Requirement: Health profile latest-by identity

Health profile laboratory aggregation SHALL select only `observation_kind = 'lab'` observations and SHALL not use a legacy biomarker key as its persistence identity. Distinct laboratory source rows retain their identities even when their semantic links or dates coincide. Instrumental rows are outside laboratory latest-value, readiness, and score aggregation until EH-106 defines their complete consumer behavior.

#### Scenario: Latest laboratory identities are aggregated

- **WHEN** multiple laboratory observations are available for a profile
- **THEN** the laboratory aggregation selects its current values without reading a removed biomarker-key column
- **AND** it does not silently overwrite distinct source rows solely because a legacy key would collide

### Requirement: Migration of existing rows

The system SHALL establish the Registry 2.0 observation identity contract through a clean-database migration and development reset. It SHALL not synthesize source lineage from legacy biomarker keys or promise a production compatibility/backfill contract for retained invalid instrumental observations.

#### Scenario: Existing development rows are reset

- **WHEN** a disposable development environment contains instrumental observations without the new source lineage
- **THEN** the documented reset removes the disposable document-derived data before reprocessing
- **AND** the resulting observations use source identity without a synthetic legacy key

