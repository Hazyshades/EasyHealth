# doctor-visit-brief

## ADDED Requirements

### Requirement: Versioned report and evidence contract

A Doctor Visit Brief SHALL be persisted as a versioned structured payload containing report kind, generated-at metadata, detail level, materialized source document IDs, typed sections, limitations, source snapshots, and the mandatory educational disclaimer.

#### Scenario: New brief stores a materialized scope

- **WHEN** an authenticated user creates a brief with an explicit document selection or the all-eligible default
- **THEN** the persisted report contains the exact selected document UUID array
- **AND** the payload contains a supported contract version
- **AND** the all-eligible case is not persisted as an implicit `null` scope

#### Scenario: Legacy report is read without fabricated evidence

- **WHEN** a user opens a legacy report whose document scope or contract version is unavailable
- **THEN** the system renders it through a legacy presentation path
- **AND** does not convert filenames into citation identities
- **AND** marks the report unavailable for new sharing or export until revalidated

### Requirement: Source-grounded factual claims

Every factual claim in a new brief SHALL reference one or more source IDs from the same report payload. Each source SHALL identify an allowed evidence kind, source row ID, document ID, and display-safe snapshot of the value, unit, range, text, or date when available.

#### Scenario: Claim cites an observation and its document

- **WHEN** a generated claim describes a laboratory measurement
- **THEN** the claim contains a citation to a source ID
- **AND** the source identifies the observation and owning document
- **AND** the source snapshot includes the native value, unit, reference range, and observed date when available

#### Scenario: Unknown citation is not persisted as supported

- **WHEN** generated content references a source ID absent from the server-provided source catalog
- **THEN** the claim is rejected or marked limited before persistence
- **AND** the unknown identifier is not rendered as a source link

### Requirement: Missing evidence is explicit

The brief SHALL represent unavailable, undated, incompatible, or excluded evidence as a limitation. It SHALL NOT infer a value, trend, diagnosis, treatment, or urgency instruction from missing data.

#### Scenario: No historical comparison exists

- **WHEN** a section requests a change but the scoped sources contain fewer than two comparable measurements
- **THEN** the brief shows a limitation explaining that a comparison is unavailable
- **AND** it does not label the result as improving or worsening

### Requirement: Doctor-facing brief sections

The brief detail view SHALL render document summary, latest measurements, changes, questions for a clinician, limitations, and a source ledger from the structured contract. Factual section items SHALL expose their citation labels and source snapshots without exposing storage paths.

#### Scenario: Doctor opens a complete brief

- **WHEN** a signed-in owner opens a validated Doctor Visit Brief
- **THEN** the page renders the typed sections and generated-at date
- **AND** each factual item has an inspectable source reference
- **AND** the medical disclaimer is visible

#### Scenario: Brief remains educational

- **WHEN** the brief contains generated questions or change descriptions
- **THEN** the UI presents them as questions or numeric/source-grounded observations
- **AND** it does not present a diagnosis, treatment plan, or medical directive as a report fact
