## ADDED Requirements

### Requirement: Instrumental numeric measures have immutable source occurrences

The system SHALL persist each extracted instrumental numeric measure in `document_extracted_instrumental_measures` before it is represented as an observation. Each source row SHALL have an immutable ID, document and profile ownership, raw/display measure data, value and unit, study date when available, extraction metadata, source location/context when available, and a required occurrence discriminator. A model-generated measure key SHALL be retained only as raw evidence or a display hint and SHALL NOT be the row's persistence identity.

#### Scenario: Repeated measures share a generated key

- **WHEN** one instrumental report contains two numeric occurrences with the same normalized key, such as separate left and right measurements
- **THEN** the system stores two distinct source rows with distinct source occurrence discriminators
- **AND** neither row overwrites or suppresses the other

#### Scenario: Numeric extraction lacks page evidence

- **WHEN** a numeric measure has no page or text snippet from the extractor
- **THEN** the extraction/worker provides a deterministic document-snapshot locator and occurrence discriminator
- **OR** rejects the measure as invalid source input

### Requirement: Instrumental observations use instrumental source identity

Every newly materialized instrumental observation SHALL have `observation_kind = 'instrumental'` and a non-null `source_instrumental_measure_id`. The source row SHALL belong to the same document and profile as the observation. An instrumental observation SHALL NOT carry `source_extracted_biomarker_id`, `normalization_revision_id`, `analyte_key`, or `measurement_definition_key` in EH-105.

#### Scenario: Instrumental measure is materialized

- **WHEN** an echocardiogram extraction returns an ejection-fraction numeric measure
- **THEN** the worker materializes one instrumental source row and one observation linked by `source_instrumental_measure_id`
- **AND** the observation does not require or store a legacy biomarker key

#### Scenario: Cross-profile source is supplied

- **WHEN** a service writer attempts to link an observation to an instrumental source row from another profile or document
- **THEN** the materialization transaction is rejected
- **AND** no observation or source current-state change is committed

### Requirement: Instrumental reprocessing is snapshot-safe and idempotent

The system SHALL treat a canonical extraction snapshot plus source locator and occurrence discriminator as the idempotency input for instrumental materialization. Replaying an unchanged snapshot SHALL reuse its source records and linked observations. A changed snapshot SHALL materialize new source evidence and mark the former current source records superseded only after the replacement observations have been committed. Default current readers SHALL not return superseded instrumental source records.

#### Scenario: Worker retries an unchanged extraction

- **WHEN** a worker retries the same instrumental extraction snapshot after an uncertain response
- **THEN** the system returns the existing source records and observations without creating duplicates
- **AND** the current source set remains unchanged

#### Scenario: Reprocess changes one source measure

- **WHEN** a reprocess produces a changed instrumental measurement set for a document
- **THEN** the new source rows and observations are committed before the previous current source rows are marked superseded
- **AND** the prior source evidence remains auditable

### Requirement: Instrumental materialization is service-only and atomic

The system SHALL materialize an instrumental extraction snapshot through a transaction-owning RPC available only to `service_role`. The RPC SHALL validate document type, job, profile ownership, measure validity, and duplicate occurrences; it SHALL create/reuse source rows and observations before changing current/superseded state. `PUBLIC`, `anon`, and `authenticated` SHALL not execute the RPC.

#### Scenario: Replacement write fails

- **WHEN** any source or observation write in an instrumental materialization fails
- **THEN** the transaction rolls back
- **AND** the prior current instrumental source set remains current
- **AND** no partial replacement observation is visible

#### Scenario: Browser client invokes materialization RPC

- **WHEN** an `anon` or `authenticated` client calls the instrumental materialization RPC
- **THEN** PostgreSQL denies execution

### Requirement: Clean reset does not fabricate legacy instrumental lineage

The clean-database migration and development reset path SHALL create instrumental observations only through the new source lineage. It SHALL NOT derive source IDs from a removed observation biomarker key or fabricate a Registry 2.0 laboratory identity for an instrumental row.

#### Scenario: Clean database is reset and reprocessed

- **WHEN** a disposable development database is reset and an instrumental report is processed
- **THEN** every resulting instrumental observation has a valid instrumental source ID
- **AND** no resulting row depends on `observations.biomarker_key`

