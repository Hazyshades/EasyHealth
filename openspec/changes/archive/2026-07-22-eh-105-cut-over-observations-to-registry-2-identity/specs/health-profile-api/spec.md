## ADDED Requirements

### Requirement: Laboratory marker DTOs identify their observation kind

Every observation-derived marker returned in a Health Profile laboratory marker collection SHALL include `observation_kind = 'lab'`. An instrumental observation SHALL not appear in a laboratory marker collection, score/readiness payload, or factual laboratory biomarker field until EH-106 defines a separate typed consumer contract.

#### Scenario: Instrumental row is present in storage

- **WHEN** a profile has one or more current instrumental observations and requests `GET /api/health-profile`
- **THEN** no instrumental row is emitted as a laboratory marker
- **AND** no instrumental row contributes to readiness, system score, confidence, or overall assessment

## MODIFIED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning deterministic current-state assessments, readiness details, drawer-ready factual laboratory biomarker details, and optional cached holistic synthesis for the authenticated user's profile. Instrumental observations SHALL be excluded from laboratory systems, marker collections, and assessment fields until EH-106 supplies their complete typed presentation contract.

#### Scenario: Authenticated profile request with laboratory data

- **WHEN** an authenticated user with one or more laboratory observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, a laboratory biomarker-observation count or equivalent profile display state, nullable overall assessment fields, `scoreable_named_system_count`, `scoreable_named_system_total`, `systems`, and `sources`
- **AND** `systems` contains all eight named systems and optionally General
- **AND** biomarker aggregation includes only laboratory observations
- **AND** may include `holistic_synthesis` when cached or generated

#### Scenario: Authenticated profile request without laboratory biomarkers but with consultations

- **WHEN** an authenticated user has no laboratory observations but has accepted consultation, instrumental, or other structured document data
- **THEN** the response status is 200
- **AND** the response distinguishes the absence of recognized laboratory biomarker observations from the onboarding empty state
- **AND** `holistic_synthesis` is present or generated from non-lab structured data when available

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations and no structured document data sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array
- **AND** `holistic_synthesis` is null or absent

### Requirement: Biomarker to system mapping

The server SHALL map only laboratory observations to body systems using the configured laboratory mapping. Instrumental observations SHALL not be mapped to a body system, General, or a laboratory assessment bucket in EH-105.

#### Scenario: Known laboratory biomarker mapped to system

- **WHEN** a laboratory observation is eligible for the configured system mapping
- **THEN** the observation contributes to that laboratory system's coverage and marker list

#### Scenario: Instrumental observation is excluded from mapping

- **WHEN** an observation exists with `observation_kind = 'instrumental'`
- **THEN** it does not contribute to a named system or General bucket
- **AND** it does not influence the overall assessment

