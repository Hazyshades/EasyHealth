## ADDED Requirements

### Requirement: API supports non-numeric observations

`GET /api/health-profile` and related biomarker payloads SHALL represent non-numeric observations with explicit value kind and text fields so clients do not assume `value` is always a number.

#### Scenario: Qualitative marker in payload

- **WHEN** the profile includes a qualitative observation in any marker list returned by the API
- **THEN** the payload includes `value_kind` and `value_text` (or equivalent)
- **AND** `value` may be null

### Requirement: API includes observation identity fields

Health profile and biomarkers APIs SHALL include `specimen` and `modifier` on marker/observation objects when those columns exist.

#### Scenario: Specimen returned

- **WHEN** an observation has specimen `urine`
- **THEN** the API response includes specimen `urine` for that marker

### Requirement: Scoring fields ignore display and non-numeric

System `state_score` and `data_confidence` computation used by the health profile API SHALL exclude display-only specialty markers and non-numeric value kinds from score and coverage inputs.

#### Scenario: Specialty-only profile scores

- **WHEN** a user has only display-only specialty numeric markers with refs
- **THEN** those markers do not alone produce organ system scores as core coverage markers
