## MODIFIED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning deterministic current-state assessments and drawer-ready factual details for the authenticated user's profile.

#### Scenario: Authenticated profile request with data

- **WHEN** an authenticated user with observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, overall assessment fields, `systems` array, and `sources` array
- **AND** no LLM call is performed while serving the request

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array

#### Scenario: Unauthenticated profile request

- **WHEN** a request without a valid session sends `GET /api/health-profile`
- **THEN** the response status is 401

### Requirement: System insight structure

Each entry in `systems` SHALL include system id, display name, current state score, data confidence percentage, markers array, and drawer-ready source document references.

#### Scenario: System with out-of-range marker

- **WHEN** a biomarker in a system has a value outside its reference range
- **THEN** the marker entry includes `status` of `out_of_range`
- **AND** includes `value`, `unit`, `observed_at`, `document_id`, and source document metadata when available
- **AND** does not include a diagnosis or disease label

#### Scenario: System score and confidence returned

- **WHEN** a system has mapped observations
- **THEN** the system entry includes a 0-100 current state score
- **AND** includes a separate 0-100 data confidence percentage
- **AND** the confidence is not used as the displayed current state score

### Requirement: Deterministic aggregation

Health profile aggregation SHALL be computed deterministically from stored observations and completed source documents without an LLM call.

#### Scenario: Repeated requests return consistent results

- **WHEN** the same user sends two consecutive `GET /api/health-profile` requests without data changes
- **THEN** both responses return identical current state scores, data confidence values, and marker details

#### Scenario: New completed document updates profile facts

- **WHEN** a new completed document produces observations for the authenticated user
- **THEN** a later `GET /api/health-profile` response reflects the new observations in scores, confidence, markers, and source details
- **AND** the response does not require generating a paid or unpaid report

## ADDED Requirements

### Requirement: Drawer source attribution

The health profile endpoint SHALL provide enough source metadata for the client to show which uploaded document contributed to a selected system or organ.

#### Scenario: Marker has a source document

- **WHEN** a marker has a non-null `document_id`
- **THEN** the corresponding marker or source entry includes the source document id, original filename, observed date, and lab name when available

#### Scenario: Primary source can be identified

- **WHEN** multiple documents contribute to the same system
- **THEN** the response includes enough marker-to-document relationships for the client to identify a primary source deterministically
