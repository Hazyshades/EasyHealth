## ADDED Requirements

### Requirement: Observation identity does not require a resolved measurement

An observation SHALL use its own stable identifier and source extraction linkage as persistence identity. `analyte_key` and `measurement_definition_key` SHALL be nullable semantic links governed by `resolution_status`; the system MUST NOT require a legacy biomarker key or raw-text-derived synthetic key to store a valid raw result.

#### Scenario: Raw unmapped observation is stored

- **WHEN** a user accepts an extracted result with no catalog match
- **THEN** the observation is persisted with raw provenance and `resolution_status = unmapped`
- **AND** both semantic identity links remain null

#### Scenario: Concrete result is resolved

- **WHEN** one reviewed concrete definition is selected
- **THEN** both analyte and measurement-definition links are stored
- **AND** downstream definition-specific consumers use the measurement-definition link

### Requirement: Downstream consumers declare semantic requirements

Trends, assessment, reports, and structured retrieval SHALL explicitly decide whether they require a resolved definition, accept analyte-level partial data, or display raw data only. Unresolved rows MUST NOT silently enter consumers requiring concrete identity.

#### Scenario: Assessment receives a partial row

- **WHEN** an accepted observation has partial resolution and no reviewed assessment binding
- **THEN** assessment excludes it from scoring and readiness coverage
- **AND** the observation remains available in document review and raw history
