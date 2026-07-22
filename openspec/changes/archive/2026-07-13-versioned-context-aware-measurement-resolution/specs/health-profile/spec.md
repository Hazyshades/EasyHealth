## ADDED Requirements

### Requirement: Assessment uses active compatible measurement observations
The Health Profile SHALL use only active observations backed by resolved, assessment-compatible normalization decisions. Ambiguous, unmapped, superseded, and inactive candidate decisions SHALL not contribute to readiness, confidence, or numeric scores.

#### Scenario: Urine glucose does not affect metabolic assessment
- **WHEN** a glucose observation resolves to a urine measurement definition
- **THEN** it remains factual data
- **AND** it does not contribute to a blood/metabolic current-state assessment

#### Scenario: Ambiguous measurement does not unlock readiness
- **WHEN** a required marker alias is present but its measurement definition is ambiguous
- **THEN** the system remains unscored until a compatible active decision exists
