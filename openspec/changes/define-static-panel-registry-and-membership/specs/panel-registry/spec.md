## ADDED Requirements

### Requirement: Registry 2.0 SHALL publish static panel definitions
The system SHALL publish immutable, versioned Registry 2.0 panel definitions for `cbc`, `lipid`, `thyroid`, `liver`, `kidney`, and `iron_studies`. Each panel definition SHALL have a stable key, canonical display name, zero or more alternate names, and a deterministic ordered member collection.

#### Scenario: The six roadmap panels are available
- **WHEN** a consumer lists Registry 2.0 panel definitions
- **THEN** it receives exactly one definition for each of `cbc`, `lipid`, `thyroid`, `liver`, `kidney`, and `iron_studies`
- **AND** each definition has a stable key and canonical display name
- **AND** every published panel has at least one member

#### Scenario: Alternate names remain catalog metadata
- **WHEN** a consumer reads a panel definition with alternate names
- **THEN** it receives the canonical name and declared alternate names
- **AND** no document heading is classified, persisted, or used as clinical evidence solely because it equals an alternate name

### Requirement: Panel membership SHALL reference reviewed concrete definitions
Each panel member SHALL reference one existing, reviewed Registry 2.0 `MeasurementDefinitionKey`. Each member SHALL declare exactly one membership role, `required` or `optional`, and a positive, unique display order within its panel.

#### Scenario: A curated member is returned in deterministic order
- **WHEN** a consumer reads a panel's members
- **THEN** each returned member references an existing reviewed concrete measurement definition
- **AND** members are ordered by ascending display order
- **AND** each member declares either `required` or `optional`, but not both

#### Scenario: Invalid membership is rejected by registry validation
- **WHEN** panel data contains a missing or non-reviewed definition key, duplicate member key, non-positive display order, or duplicate display order within one panel
- **THEN** registry validation SHALL fail
- **AND** the invalid registry SHALL NOT be released

### Requirement: Membership SHALL be many-to-many without assessment side effects
A reviewed concrete measurement definition MAY belong to more than one panel. Panel membership SHALL be independent from measurement resolution, specimen evidence, assessment binding, score role, score readiness, contribution groups, and Health Profile eligibility.

#### Scenario: One concrete definition belongs to multiple panels
- **WHEN** an approved concrete measurement definition is curated as a member of two panels
- **THEN** querying each panel returns that same definition key
- **AND** no duplicate measurement definition is created

#### Scenario: Adding membership cannot change clinical interpretation
- **WHEN** a panel membership is added, removed, or reordered while the measurement catalog and resolver input remain otherwise unchanged
- **THEN** measurement resolution output remains unchanged
- **AND** assessment binding, score role, readiness groups, contribution groups, and Health Profile eligibility remain unchanged
- **AND** membership does not supply a specimen or select a concrete identity

### Requirement: The panel registry SHALL be release-governed
The canonical Registry 2.0 manifest SHALL serialize panel definitions and their deterministic member projection. A panel-registry change SHALL change the manifest digest and candidate-input hash, and stale approvals SHALL not satisfy the release gate.

#### Scenario: A panel membership edit invalidates release evidence
- **WHEN** a panel's metadata, member role, member key, or display order changes
- **THEN** the canonical manifest digest and candidate-input hash change
- **AND** approvals bound to the previous hash SHALL NOT make the candidate release launchable

#### Scenario: Equivalent ordering serializes deterministically
- **WHEN** the same valid panel definitions are supplied in different source-array orders
- **THEN** their canonical panel manifest serialization and digest are identical

### Requirement: Iron studies SHALL use Registry 2.0 identities
The `iron_studies` panel SHALL contain only approved, reviewed concrete Registry 2.0 iron-study measurement definitions. Registry v1 iron records MAY provide migration evidence but SHALL NOT be used as panel-member keys, runtime aliases, or a runtime fallback.

#### Scenario: Reviewed iron definitions support the panel
- **WHEN** the iron-studies panel is published
- **THEN** every member resolves to a reviewed Registry 2.0 concrete definition
- **AND** no member references a Registry v1 key
- **AND** the panel is non-empty

### Requirement: Panel data SHALL have reproducible verification and documentation
The system SHALL provide deterministic fixtures and validation for the curated roster, many-to-many membership, member roles, ordering, release-manifest coverage, and assessment independence. Canonical generated biomarker documentation SHALL describe the released panel registry.

#### Scenario: Documentation and fixtures match the released registry
- **WHEN** the panel registry release verification runs
- **THEN** all panel fixtures and validation pass
- **AND** generated canonical documentation reflects the same panel keys, names, members, roles, and order as the runtime registry
- **AND** stale generated documentation fails verification.