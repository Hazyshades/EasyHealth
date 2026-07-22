## ADDED Requirements

### Requirement: Versioned measurement definitions
The system SHALL maintain a code-based, versioned registry of `MeasurementDefinition` records for concrete laboratory measurements. Each definition SHALL declare a stable key, aliases, legacy canonical-key compatibility, unit-token constraints, optional specimen/modifier constraints, and assessment compatibility.

#### Scenario: Concrete differential measurement is defined
- **WHEN** the registry defines neutrophil measurements
- **THEN** absolute and percentage forms are separate definitions
- **AND** the definitions declare their compatible unit/specimen/modifier evidence
- **AND** the existing canonical keys remain available for compatible consumers

### Requirement: Context-aware measurement resolution
The system SHALL resolve raw laboratory observations from raw label, unit token, specimen, modifier, and available document context before numeric unit conversion. The resolver SHALL apply hard incompatibility constraints before alias and contextual tiebreakers.

#### Scenario: Differential unit selects measurement form
- **WHEN** a raw line is labeled Neutrophils with value `62` and unit `%`
- **THEN** the resolver returns `resolved` for `neutrophils_percent`
- **AND** a raw line with unit `x10^9/L` resolves to `neutrophils_abs`

#### Scenario: Insufficient evidence remains ambiguous
- **WHEN** a raw line is labeled Neutrophils without a compatible unit, specimen, modifier, or decisive context
- **THEN** the resolver returns `ambiguous`
- **AND** it does not choose either absolute or percentage definition

#### Scenario: Fasting is not inferred
- **WHEN** a glucose line has no explicit fasting label or source modifier
- **THEN** the resolver SHALL NOT resolve it as `fasting_glucose`

### Requirement: Resolver and verification state separation
The system SHALL store resolver output independently from human verification. Resolver output SHALL be one of `resolved`, `ambiguous`, or `unmapped`; verification status SHALL be one of `pending`, `user_verified`, or `manually_corrected`.

#### Scenario: Manual correction preserves resolver evidence
- **WHEN** a user changes an ambiguous candidate to a selected measurement definition
- **THEN** the new decision records `manually_corrected`
- **AND** the original resolver result remains auditable

### Requirement: Immutable normalization revisions
The system SHALL create append-only normalization revisions for resolver decisions. A revision SHALL record raw-evidence identity, output definition/key when resolved, mapping confidence, registry version, resolver version, normalization schema version, verification status, and promotion state.

#### Scenario: Reprocessing creates a candidate revision
- **WHEN** an already normalized extracted row is processed with a newer resolver or registry version
- **THEN** the system creates a new candidate normalization revision
- **AND** it does not overwrite the prior revision or active observation automatically

### Requirement: Shadow-mode resolver rollout
The system SHALL support a feature-flagged shadow mode that evaluates the context-aware resolver without changing active observations, trends, or assessment outputs.

#### Scenario: Shadow result differs from legacy alias result
- **WHEN** the shadow resolver produces a different measurement definition than the legacy alias resolver
- **THEN** the difference is recorded for review or metrics
- **AND** the user's active observation and score remain unchanged
