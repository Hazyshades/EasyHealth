## ADDED Requirements

### Requirement: Deterministic Registry v1 snapshot

The repository SHALL contain a versioned `v1.0.0` machine-readable snapshot that accounts for every legacy canonical biomarker definition and preserves its canonical key, display name, body system, score role, coverage flag, aliases, optional specimen and tags, conversion policy, equivalence group, and derived status.

#### Scenario: Every current definition is represented

- **WHEN** baseline verification compares the snapshot with `BIOMARKER_DEFINITIONS`
- **THEN** every current canonical key appears exactly once in the snapshot
- **AND** no snapshot key exists without a corresponding v1 definition

#### Scenario: Repeated generation is deterministic

- **WHEN** the baseline is generated twice from identical registry and resolver sources
- **THEN** the canonical JSON content and SHA-256 digest are identical
- **AND** volatile timestamps or local filesystem details do not alter the digest

### Requirement: Legacy resolver behavior baseline

The repository SHALL preserve the effective v1 alias map and named behavioral fixtures for legacy canonical resolution, including normalized alias collisions, canonical-key precedence, missing-value tokens, short chemistry aliases, key/name fallback, and unknown-token behavior.

#### Scenario: JavaScript Map is serialized explicitly

- **WHEN** the generator exports the effective legacy alias map
- **THEN** it serializes sorted map entries or an equivalent deterministic object representation
- **AND** it does not rely on direct `JSON.stringify` serialization of a `Map`

#### Scenario: Ambiguous legacy alias outcome is recorded

- **WHEN** multiple v1 definitions own the same normalized source alias
- **THEN** the baseline lists every owner and the effective legacy resolver outcome
- **AND** the outcome is identified as observed compatibility behavior rather than an approved context-aware mapping

#### Scenario: Missing and chemistry tokens remain distinguishable in the baseline

- **WHEN** fixtures resolve values such as `Na`, `N/A`, `n.a.`, empty input, and an unknown label
- **THEN** each actual v1 result is recorded and verified independently
- **AND** a future behavior change causes baseline verification to fail until explicitly reviewed

### Requirement: Registry v1 audit report

The repository SHALL contain a human-reviewed audit report that inventories all v1 definitions and classifies alias ambiguity, specimen metadata, conversion policy, equivalence groups, derived markers, and breaking-change risks relevant to Registry 2.0.

#### Scenario: Gaps are classified rather than assumed defective

- **WHEN** a definition has no explicit specimen or conversion policy
- **THEN** the audit distinguishes `metadata-gap`, `documented-safe`, and `follow-up-required` cases
- **AND** EH-101 does not silently add medical or normalization behavior to resolve the finding

#### Scenario: Measurement distinctions are documented correctly

- **WHEN** the audit evaluates absolute versus percentage counts, RDW-CV versus RDW-SD, specimen-specific glucose, fasting glucose, or free versus total thyroid measurements
- **THEN** it records the potential identity or compatibility break
- **AND** it does not collapse distinct measurements into an equivalence group merely because they share an analyte family

#### Scenario: Audit summary matches generated facts

- **WHEN** baseline verification checks the audit manifest
- **THEN** definition, system, alias, collision, specimen, conversion, equivalence, and derived counts match generated registry facts

### Requirement: Registry baseline drift verification

The repository SHALL provide generation and read-only check modes and SHALL run baseline drift verification in CI whenever legacy biomarker catalog or normalization sources change.

#### Scenario: Unreviewed catalog drift fails verification

- **WHEN** a canonical definition, alias, conversion, specimen policy, score role, coverage rule, equivalence group, or derived flag changes without regenerating and reviewing the baseline
- **THEN** baseline verification fails with the changed section identified

#### Scenario: Unreviewed resolver drift fails verification

- **WHEN** effective alias resolution or a named resolver fixture changes without an intentional baseline update
- **THEN** baseline verification fails
- **AND** the application runtime is not modified by the verification process

### Requirement: Runtime behavior preservation

EH-101 SHALL NOT change legacy catalog lookup, canonical resolver output, observation storage, read-path grouping, health-profile scoring, or Registry 2.0 promotion behavior.

#### Scenario: Baseline generation is observational

- **WHEN** the snapshot and audit artifacts are generated or verified
- **THEN** no observation, normalization revision, score, trend, API response, or database row is written or changed
- **AND** generated artifacts are not loaded by the application runtime

### Requirement: Traceable Registry v1 release

The completed baseline SHALL be associated with an annotated `registry-v1.0.0` Git tag pointing to the clean commit that contains all baseline artifacts and verification tooling.

#### Scenario: Tag is created only after baseline verification

- **WHEN** the Registry v1.0.0 baseline is released
- **THEN** generation, drift verification, and existing registry checks have passed on the target commit
- **AND** the annotated tag identifies the release as the legacy compatibility baseline, not completion of Registry 2.0

#### Scenario: Published baseline is immutable

- **WHEN** a correction is needed after the tag is published
- **THEN** the existing tag and v1.0.0 artifacts are not rewritten
- **AND** the correction uses a new baseline version or an explicit audit erratum
