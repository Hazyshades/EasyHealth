# report-export-package

## ADDED Requirements

### Requirement: Export validated report formats

The system SHALL export a validated EH-148 report as PDF, CSV, or JSON using the same ordered content, source scope, limitations, disclaimer, generated-at timestamp, contract version, and validator version as the on-screen report.

#### Scenario: Owner downloads JSON

- **WHEN** an authenticated owner requests JSON export for a validated report
- **THEN** the response contains the versioned report contract and source ledger
- **AND** contains no unrelated document or raw storage path

#### Scenario: Owner downloads CSV

- **WHEN** an authenticated owner requests CSV export
- **THEN** each measurement row includes source observation/document IDs, date, native value/unit/range, display value/unit, and conversion metadata
- **AND** narrative claims are not silently represented as fabricated measurement rows

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
