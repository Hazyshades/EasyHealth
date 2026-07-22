## MODIFIED Requirements

### Requirement: List reports API

The system SHALL provide `GET /api/reports` returning reports for the authenticated profile ordered by `created_at` descending, with optional query filters.

#### Scenario: Authenticated user lists reports

- **WHEN** a signed-in user calls `GET /api/reports`
- **THEN** the response includes `{ reports: ReportSummary[] }`
- **AND** each item includes id, title, report_type, detail_level, summary_preview, abnormal_only, and created_at

#### Scenario: Unauthenticated list request

- **WHEN** a request without a valid session calls `GET /api/reports`
- **THEN** the system returns HTTP 401

#### Scenario: Search filter

- **WHEN** a signed-in user calls `GET /api/reports?q=cardio`
- **THEN** the system returns only reports whose title or summary_preview matches the query (case-insensitive)

#### Scenario: Time range filter

- **WHEN** a signed-in user calls `GET /api/reports?range=30d`
- **THEN** the system returns only reports created within the last 30 days

#### Scenario: Report type filter

- **WHEN** a signed-in user calls `GET /api/reports?type=cardiology`
- **THEN** the system returns only reports with `report_type` of `cardiology`

### Requirement: Report generation request body

The `POST /api/reports` body SHALL accept `title`, `report_type`, `detail_level`, optional `document_ids`, and optional `abnormal_only` (boolean, default `false`).

#### Scenario: Default document scope

- **WHEN** `document_ids` is omitted or null
- **THEN** the system uses observations from all eligible documents for the profile

#### Scenario: Explicit document scope

- **WHEN** `document_ids` contains valid eligible document UUIDs owned by the profile
- **THEN** the system uses only observations linked to those documents

#### Scenario: Abnormal-only generation

- **WHEN** `abnormal_only` is `true`
- **THEN** the system includes only observations where value is below `ref_low` or above `ref_high`
- **AND** persists `abnormal_only` as `true` on the saved report

#### Scenario: No abnormal indicators

- **WHEN** `abnormal_only` is `true` and no observations match the out-of-range filter
- **THEN** the system returns HTTP 400 with an English error message

### Requirement: Specialty prompts

The system SHALL use distinct system prompts for all eight report types: `general_practice`, `cardiology`, `endocrinology`, `gastroenterology`, `hematology`, `nephrology`, `neurology`, and `pulmonology`, while sharing the same output schema and medical safety rules.

#### Scenario: Pulmonology report type

- **WHEN** `report_type` is `pulmonology`
- **THEN** the LLM system prompt emphasizes respiratory-related biomarker literacy

### Requirement: Reports table persistence

The system SHALL persist generated health reports in a `reports` table scoped by `profile_id` with fields for title, report_type, detail_level, document_ids, abnormal_only, content (JSON), summary_preview, and created_at.

#### Scenario: Report saved after successful generation

- **WHEN** a paid `POST /api/reports` completes successfully
- **THEN** the system inserts a row in `reports` for the session profile
- **AND** stores the full structured report content as JSON
- **AND** stores the `abnormal_only` flag
