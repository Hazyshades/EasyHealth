## ADDED Requirements

### Requirement: Deterministic aggregation respects normalization promotion
The health-profile endpoint SHALL aggregate only active, resolved, assessment-compatible observations and SHALL preserve deterministic output for the same active normalization set.

#### Scenario: Candidate reprocessing does not change API output
- **WHEN** a newer normalization revision exists only as a candidate
- **THEN** `GET /api/health-profile` returns the result derived from the prior active observation
- **AND** the overall and system assessments do not change until promotion
