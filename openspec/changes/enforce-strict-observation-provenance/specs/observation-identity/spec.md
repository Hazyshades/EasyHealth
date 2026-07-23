## ADDED Requirements

### Requirement: Observation ownership, kind, and source identity are immutable

`profile_id`, `document_id`, and `observation_kind` MUST be immutable for every observation. `source_extracted_biomarker_id` MUST be present and immutable for laboratory observations while `source_instrumental_measure_id` is null. `source_instrumental_measure_id` MUST be present and immutable for instrumental observations while `source_extracted_biomarker_id` is null. Any additional observation kind MUST have an explicit database-enforced source policy. A source change requires a new source/observation lifecycle.

#### Scenario: Laboratory source is replaced

- **WHEN** runtime code attempts to change, clear, or fill `source_extracted_biomarker_id`
- **THEN** the database rejects the mutation
- **AND** the only deletion exception is direct row deletion by the durable finalizer

#### Scenario: Instrumental source is replaced

- **WHEN** runtime code attempts to change, clear, or fill `source_instrumental_measure_id`
- **THEN** the database rejects the mutation

#### Scenario: Observation is reassigned

- **WHEN** runtime code attempts to change profile, document, or observation kind
- **THEN** the database rejects the mutation

### Requirement: Active normalization projection remains separately mutable

`normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status` SHALL remain outside identity/provenance immutability but may be changed only by the constrained projection writer after locking and validating the observation, owner/source, expected state, and authoritative same-source revision.

#### Scenario: Strict provenance is deployed

- **WHEN** the EH-106 writer creates or updates the active projection through the constrained function
- **THEN** the four projection columns may change consistently
- **AND** no ownership, source identity, raw evidence, or version provenance changes

#### Scenario: Caller supplies arbitrary projection values

- **WHEN** a caller attempts direct table update or a writer payload not derived from authoritative revision state
- **THEN** permission or validation rejects it

### Requirement: Writer authority is database-enforced

Runtime roles SHALL have no direct insert/update/delete privilege on observations. Source-specific creation, constrained projection, and durable final deletion functions SHALL each validate owner/source/version state and SHALL NOT expose arbitrary observation-column mutation.

#### Scenario: Compromised service client attempts identity mutation

- **WHEN** service role issues direct SQL/PostgREST update against `observations`
- **THEN** the database denies the operation before trigger policy becomes the only defense

#### Scenario: Writer function receives cross-owner source

- **WHEN** a service-only writer is called with observation and source/revision rows from different profile or document ownership
- **THEN** the function rejects the call atomically

### Requirement: Strict provenance ships after durable deletion

Strict identity enforcement MUST be deployed only after document deletion no longer clears `document_id` or source/revision columns on surviving observations. The strict change MUST remove the temporary purge GUC and lineage-nulling path.

#### Scenario: Deployment preflight finds legacy purge caller

- **WHEN** application, worker, route, or database function still calls the old purge RPC or sets its GUC
- **THEN** strict rollout aborts

#### Scenario: Durable deletion later removes a document

- **WHEN** all callers use tombstone cleanup and transactional final purge
- **THEN** direct row deletion removes observations without mutating immutable identity
- **AND** no provenance bypass exists
