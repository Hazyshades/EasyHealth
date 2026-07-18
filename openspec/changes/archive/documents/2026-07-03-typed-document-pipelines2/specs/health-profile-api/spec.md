## MODIFIED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning deterministic current-state assessments, drawer-ready factual biomarker details, instrumental observations, and optional cached holistic synthesis for the authenticated user's profile.

#### Scenario: Authenticated profile request with data

- **WHEN** an authenticated user with observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, overall assessment fields, `systems` array, and `sources` array
- **AND** biomarker aggregation includes laboratory and instrumental observations
- **AND** may include `holistic_synthesis` when cached or generated

#### Scenario: Authenticated profile request without biomarkers but with consultations

- **WHEN** an authenticated user has no observations but has accepted consultation or other structured document data
- **THEN** the response status is 200
- **AND** `systems` may be an empty array
- **AND** `holistic_synthesis` is present or generated from non-lab structured data

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations and no structured document data sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array
- **AND** `holistic_synthesis` is null or absent

## ADDED Requirements

### Requirement: Paid synthesis refresh route

The system SHALL register `POST /api/health-profile/synthesis` with x402 middleware at the configured synthesis refresh price.

#### Scenario: Route registered

- **WHEN** the application starts
- **THEN** unpaid POST to `/api/health-profile/synthesis` returns HTTP 402
- **AND** paid POST regenerates and returns holistic synthesis JSON

### Requirement: Synthesis stale indicator

The health profile response SHALL include a `synthesis_stale` boolean set to true when the cached synthesis input hash differs from the current profile structured data hash.

#### Scenario: Stale flag after new upload

- **WHEN** a new document is processed after last synthesis generation
- **THEN** `GET /api/health-profile` sets `synthesis_stale` to true until synthesis is regenerated
