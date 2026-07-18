## ADDED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning aggregated system insights for the authenticated user's profile.

#### Scenario: Authenticated profile request with data

- **WHEN** an authenticated user with observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, `overall_coverage`, `systems` array, and `sources` array

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array

#### Scenario: Unauthenticated profile request

- **WHEN** a request without a valid session sends `GET /api/health-profile`
- **THEN** the response status is 401

### Requirement: System insight structure

Each entry in `systems` SHALL include system id, display name, coverage percentage, markers array, and contributing document references.

#### Scenario: System with out-of-range marker

- **WHEN** a biomarker in a system has a value outside its reference range
- **THEN** the marker entry includes `status` of `out_of_range`
- **AND** includes `value`, `unit`, `observed_at`, and `document_id`
- **AND** does not include a diagnosis or disease label

### Requirement: Deterministic aggregation

Health profile aggregation SHALL be computed deterministically from stored observations without an LLM call.

#### Scenario: Repeated requests return consistent results

- **WHEN** the same user sends two consecutive `GET /api/health-profile` requests without data changes
- **THEN** both responses return identical `overall_coverage` and system coverage values

### Requirement: Biomarker to system mapping

The server SHALL map biomarker keys to body systems using a static configuration file.

#### Scenario: Known biomarker mapped to system

- **WHEN** an observation exists for a biomarker key defined in the system mapping
- **THEN** the observation contributes to that system's coverage and marker list

#### Scenario: Unknown biomarker mapped to general

- **WHEN** an observation exists for a biomarker key not in the mapping
- **THEN** the observation contributes to a `general` system bucket
