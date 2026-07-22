## ADDED Requirements

### Requirement: Reports table persistence

The system SHALL persist generated health reports in a `reports` table scoped by `profile_id` with fields for title, report_type, detail_level, document_ids, content (JSON), summary_preview, and created_at.

#### Scenario: Report saved after successful generation

- **WHEN** a paid `POST /api/reports` completes successfully
- **THEN** the system inserts a row in `reports` for the session profile
- **AND** stores the full structured report content as JSON

### Requirement: List reports API

The system SHALL provide `GET /api/reports` returning all reports for the authenticated profile ordered by `created_at` descending.

#### Scenario: Authenticated user lists reports

- **WHEN** a signed-in user calls `GET /api/reports`
- **THEN** the response includes `{ reports: ReportSummary[] }`
- **AND** each item includes id, title, report_type, detail_level, summary_preview, and created_at

#### Scenario: Unauthenticated list request

- **WHEN** a request without a valid session calls `GET /api/reports`
- **THEN** the system returns HTTP 401

### Requirement: Get single report API

The system SHALL provide `GET /api/reports/[id]` returning the full report for the authenticated profile.

#### Scenario: User views own report

- **WHEN** a signed-in user requests a report id belonging to their profile
- **THEN** the system returns the full report including content and document_ids

#### Scenario: User requests another profile's report

- **WHEN** a signed-in user requests a report id not belonging to their profile
- **THEN** the system returns HTTP 404

### Requirement: Delete report API

The system SHALL provide `DELETE /api/reports/[id]` to remove a report owned by the authenticated profile.

#### Scenario: User deletes own report

- **WHEN** a signed-in user deletes their report
- **THEN** the report row is removed
- **AND** the system returns HTTP 200 or 204

### Requirement: Paid report generation API

The system SHALL provide `POST /api/reports` protected by x402 payment of $0.05 USDC. Unpaid requests MUST return HTTP 402 before any LLM work.

#### Scenario: Unpaid generation attempt

- **WHEN** a client calls `POST /api/reports` without valid x402 payment
- **THEN** the system returns HTTP 402
- **AND** does not invoke the LLM

#### Scenario: Successful paid generation

- **WHEN** a client pays $0.05 USDC and sends a valid body with title, report_type, and detail_level
- **THEN** the system generates a structured report using the specialty prompt for report_type
- **AND** persists and returns the saved report with id

### Requirement: Report generation request body

The `POST /api/reports` body SHALL accept `title` (string), `report_type` (one of `general_practice`, `cardiology`, `endocrinology`), `detail_level` (one of `compact`, `standard`, `detailed`, `full`), and optional `document_ids` (uuid array or null).

#### Scenario: Default document scope

- **WHEN** `document_ids` is omitted or null
- **THEN** the system uses observations from all eligible documents for the profile

#### Scenario: Explicit document scope

- **WHEN** `document_ids` contains valid eligible document UUIDs owned by the profile
- **THEN** the system uses only observations linked to those documents

#### Scenario: Invalid document ids

- **WHEN** `document_ids` contains ids not owned by the profile or not eligible
- **THEN** the system returns HTTP 400 with an English error message

### Requirement: Eligible documents for reports

A document SHALL be eligible for report generation when its status is `completed` and it has at least one linked observation.

#### Scenario: Eligible documents query

- **WHEN** `GET /api/documents?eligible_for_report=1` is called by an authenticated user
- **THEN** the response includes only completed documents with at least one observation
- **AND** excludes imaging or consultation documents without extracted biomarkers

### Requirement: No observations available

The system SHALL return HTTP 400 when no observations match the resolved document scope after payment validation.

#### Scenario: No biomarker data for scope

- **WHEN** paid generation is requested but zero observations match the document scope
- **THEN** the system returns HTTP 400 with message instructing the user to upload lab results first

### Requirement: Report output schema and safety

Generated report content SHALL conform to `doctorSummarySchema` and include educational language only with the mandatory medical disclaimer.

#### Scenario: Report includes disclaimer

- **WHEN** generation succeeds
- **THEN** stored content includes `disclaimer` equal to "This is not medical advice. Consult a healthcare professional."

### Requirement: Summary preview derivation

The system SHALL set `summary_preview` from the first 120 characters of `overview`, trimmed, with ellipsis when truncated.

#### Scenario: Preview stored on create

- **WHEN** a report is generated
- **THEN** `summary_preview` is persisted without an additional LLM call

### Requirement: Specialty prompts

The system SHALL use distinct system prompts for `general_practice`, `cardiology`, and `endocrinology` while sharing the same output schema and medical safety rules.

#### Scenario: Cardiology report type

- **WHEN** `report_type` is `cardiology`
- **THEN** the LLM system prompt emphasizes cardiovascular-related biomarker literacy

### Requirement: Remove legacy doctor-summary endpoint

The system SHALL NOT expose `POST /api/doctor-summary` after this change is deployed.

#### Scenario: Legacy endpoint removed

- **WHEN** a client calls `POST /api/doctor-summary`
- **THEN** the route does not exist (HTTP 404)
