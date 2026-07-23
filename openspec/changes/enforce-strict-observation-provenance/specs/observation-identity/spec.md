## ADDED Requirements

### Requirement: Observation ownership, kind, and source identity are immutable

`profile_id`, `document_id`, and `observation_kind` MUST be immutable for every observation. `source_extracted_biomarker_id` MUST be immutable for laboratory observations and `source_instrumental_measure_id` MUST be immutable for instrumental observations. A source change requires a new source/observation path.

#### Scenario: Laboratory source is replaced

- **WHEN** runtime code attempts to change or clear `source_extracted_biomarker_id`
- **THEN** the database rejects the mutation except for the temporary exact controlled-purge transition

#### Scenario: Instrumental source is replaced

- **WHEN** runtime code attempts to change or clear `source_instrumental_measure_id`
- **THEN** the database rejects the mutation

#### Scenario: Observation is reassigned

- **WHEN** runtime code attempts to change profile, document, or observation kind
- **THEN** the database rejects the mutation

### Requirement: Active normalization projection remains separately mutable

`normalization_revision_id`, `measurement_definition_key`, `analyte_key`, and `resolution_status` SHALL remain mutable only through the EH-104/EH-106 atomic projection writer, while immutable ownership/source provenance remains unchanged and same-source constraints pass.

#### Scenario: Valid active revision changes

- **WHEN** the authorized atomic writer promotes a new same-source revision
- **THEN** it may update the active projection fields in one transaction
- **AND** no immutable source/provenance field changes

#### Scenario: Projection update attempts source reattachment

- **WHEN** a projection write also changes the extracted source or document ownership
- **THEN** the transaction is rejected

### Requirement: Temporary purge authorization is not caller forgeable

The laboratory lineage-clearing exception MUST NOT trust a caller-settable GUC or generic service-role mutation context. Any interim authorization MUST be private, transaction/backend/operation/row/transition scoped, inaccessible to runtime roles, and usable only by the exact controlled document purge operation.

#### Scenario: Caller sets the historical purge GUC

- **WHEN** service-role code sets `easyhealth.purge_lineage=on` and directly updates protected lineage
- **THEN** the trigger rejects the update because the GUC has no authority

#### Scenario: Caller fabricates private authorization

- **WHEN** service, authenticated, or anonymous code attempts to insert/read private authorization or invoke arbitrary-field mutation
- **THEN** permission is denied

#### Scenario: Exact controlled purge runs during transition

- **WHEN** the controlled purge locks one document and authorizes the exact paired lineage-clearing transition for its expected rows
- **THEN** only those before/after digests are accepted
- **AND** every other protected-field change is rejected

### Requirement: Temporary purge authorization has an explicit retirement owner

The strict-provenance change MUST mark the private lineage-clearing authorization and legacy purge as temporary, document that durable deletion owns their removal, and expose no reusable runtime provenance-mutation API. Strict-provenance implementation and deployment do not depend on durable deletion being complete.

#### Scenario: Strict provenance ships before durable deletion

- **WHEN** strict provenance is deployed while the existing document purge still requires paired lineage clearing
- **THEN** only the private exact controlled transition remains available
- **AND** the durable-deletion change carries the removal task and Sprint 1 closure remains blocked until removal is evidenced

#### Scenario: Durable deletion later cuts over

- **WHEN** all document deletion callers use tombstone cleanup and transactional final purge
- **THEN** durable deletion removes the temporary authorization objects and lineage-nulling path
- **AND** strict provenance has no runtime bypass
