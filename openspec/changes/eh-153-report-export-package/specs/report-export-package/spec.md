# report-export-package

## ADDED Requirements

### Requirement: Export validated report formats

The system SHALL export a validated EH-148 report as PDF, CSV, or JSON using the same ordered content, source scope, limitations, disclaimer, generated-at timestamp, contract version, and validator version as the on-screen report. When a dynamics section is requested, the exporter SHALL consume the frozen EH-149 `BiomarkerDynamicsReport` DTO and SHALL NOT query or recompute raw observations.

#### Scenario: Owner downloads JSON

- **WHEN** an authenticated owner requests JSON export for a validated report
- **THEN** the response contains the versioned report contract and source ledger
- **AND** contains no unrelated document or raw storage path

#### Scenario: Owner downloads CSV

- **WHEN** an authenticated owner requests CSV export
- **THEN** metadata rows include generated-at time, contract/validator versions, disclaimer, and limitations
- **AND** claim rows retain section, claim status/text, citation IDs, and deterministic `row_order` without treating narrative claims as measurements
- **AND** source rows include every report-ledger source ID, kind, document ID, display-safe snapshot, label, and deterministic `row_order`
- **AND** measurement rows include source observation/document IDs, date, native value/unit/range, display value/unit, conversion metadata, and deterministic `row_order`

#### Scenario: Report-only share retains the complete ledger

- **WHEN** an authenticated recipient exports a validated report-only share with no raw-document child rows
- **THEN** the export contains the complete report source ledger and selected report scope
- **AND** no raw document download is granted by the absence of child rows

#### Scenario: Dynamics export uses the frozen projection

- **WHEN** an export includes an EH-149 dynamics section
- **THEN** PDF, CSV, and JSON serialize the supplied series, points, tolerances, and provenance
- **AND** the export path does not rebuild dynamics from database rows

### Requirement: Unicode-safe PDF

The PDF export SHALL preserve the report sections, citations, limitations, disclaimer, and Unicode source labels using a pinned server-side renderer and embedded Unicode font. Renderer or font failure SHALL return an explicit failure rather than a partial document.

#### Scenario: Report contains Unicode metadata

- **WHEN** a validated report contains Cyrillic, accented Latin, long filenames, or a non-ASCII unit label
- **THEN** the PDF remains readable and contains the same source references as the on-screen report

### Requirement: Scope-safe export authorization

Export SHALL require the owner session or a verified EH-151 share capability. A shared export SHALL honor the share's format and document download policy and SHALL reject legacy/unvalidated reports.

#### Scenario: Shared report cannot widen scope

- **WHEN** a recipient requests an export for a report or document outside the share scope
- **THEN** the server returns a generic authorization failure
- **AND** the output contains no out-of-scope content
