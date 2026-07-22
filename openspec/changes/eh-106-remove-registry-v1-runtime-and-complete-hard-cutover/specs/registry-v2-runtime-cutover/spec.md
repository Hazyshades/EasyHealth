## ADDED Requirements

### Requirement: Registry 2.0 is the sole runtime laboratory identity authority

The system SHALL resolve laboratory semantic identity at runtime through
Registry 2.0 analytes, measurement definitions, and the active normalization
revision. Application code, workers, APIs, UI code, and normal runtime scripts
SHALL NOT import or invoke Registry v1 fixtures, v1-derived launch catalogs,
adapters, compatibility-only paths, or fallback resolution behavior. Frozen
Registry v1 artifacts MAY be read only by explicitly scoped migration or audit
tooling.

#### Scenario: Runtime resolution uses Registry 2.0
- **WHEN** a laboratory result is normalized during document processing or a
  runtime consumer needs its semantic identity
- **THEN** the result is resolved through Registry 2.0 and no Registry v1
  adapter, generated catalog, or fallback is evaluated

#### Scenario: Forbidden runtime dependency fails verification
- **WHEN** an active application, worker, API, UI, or runtime-script file adds
  a Registry v1 fixture, adapter, or v1-derived launch-catalog dependency
- **THEN** the scoped static Registry v1 verification fails before release

#### Scenario: Frozen snapshot remains available for audit tooling
- **WHEN** an allowlisted migration or audit tool reads the frozen Registry v1
  snapshot
- **THEN** the tool can complete without making the snapshot available to the
  production runtime dependency graph

### Requirement: Legacy runtime controls are removed

The system SHALL remove Registry v1/v2 runtime feature flags, dual-read
telemetry, and compatibility-only control flow. No configuration value SHALL
restore Registry v1 semantic identity after the cutover.

#### Scenario: Removed configuration cannot restore Registry v1
- **WHEN** a deployment supplies a historical Registry resolution-mode or
  fallback configuration value
- **THEN** the runtime does not select or restore a Registry v1 path

#### Scenario: Consumer has no dual-read branch
- **WHEN** a laboratory identity is read by a trend, report, structured
  context, biomarker API/UI, conversion, or assessment consumer
- **THEN** the consumer uses only the Registry 2.0 read model and does not
  emit or compare a Registry v1 result

### Requirement: Consumers use reviewed active Registry 2.0 bindings

Laboratory consumers SHALL derive concrete identity from the active linked
normalization revision and its synchronized observation projection. A concrete
conversion, trend, report assertion, structured-context fact, or assessment
input SHALL require a reviewed Registry 2.0 definition. Consumers SHALL retain
raw evidence for `partial`, `ambiguous`, and `unmapped` outcomes without
inferring a missing specimen, definition, or unit equivalence.

#### Scenario: Reviewed resolved result is available to consumers
- **WHEN** an observation has an active resolved revision with a reviewed
  Registry 2.0 definition
- **THEN** the relevant laboratory consumers receive that Registry 2.0
  identity and binding

#### Scenario: Incomplete raw result remains non-concrete
- **WHEN** an observation is `partial`, `ambiguous`, or `unmapped`
- **THEN** its raw evidence can be displayed or accepted but it does not enter
  concrete conversion or assessment inputs and no missing identity is inferred

#### Scenario: Instrumental observation is excluded from laboratory semantics
- **WHEN** a consumer builds a laboratory marker, conversion, trend, or
  assessment input
- **THEN** it includes only `observation_kind = 'lab'` and does not treat an
  EH-105 instrumental observation as a Registry 2.0 laboratory measurement

### Requirement: Cutover verification proves runtime and consumer behavior

The CI/release verification command SHALL run structural checks for prohibited
Registry v1 runtime dependencies and behavioral regressions for Registry 2.0
consumer behavior. A release candidate SHALL fail verification if either class
of check fails.

#### Scenario: Reintroduced fallback blocks CI
- **WHEN** a change reintroduces a Registry v1 runtime fallback or an
  unreviewed definition reaches a concrete consumer
- **THEN** the cutover verification command fails and the candidate is not
  accepted as release-ready
