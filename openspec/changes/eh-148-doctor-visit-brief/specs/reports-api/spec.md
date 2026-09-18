# reports-api

## MODIFIED Requirements

### Requirement: Reports table persistence

The system SHALL persist each newly generated report for the authenticated profile with title, report type, detail level, an exact materialized `document_ids` scope, versioned structured content, server-rendered overview, summary preview, created-at metadata, and an immutable validation envelope represented by `validation_status`, `validation_version`, and `validation_issue_codes`. Existing legacy rows MAY retain a null scope or missing validation envelope, but new rows SHALL NOT use null to mean all eligible documents or omit validation metadata.

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

The `POST /api/reports` body SHALL accept `title`, `report_type`, `detail_level`, optional `document_ids`, optional `abnormal_only`, and optional `biomarker_dynamics_period: { start, end }`. `start` and `end` SHALL be inclusive UTC dates with `start <= end`; the server SHALL validate the range and report document scope, pass only the authorized scope and period to EH-149, and reject client-supplied dynamics DTOs or raw observations. A missing period means no dynamics extension. The server SHALL resolve and authorize the document scope, build a source catalog retaining row and document IDs, and pass only that catalog to the report generator. A successful new report SHALL conform to the versioned Doctor Visit Brief contract before insertion.

#### Scenario: Explicit scope is preserved

- **WHEN** `document_ids` contains eligible UUIDs owned by the profile
- **THEN** only those documents contribute source records
- **AND** every persisted source document ID belongs to that exact request scope

#### Scenario: Scope widening is rejected

- **WHEN** generated content contains a source or document outside the resolved scope
- **THEN** generation fails with a safe validation error and no report or validation envelope is persisted
- **AND** the out-of-scope source is not exposed in the response

#### Scenario: Valid dynamics period reaches the server-owned handoff

- **WHEN** an authenticated client submits a valid `biomarker_dynamics_period` with eligible report scope
- **THEN** EH-149 receives the authorized period and exact materialized document scope
- **AND** the validated report stores the returned frozen dynamics extension and validation envelope

#### Scenario: Invalid dynamics period fails before persistence

- **WHEN** a client submits a malformed period or an end before start
- **THEN** the endpoint returns HTTP 400
- **AND** no report, dynamics extension, or validation envelope is persisted

### Requirement: Summary preview derives from validated overview

The report service SHALL derive `summary_preview` from the first 120 characters of the server-rendered, validated contract `overview`, trimmed with the existing ellipsis rule when truncated. It SHALL perform no additional LLM call and SHALL never derive preview text from rejected, removed, or raw model fields.

#### Scenario: Unsafe model text cannot enter the preview

- **WHEN** generation includes a rejected unsafe field alongside a valid report
- **THEN** the persisted preview is derived only from the validated overview
- **AND** the preview contains no rejected diagnosis, treatment, urgency, or imperative text
