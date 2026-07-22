## ADDED Requirements

### Requirement: Runtime measurement identity is independent from Registry v1

The system SHALL use Registry 2.0 analyte and measurement-definition identifiers as its only runtime laboratory semantic identity. Registry v1 keys MUST NOT be required by application reads, writes, resolver decisions, trends, reports, or assessment after the pre-launch cutover.

#### Scenario: New observation is resolved after cutover

- **WHEN** an extracted result resolves to one reviewed measurement definition
- **THEN** the observation stores its analyte and measurement-definition identifiers
- **AND** no legacy canonical biomarker key is required to persist or consume the result

#### Scenario: Runtime attempts to load the frozen catalog

- **WHEN** an application runtime module imports the Registry v1 audit fixture
- **THEN** CI or registry validation fails
- **AND** the fixture remains available only to migration and regression tooling

### Requirement: Analytes and measurements have explicit reviewed identity

Every measurement definition SHALL reference a registered analyte and SHALL declare specimen, property, scale, timing, method, value kind, unit policy, aliases, lifecycle, maturity, and assessment behavior. Unknown information SHALL be represented explicitly and MUST NOT behave as positive compatibility evidence.

#### Scenario: Absolute and percentage differential measurements differ

- **WHEN** absolute and percentage neutrophil definitions are loaded
- **THEN** they share the neutrophil analyte
- **AND** remain distinct measurement identities with compatible value kinds and unit families

#### Scenario: Specimen is unknown

- **WHEN** a source does not state specimen and available context cannot prove it
- **THEN** the resolver does not select a serum, plasma, whole-blood, or urine definition solely from prevalence
- **AND** reports the missing specimen in structured evidence

### Requirement: Catalog maturity controls resolver and assessment behavior

Every definition SHALL have maturity `provisional`, `reviewed`, or `retired`. Only a reviewed active definition MAY be selected as a resolved concrete measurement. A provisional definition MAY support recognition and review but MUST NOT authorize automatic concrete resolution or assessment. A retired definition MUST NOT be a new resolver candidate.

#### Scenario: Provisional specialty antibody matches

- **WHEN** a printed specialty antibody label matches a provisional launch record
- **THEN** the resolver returns partial recognition with the matching analyte or candidate
- **AND** does not treat the record as a reviewed concrete measurement or assessment input

### Requirement: Resolution supports incomplete but recognized measurements

The resolver SHALL return exactly one of `resolved`, `ambiguous`, `partial`, or `unmapped`. `partial` SHALL mean that a launch-catalog analyte, measurement family, or provisional record is recognized but one concrete reviewed measurement is not justified. Partial results SHALL retain optional analyte identity, candidate definition keys, missing axes, accepted evidence, and hard conflicts without depending on Registry v1.

#### Scenario: ALT lacks specimen evidence

- **WHEN** ALT and a catalytic-activity unit are recognized but the report does not identify serum or plasma
- **THEN** the result is `partial` rather than `unmapped`
- **AND** the resolver does not fabricate a concrete specimen-specific definition

#### Scenario: Specialty IgG test lacks specimen evidence

- **WHEN** `anti-Opisthorchis felineus IgG, qualitative ELISA` is extracted without a stated specimen
- **THEN** the antibody test, nominal value kind, and stated method are recognized
- **AND** the missing specimen prevents false concrete resolution

#### Scenario: Truly unknown label is retained

- **WHEN** no reviewed alias, provisional alias, analyte, or measurement family matches a raw label
- **THEN** the resolver returns `unmapped`
- **AND** raw evidence remains eligible for acceptance and later reprocessing

### Requirement: Measurement identity is separate from assessment binding

Measurement definitions SHALL NOT use a storage compatibility key as a proxy for assessment behavior. Assessment participation SHALL be declared through versioned reviewed bindings that identify the assessment input/group and compatibility policy. Multiple distinct measurement definitions MAY intentionally share one assessment binding only when that aggregation has been reviewed.

#### Scenario: Serum and plasma glucose feed one assessment input

- **WHEN** reviewed serum and plasma glucose definitions intentionally share a glucose assessment binding
- **THEN** they remain distinct measurement identities
- **AND** assessment aggregation follows the explicit binding rather than key equality

#### Scenario: Display-only parasite antibody is accepted

- **WHEN** a parasite antibody result is recognized or resolved for display
- **THEN** it has no assessment binding by default
- **AND** cannot change readiness or health scores

### Requirement: Registry releases are deterministic and auditable

Each launch registry release SHALL serialize analytes, definitions, maturity, structured aliases, identity axes, units, assessment bindings, source provenance, and fixture coverage into a deterministic manifest and digest. Changes to any serialized semantic field SHALL change the digest and receive an explicit release classification.

#### Scenario: Source order changes only

- **WHEN** semantically identical launch catalog content is reordered in source code
- **THEN** canonical serialization and digest remain unchanged

#### Scenario: Alias or assessment binding changes

- **WHEN** a reviewed alias, unit policy, maturity, or assessment binding changes
- **THEN** the manifest digest changes
- **AND** release evidence identifies affected definitions and fixtures
