## ADDED Requirements

### Requirement: Exact resolved definitions own comparison series

The Biomarkers comparison SHALL include only numeric observations whose current source is eligible for trend consumption and whose active Registry 2.0 outcome exposes an exact resolved `measurement_definition_key`. Observations with different measurement definition keys SHALL never be combined, even when their analyte keys, labels, or laboratory names are similar. Observations without a resolved definition SHALL remain available to factual observation views but SHALL NOT be plotted in a normalized comparison series.

#### Scenario: Repeated compatible definition forms one series
- **WHEN** two current numeric laboratory observations have the same resolved `measurement_definition_key` and compatible presented units
- **THEN** the comparison SHALL include both points in one series ordered by observed date
- **AND** the series SHALL identify the exact measurement definition key

#### Scenario: Different definitions stay separate
- **WHEN** observations represent different resolved definitions such as RDW-CV and RDW-SD
- **THEN** the comparison SHALL expose separate series
- **AND** no line, point list, or series total SHALL combine their values

#### Scenario: Incomplete identity is not trended
- **WHEN** an observation is partial, ambiguous, unmapped, missing an active revision, superseded, or otherwise has `trend_eligible = false`
- **THEN** it SHALL be excluded from comparison series
- **AND** its raw/factual result MAY remain visible in the Biomarkers table

### Requirement: Unit normalization is guarded and unit variants remain truthful

The comparison SHALL use the server-presented value and unit without performing browser-side conversion. Points from different native units MAY share one series only when the existing API has supplied one common displayed unit through a reviewed conversion binding. When no reviewed conversion is available, different display/native units SHALL be represented as separate unit-specific series rather than mixed on one numeric axis.

#### Scenario: Reviewed conversion joins unit variants
- **WHEN** the same resolved measurement definition has observations from different laboratories with different native units
- **AND** each point is `conversion_eligible = true`
- **AND** the API presents one common display unit
- **THEN** the points SHALL be in one normalized series using the presented values and unit
- **AND** each point SHALL retain its original native unit and value

#### Scenario: Missing conversion keeps unit buckets separate
- **WHEN** the same measurement definition has observations with different units
- **AND** a reviewed conversion binding is unavailable for those observations
- **THEN** the comparison SHALL create separate series per normalized displayed/native unit
- **AND** it SHALL not infer a conversion from the definition label, analyte, or unit text

#### Scenario: No conversion metadata preserves native display
- **WHEN** a resolved definition has no reviewed conversion rule
- **THEN** its point SHALL retain the server-presented native value and unit
- **AND** the comparison SHALL mark that series as native rather than claiming normalized values

### Requirement: Every comparison point preserves source-native evidence

Each comparison point SHALL retain its observation id, observed day, displayed value/unit, document-native value/unit, document-native reference low/high values, and source document identity. A missing native range SHALL be represented as unavailable; the comparison SHALL not copy a range from another point or convert a range in the browser.

#### Scenario: Native range differs by laboratory
- **WHEN** two points in one normalized series have different document-native reference ranges
- **THEN** each point SHALL expose its own native low/high range
- **AND** the UI SHALL not render one shared range as if it applied to both documents

#### Scenario: Source navigation is point-specific
- **WHEN** a comparison point has a source document id
- **THEN** the point ledger SHALL offer an accessible source link to `/app/documents/<document-id>`
- **AND** the link label SHALL identify the source document or laboratory

### Requirement: Comparison date selection is inclusive and non-destructive

The Biomarkers comparison SHALL provide optional From and To date selectors for observation dates. A boundary date SHALL be included, an observation without a valid observed day SHALL not be plotted as a dated point, and changing the comparison range SHALL not remove or mutate factual observations in the Biomarkers table.

#### Scenario: Inclusive date range
- **WHEN** a user selects From `2026-01-10` and To `2026-01-20`
- **THEN** points observed on either boundary or between them SHALL remain
- **AND** points outside the range SHALL be excluded from the selected comparison

#### Scenario: Clearing date range restores points
- **WHEN** the user clears both date selectors
- **THEN** all otherwise eligible points for the selected series SHALL return
- **AND** the table's current factual-observation set SHALL remain unchanged

### Requirement: Comparison UI exposes safe series and actionable empty states

The Biomarkers overview SHALL expose a series selector, the selected display unit, whether the values are normalized through a reviewed binding or remain native, per-point native ranges, source navigation, and an explicit state when no eligible numeric points exist for the selected series or date range.

#### Scenario: Selected series shows point evidence
- **WHEN** a selected series has eligible points
- **THEN** the trend chart SHALL plot server-presented numeric values in chronological order
- **AND** an accessible point ledger SHALL show each point's date, displayed value/unit, native range, and source action

#### Scenario: Date range has no points
- **WHEN** a valid selected date range contains no eligible points
- **THEN** the comparison card SHALL explain that no measurements match the selected range
- **AND** it SHALL offer a clear-range action without claiming that no factual observations exist

#### Scenario: No eligible numeric series
- **WHEN** the profile has no current resolved numeric observations eligible for trends
- **THEN** the comparison card SHALL explain that a normalized numeric comparison is unavailable
- **AND** qualitative, unresolved, or source-incomplete facts SHALL not be presented as numeric trend values
