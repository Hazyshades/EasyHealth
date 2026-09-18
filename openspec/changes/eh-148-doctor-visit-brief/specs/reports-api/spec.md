# reports-api

## MODIFIED Requirements

### Requirement: Reports table persistence

The system SHALL persist each newly generated report for the authenticated profile with title, report type, detail level, an exact materialized `document_ids` scope, versioned structured content, summary preview, and created-at metadata. Existing legacy rows MAY retain a null scope, but new rows SHALL NOT use null to mean all eligible documents.

#### Scenario: Report saved with exact scope

- **WHEN** `POST /api/reports` successfully generates a report from all eligible documents
- **THEN** the inserted row contains the resolved eligible document UUID array
- **AND** the content contains the Doctor Visit Brief contract version and source snapshots
- **AND** no additional LLM call is needed to derive the summary preview

#### Scenario: Legacy row is not silently upgraded

- **WHEN** a legacy report has a null scope or unversioned content
- **THEN** reads remain available to the owner
- **AND** share/export code can distinguish it from a validated report
- **AND** no fabricated citation metadata is written

### Requirement: Report generation request body

The `POST /api/reports` body SHALL accept `title`, `report_type`, `detail_level`, optional `document_ids`, and optional `abnormal_only`. The server SHALL resolve and authorize the document scope, build a source catalog retaining row and document IDs, and pass only that catalog to the report generator. A successful new report SHALL conform to the versioned Doctor Visit Brief contract before insertion.

#### Scenario: Explicit scope is preserved

- **WHEN** `document_ids` contains eligible UUIDs owned by the profile
- **THEN** only those documents contribute source records
- **AND** every persisted source document ID belongs to that exact request scope

#### Scenario: Scope widening is rejected

- **WHEN** generated content contains a source or document outside the resolved scope
- **THEN** generation fails or sanitizes the unsupported claim before insertion
- **AND** the out-of-scope source is not exposed in the response
