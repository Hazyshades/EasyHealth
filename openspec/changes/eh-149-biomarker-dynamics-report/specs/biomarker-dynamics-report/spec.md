# biomarker-dynamics-report

## ADDED Requirements

### Requirement: Inclusive dynamics period

The Biomarker Dynamics Report SHALL accept an inclusive start and end date and SHALL include only authorized observations whose observed date falls within that period. Undated observations SHALL be excluded from numeric statistics and represented in a limitation.

#### Scenario: Period selector filters points

- **WHEN** a user selects a period with start `2025-01-01` and end `2025-03-31`
- **THEN** observations on both boundary dates are included
- **AND** observations outside the period are excluded from min/max/latest and direction

### Requirement: Deterministic series statistics

Each compatible numeric series SHALL expose point count, minimum, maximum, latest point, native and display units, and a numeric direction of increasing, decreasing, stable, or not available. Direction SHALL use only approved deterministic tolerances for that exact measurement definition.

#### Scenario: Series has sufficient numeric history

- **WHEN** a compatible series has at least two numeric points in the selected period
- **THEN** min, max, latest, and direction are calculated from those points
- **AND** the result does not use the words improvement, deterioration, treatment response, or diagnosis

#### Scenario: Series lacks comparison points

- **WHEN** a series has zero or one numeric point
- **THEN** its statistics reflect the available points
- **AND** direction is `not_available`
- **AND** the report explains why comparison is unavailable

### Requirement: Incompatible series warning

The report SHALL keep observations with incompatible measurement definitions, specimens, modifiers, methods, scales, or units in separate series and SHALL expose a visible incompatibility warning with the grouping reason.

#### Scenario: Same display name has incompatible identity

- **WHEN** two observations share a display name but differ in exact definition or non-convertible unit
- **THEN** the observations are not merged
- **AND** min/max/latest and direction are calculated separately
- **AND** the warning identifies the affected series

### Requirement: Point-level provenance

Every dynamics point SHALL retain observation ID, source document ID, observed date, native value/unit/range, display value/unit, and conversion metadata when conversion was applied.

#### Scenario: User inspects a point

- **WHEN** a user opens the source details for a plotted or tabulated point
- **THEN** the UI shows the source document and date
- **AND** the native value and reference range remain available
- **AND** the displayed conversion does not replace the native evidence
