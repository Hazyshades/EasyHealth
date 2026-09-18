# biomarker-dynamics-report

## ADDED Requirements

### Requirement: Inclusive dynamics period

The Biomarker Dynamics Report SHALL accept an inclusive start and end date and SHALL include only authorized observations whose observed date falls within that period. Undated observations SHALL be excluded from numeric statistics and represented in a limitation.

#### Scenario: Period selector filters points

- **WHEN** a user selects a period with start `2025-01-01` and end `2025-03-31`
- **THEN** observations on both boundary dates are included
- **AND** observations outside the period are excluded from min/max/latest and direction

### Requirement: Deterministic series statistics

Each compatible numeric series SHALL expose point count, minimum, maximum, latest point, native and display units, and a numeric direction of increasing, decreasing, stable, or not available. Direction SHALL use a versioned tolerance entry keyed by exact measurement definition and display unit. The server SHALL order points by `observedAt` ascending and immutable `observationId` ascending in canonical UUID byte order, use that order for the point ledger and chronological first/latest selection, compare those points with `threshold = max(absolute, relative * abs(first))`, classify `abs(delta) <= threshold` as stable, and use strict greater/less comparisons for increasing/decreasing. If no approved entry exists, direction SHALL be `not_available` with a limitation.

#### Scenario: Series has sufficient numeric history and a policy entry

- **WHEN** a compatible series has at least two numeric points in the selected period and a reviewed tolerance entry
- **THEN** min, max, latest, and direction are calculated from the chronological first/latest points using the inclusive threshold formula
- **AND** the result does not use the words improvement, deterioration, treatment response, or diagnosis

#### Scenario: Equal timestamps use stable ordering

- **WHEN** two compatible numeric points have the same observed timestamp
- **THEN** the canonical observation-ID tie-breaker determines their point-ledger order and first/latest selection
- **AND** repeated owner, share, or export reads produce the same statistics and direction


#### Scenario: Series has no approved tolerance

- **WHEN** a compatible series has numeric history but no reviewed tolerance entry for its exact definition/display unit
- **THEN** min, max, and latest are still calculated
- **AND** direction is `not_available`
- **AND** the report explains that an approved numeric threshold is unavailable

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

### Requirement: Authorized comparison provenance

The dynamics projection SHALL consume a server-authorized comparison snapshot carrying `scope_kind` and `scope_document_ids`. A `profile_current` snapshot SHALL contain only currently authorized eligible documents for the authenticated Biomarkers page; a `report_immutable` snapshot SHALL contain only the exact materialized `report_scope_document_ids` supplied by EH-148. It SHALL retain numeric/qualitative candidates, deterministic exclusion reasons (`undated`, `non_numeric`, `ineligible`, `unsupported_unit`), and incompatibility identity for definition, specimen, modifier, method, scale, and unit. It SHALL NOT query raw observations independently, silently discard an excluded candidate without a limitation, or emit a point whose source document is outside the declared scope.

#### Scenario: Excluded and incompatible candidates remain explainable

- **WHEN** an authorized comparison contains an undated, qualitative, ineligible, unsupported-unit, or identity-incompatible candidate
- **THEN** the dynamics DTO emits the corresponding limitation or incompatibility reason
- **AND** no excluded candidate is merged into a compatible series

#### Scenario: Selected report scope excludes another owned document

- **WHEN** the profile owns two eligible documents but the report scope contains only one of them
- **THEN** the comparison snapshot and frozen DTO contain points only from the selected document
- **AND** owner, share, and export reads cannot expose a dynamics point from the other document

### Requirement: Server-authorized dynamics adapters

EH-149 SHALL own a server adapter that resolves the authenticated profile and calls the pure dynamics projection. `GET /api/biomarkers/dynamics` SHALL use `profile_current` scope for the Biomarkers page; the EH-148 report-generation handoff SHALL call the same adapter with `report_immutable` scope and exact document UUIDs. Neither entry point SHALL accept client observations, raw source rows, or a client-generated DTO. The Biomarkers client SHALL render the returned DTO rather than compute statistics, direction, conversion, or series membership.

#### Scenario: Client cannot widen either adapter

- **WHEN** a client submits observations, source rows, or a document outside the authorized page/report scope
- **THEN** the server ignores or rejects the untrusted input and builds the DTO only from server-authorized sources
- **AND** the page and report/share/export outputs contain no injected or out-of-scope point

### Requirement: Frozen dynamics report binding

When EH-148 receives an optional server-authorized `biomarker_dynamics_period` with inclusive UTC `start` and `end` dates plus exact `report_scope_document_ids`, EH-149 SHALL return the authorized scope-constrained DTO together with its schema version, direction-policy version, selected period, and generation metadata to EH-148. EH-148 SHALL persist that extension in the validated report payload. Owner/share/export reads SHALL select the persisted extension through the EH-148 report-read resolver; no client-provided DTO and no raw observation query may replace the bound scope, period, or policy. When the period is omitted, no dynamics extension is created.

#### Scenario: Export reproduces the selected dynamics period

- **WHEN** a report is created with an authorized dynamics period and later exported
- **THEN** the export reads the persisted EH-149 extension, including its selected period and policy metadata
- **AND** a client cannot substitute a different DTO, period, policy, or raw observation set at export time
