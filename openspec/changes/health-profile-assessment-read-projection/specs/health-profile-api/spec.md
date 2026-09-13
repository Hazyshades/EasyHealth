## MODIFIED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning deterministic current-state assessments, readiness details, drawer-ready factual biomarker details, instrumental observations, optional cached holistic synthesis, and the derived assessment lifecycle metadata for the authenticated user's profile.

#### Scenario: Authenticated profile request with biomarker data

- **WHEN** an authenticated user with one or more biomarker observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, a biomarker-observation count or equivalent profile display state, nullable overall assessment fields, `scoreable_named_system_count`, `scoreable_named_system_total`, `systems`, and `sources`
- **AND** `systems` contains all eight named systems and optionally General
- **AND** biomarker aggregation includes laboratory and instrumental observations
- **AND** may include `holistic_synthesis` when cached or generated

#### Scenario: Authenticated profile request without biomarkers but with consultations

- **WHEN** an authenticated user has no observations but has accepted consultation or other structured document data
- **THEN** the response status is 200
- **AND** the response distinguishes the absence of recognized biomarker observations from the onboarding empty state
- **AND** `holistic_synthesis` is present or generated from non-lab structured data

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations and no structured document data sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array
- **AND** `holistic_synthesis` is null or absent

#### Scenario: Authenticated profile receives one lifecycle read contract

- **WHEN** an authenticated user sends `GET /api/health-profile`
- **THEN** the response includes the existing assessment status and error fields
- **AND** includes `assessment.display_state`, `assessment.has_current_version`, and `assessment.fallback`
- **AND** the profile-wide lifecycle values are derived from the canonical persisted-versus-fallback assessment read projection
- **AND** nullable scores, readiness details, observation freshness, source evidence, and synthesis fields retain their existing contract
