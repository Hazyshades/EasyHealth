## MODIFIED Requirements

### Requirement: Launch catalog recognizes all required row types safely
The launch catalog SHALL include exact resolver fixtures for every required result row in the candidate corpus, covering raw labels, units, value kinds, available section/method/specimen context, and missing-context negatives. Every expected row SHALL be recognised as `resolved`, `ambiguous`, or `partial`; no expected row MAY remain `unmapped` at the launch gate. A numeric or arbitrary-unit row SHALL be unit-covered only when at least one recognised typed candidate accepts its normalised source unit. An intentionally unitless qualitative row SHALL be unit-covered without fabricating a numeric unit.

#### Scenario: Required fixture coverage is complete
- **WHEN** the candidate corpus evaluates the mandatory launch rows
- **THEN** every row has an explicit expected classification
- **AND** every row is recognised with raw evidence preserved
- **AND** every numeric, coefficient, titer, or intentionally unitless qualitative row has unit evidence that is compatible with a typed candidate

#### Scenario: Missing context does not become compatibility
- **WHEN** a recognised launch row lacks required specimen, method, modifier, or timing evidence
- **THEN** the resolver returns `partial` or `ambiguous` with structured missing-axis evidence
- **AND** it SHALL NOT choose a reviewed concrete definition or assessment binding

#### Scenario: Unknown unit remains a release failure
- **WHEN** a required numeric or arbitrary-unit launch row has a source unit not accepted by every matched typed candidate
- **THEN** the report records a unit conflict
- **AND** the row is not unit-covered
- **AND** the candidate-release gate is not launchable
