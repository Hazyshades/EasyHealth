## ADDED Requirements

### Requirement: Measurement-definition compatibility metadata
The canonical biomarker catalog SHALL expose code-based measurement-definition metadata without replacing existing canonical `biomarker_key` records.

#### Scenario: Existing canonical key remains compatible
- **WHEN** a measurement definition safely maps to an existing canonical key
- **THEN** the catalog exposes that compatibility mapping
- **AND** existing scoring and trend consumers can continue using the canonical key

#### Scenario: Incompatible measurement does not inherit a key
- **WHEN** a measurement definition cannot safely share an existing canonical key
- **THEN** the catalog marks it assessment-incompatible or assigns an explicit new compatibility key
- **AND** it is not silently collapsed into an unrelated legacy series
