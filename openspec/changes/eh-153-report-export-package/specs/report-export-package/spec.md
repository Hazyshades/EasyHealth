# report-export-package

## ADDED Requirements

### Requirement: Export validated report formats

The system SHALL export a validated EH-148 report as PDF, CSV, or JSON using the same ordered content, source scope, limitations, disclaimer, generated-at timestamp, contract version, and safe validation projection `{ status, version }` as the on-screen report. Internal validation issue codes SHALL NOT appear in any export bytes or public response. Only supported/limited claims are serializable; removed claims are omitted. When a dynamics section is requested, the exporter SHALL consume the persisted EH-149 `BiomarkerDynamicsReport` extension selected by EH-148's `report-read.ts` resolver and SHALL NOT accept a client DTO, query raw observations, or recompute raw observations.

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
- **THEN** PDF, CSV, and JSON serialize the persisted series, points, tolerances, and provenance selected by the EH-148 resolver
- **AND** the export path does not rebuild dynamics from database rows

### Requirement: Source-unavailable export fidelity

When EH-148's read resolver marks a cited source row archived/removed while its parent document remains active, export SHALL preserve the historical snapshot and visible `SOURCE_UNAVAILABLE` limitation while denying live/raw-source access. When the source document enters `deleting`/tombstoned state, the resolver SHALL invalidate the complete report before export reads content, and export SHALL return a generic unavailable failure with no bytes. Export SHALL fail closed if the derived state cannot be represented without claiming the source is currently available.

#### Scenario: Export after source deletion

- **WHEN** a report is exported after a cited source row is archived/removed while its parent document remains active
- **THEN** the output preserves the historical evidence snapshot and source-unavailable limitation
- **AND** it contains no live/raw source content or unqualified supported claim

#### Scenario: Export after source document tombstone

- **WHEN** a report is exported after a cited source document enters `deleting`/tombstoned state
- **THEN** the resolver returns generic unavailable before serialization
- **AND** no report, snapshot, or partial file bytes are returned

### Requirement: Unicode-safe PDF

The PDF export SHALL preserve the report sections, citations, limitations, disclaimer, and Unicode source labels using a pinned server-side renderer and embedded Unicode font. Renderer or font failure SHALL return an explicit failure rather than a partial document.

#### Scenario: Report contains Unicode metadata

- **WHEN** a validated report contains Cyrillic, accented Latin, long filenames, or a non-ASCII unit label
- **THEN** the PDF remains readable and contains the same source references as the on-screen report

### Requirement: Scope-safe export authorization

Export SHALL require the owner session or a verified EH-151 share capability. A shared export SHALL honor the share's format and document download policy, reject legacy/unvalidated reports, and apply EH-151's `applyPublicShareResponsePolicy` helper before returning PDF, CSV, or JSON bytes.

#### Scenario: Shared report cannot widen scope

- **WHEN** a recipient requests an export for a report or document outside the share scope
- **THEN** the server returns a generic authorization failure
- **AND** the output contains no out-of-scope content

#### Scenario: Public export omits internal validation codes

- **WHEN** a recipient downloads an approved shared PDF, CSV, or JSON export
- **THEN** the output contains only the safe validation status/version and visible limitations
- **AND** no internal validation issue code, raw document content beyond the contract's display-safe source snapshot, token, profile identifier, or storage path appears

#### Scenario: Invalid validation envelope fails before bytes

- **WHEN** an owner or recipient requests export for a legacy, invalid, missing, or tampered validation envelope
- **THEN** the server returns a generic validation/unavailable failure
- **AND** it returns no partial file, report content, or issue-code details

#### Scenario: Dynamics point outside report scope fails closed

- **WHEN** persisted dynamics metadata contains a point whose source document is outside the report's materialized scope
- **THEN** the EH-148 resolver rejects the export
- **AND** no out-of-scope point or source row is serialized
