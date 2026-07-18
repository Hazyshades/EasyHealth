## MODIFIED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning deterministic current-state assessments, drawer-ready factual biomarker details, and optional cached holistic synthesis for the authenticated user's profile.

#### Scenario: Authenticated profile request with data

- **WHEN** an authenticated user with observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, overall assessment fields, `systems` array, and `sources` array
- **AND** biomarker aggregation is computed deterministically without an LLM
- **AND** may include `holistic_synthesis` when cached or generated

#### Scenario: Authenticated profile request without biomarkers but with consultations

- **WHEN** an authenticated user has no observations but has accepted consultation or instrumental structured data
- **THEN** the response status is 200
- **AND** `systems` may be an empty array
- **AND** `holistic_synthesis` is present or generated from non-lab structured data

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations and no structured non-lab data sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array
- **AND** `holistic_synthesis` is null or absent

### Requirement: Deterministic aggregation

Biomarker health profile aggregation SHALL be computed deterministically from stored observations and completed source documents without an LLM. Holistic synthesis MAY use an LLM in a separate step with caching.

#### Scenario: Repeated requests return consistent biomarker results

- **WHEN** the same user sends two consecutive `GET /api/health-profile` requests without biomarker data changes
- **THEN** both responses return identical current state scores, data confidence values, and marker details

#### Scenario: New completed document updates profile

- **WHEN** a new completed document produces accepted structured data for the authenticated user
- **THEN** a later `GET /api/health-profile` response reflects the new data in sources and holistic synthesis when regenerated

## ADDED Requirements

### Requirement: Holistic synthesis response field

The health profile API response SHALL include `holistic_synthesis` with `text`, `generated_at`, `source_document_ids`, and `disclaimer` when synthesis is available.

#### Scenario: Synthesis field shape

- **WHEN** holistic synthesis is returned
- **THEN** `holistic_synthesis.text` is educational English prose
- **AND** `holistic_synthesis.disclaimer` equals "This is not medical advice. Consult a healthcare professional."
