# reports-api

## MODIFIED Requirements

### Requirement: Reports table persistence

The system SHALL persist each newly generated report for the authenticated profile with title, report type, detail level, a typed requested scope, an exact non-null actual `document_ids` source scope, versioned structured content, server-rendered overview, summary preview, created-at metadata, and an immutable validation envelope represented by `validation_status`, `validation_version`, and `validation_issue_codes`. Existing legacy rows MAY retain a null scope or missing validation envelope, but new rows SHALL NOT use null to mean all eligible documents or omit requested/actual scope and validation metadata.

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

The `POST /api/reports` body SHALL accept `title`, `report_type`, `detail_level`, optional `document_ids`, optional `abnormal_only`, optional bounded `questions`, optional inclusive UTC `report_date_range: { start, end }`, and optional `biomarker_dynamics_period: { start, end }`. `questions` SHALL contain at most five unique NFC-normalized strings of 1–240 Unicode scalar characters with no control characters or line breaks; accepted questions persist as non-factual `clinician_question` claims with `origin: user_selected`. `report_date_range.start` and `.end` SHALL be canonical `YYYY-MM-DD` UTC calendar dates with `start <= end`; filtering compares the UTC calendar date of each authoritative source date, so the entire end date is inclusive. Measurements use observation date and other source kinds use document date, and undated sources are excluded. A document enters the materialized scope only when it contributes at least one eligible in-range source or in-range document-summary source; an explicitly supplied document with no eligible in-range source or unauthorized SHALL fail safely, while all-eligible resolution includes only documents with an eligible in-range source. The server SHALL validate both ranges and report document scope, pass only the authorized scope and dynamics period to EH-149, and reject client-supplied dynamics DTOs or raw observations. Missing optional fields mean no question claims, no date filter, or no dynamics extension respectively. The server SHALL resolve and authorize the document scope, build a source catalog retaining row and document IDs, and pass only that catalog to the report generator. A successful new report SHALL conform to the versioned Doctor Visit Brief contract before insertion.

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

#### Scenario: Invalid report date range fails before persistence

- **WHEN** an authenticated client submits a malformed/reversed `report_date_range` or a date not matching canonical `YYYY-MM-DD`
- **THEN** the endpoint returns HTTP 400
- **AND** no report, dynamics extension, or validation envelope is persisted

#### Scenario: Source deletion or republish race fails closed

- **WHEN** a source document is tombstoned or advances its `write_generation` after context capture and before `create_validated_report` commits
- **THEN** the service-only writer rejects the request after document-first generation revalidation
- **AND** no report, summary preview, mapping, or validation envelope derived from stale content is persisted

#### Scenario: User-selected questions and date range are preserved

- **WHEN** an authenticated owner submits valid questions and an inclusive `report_date_range`
- **THEN** the persisted contract contains the normalized questions as `clinician_question` claims with `origin: user_selected`
- **AND** its immutable source scope contains only authorized, dated documents in the requested range, including boundary dates
- **AND** owner detail, authorized share, and export use the same persisted question claims and scope

#### Scenario: Invalid question or date-range input fails before persistence

- **WHEN** a request contains an invalid question or a malformed/reversed `report_date_range`
- **THEN** the endpoint returns HTTP 400
- **AND** no report, question claim, source mapping, or validation envelope is persisted


### Requirement: Summary preview derives from validated overview

The report service SHALL derive `summary_preview` from the first 120 characters of the server-rendered, validated contract `overview`, trimmed with the existing ellipsis rule when truncated. It SHALL perform no additional LLM call and SHALL never derive preview text from rejected, removed, or raw model fields.

#### Scenario: Unsafe model text cannot enter the preview

- **WHEN** generation includes a rejected unsafe field alongside a valid report
- **THEN** the persisted preview is derived only from the validated overview
- **AND** the preview contains no rejected diagnosis, treatment, urgency, or imperative text
