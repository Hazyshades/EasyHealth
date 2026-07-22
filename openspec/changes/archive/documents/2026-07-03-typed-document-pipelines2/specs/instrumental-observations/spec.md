## ADDED Requirements

### Requirement: Instrumental numeric measures promoted to observations

When instrumental extraction returns `numeric_measures`, the worker SHALL insert corresponding rows into `observations` for charting on the Health Profile.

#### Scenario: Ejection fraction from echocardiogram

- **WHEN** an instrumental report extraction includes a numeric measure "Ejection Fraction" with value 55 and unit "%"
- **THEN** an observation row is created with normalized `biomarker_key` ejection_fraction
- **AND** `observation_kind` is `instrumental`
- **AND** the observation is linked to the source document

#### Scenario: No numeric measures

- **WHEN** instrumental extraction returns no numeric measures
- **THEN** no instrumental observation rows are created from that document

### Requirement: Instrumental observations auto-accepted

Instrumental measure observations SHALL be written without a user review step.

#### Scenario: Immediate chart availability

- **WHEN** instrumental processing completes with numeric measures
- **THEN** observations are available on the next Health Profile load without accept action

### Requirement: Deduplication of instrumental observations

The system SHALL upsert instrumental observations by `profile_id`, `biomarker_key`, `observed_at`, and source document id to avoid duplicates on reprocess.

#### Scenario: Reprocess replaces measures

- **WHEN** a user reprocesses an instrumental document
- **THEN** prior instrumental observations from that document are replaced with newly extracted measures

### Requirement: Health Profile distinguishes instrumental sources

The Health Profile SHALL indicate when charted values originate from instrumental or functional studies rather than laboratory tests.

#### Scenario: Instrumental source label

- **WHEN** a biomarker card or drawer entry is backed by an observation with `observation_kind` instrumental
- **THEN** the UI shows an English label such as "From imaging/functional study"
