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

Every factual claim in a new brief SHALL reference one or more source IDs from the same report payload. Each source SHALL identify an allowed evidence kind, source row ID, document ID, and display-safe snapshot of the value, unit, range, text, or date when available. The server SHALL persist the source-row identity separately from the public payload so later citation validation does not rely on snapshot text.

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

### Requirement: Durable evidence identity mapping

A new report SHALL persist a server-only `report_evidence_sources` mapping keyed by `(report_id, source_id)` to source kind, source row ID, and document ID in the same transaction as the report payload. Citation validation SHALL resolve source references through this mapping, and the mapping SHALL be deleted with its report. The mapping SHALL NOT expose profile IDs, storage paths, bearer credentials, or raw source text.

#### Scenario: Citation resolves after report persistence

- **WHEN** EH-150 validates a persisted claim after the generation request has ended
- **THEN** the validator resolves its source ID through the report-owned mapping and verifies the source row/document remains in the report's immutable scope
- **AND** a payload snapshot alone is never treated as authorization or row identity

### Requirement: Atomic validated report persistence

`POST /api/reports` SHALL delegate creation to one service-only `createValidatedReport` transition. The transition SHALL run EH-150's pure validator against a server-authorized source catalog, then call the EH-148-owned `public.create_validated_report` RPC. That `SECURITY DEFINER` RPC SHALL recheck profile ownership, source-row identity, immutable document scope, and source mappings, and atomically insert the validated content, validator status, report scope, and `report_evidence_sources`. A parse, mapping, validation, RPC, or persistence failure SHALL roll back so no unvalidated report is readable, shareable, or exportable.

#### Scenario: Mapping validation failure rolls back

- **WHEN** the candidate validator result or the `public.create_validated_report` RPC rejects a citation, mapping, scope, or persistence step
- **THEN** the transition returns a safe validation/error result and persists no report, evidence mapping, or shareable validator status
- **AND** a later read cannot observe the rejected candidate
