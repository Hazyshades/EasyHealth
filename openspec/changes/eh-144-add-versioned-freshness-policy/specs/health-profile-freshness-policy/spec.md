## ADDED Requirements

### Requirement: Versioned technical freshness policy

The Health Profile SHALL expose one explicit freshness policy for each of the eight named body systems. The policy SHALL have a stable version identifier and a maximum age in calendar days. The policy SHALL be documented and presented as a technical current-state assessment rule, not as a diagnosis, disease-risk estimate, or recommended testing interval.

#### Scenario: Policy exposes version and system windows

- **WHEN** the Health Profile freshness policy is loaded
- **THEN** it contains a non-empty version identifier, a finite maximum age for cardiovascular, metabolic, thyroid, liver, kidney, blood, nutrients, and inflammation, and no scoreable freshness window for General

#### Scenario: Policy version changes are explicit

- **WHEN** a freshness threshold or freshness classification rule changes
- **THEN** the policy version is changed so assessments generated under the prior rule remain distinguishable

### Requirement: Source medical date controls freshness

The Health Profile SHALL evaluate freshness from the source medical date (`observed_at`, the measured-at date) only. A complete source calendar date SHALL be compared as a calendar date against the assessment evaluation date. Upload time, processing time, row creation time, and assessment-generation time MUST NOT be used as a substitute medical date.

#### Scenario: Current boundary is inclusive

- **WHEN** a complete source date is exactly the configured maximum age before the evaluation date
- **THEN** the observation is classified as `current`

#### Scenario: Older source date is outdated

- **WHEN** a complete source date is older than the configured maximum age before the evaluation date
- **THEN** the observation is classified as `outdated` and cannot satisfy a score-readiness group

#### Scenario: Source date remains factual provenance

- **WHEN** an observation is classified as `outdated`
- **THEN** its value, source document, and source date remain available to the Health Profile details and are not rewritten or discarded

### Requirement: Unknown dates are fail-closed and distinct

A null, blank, malformed, partial, or otherwise unavailable source medical date SHALL be classified as `unknown_date`. An `unknown_date` observation SHALL NOT satisfy a score-readiness group. The system SHALL distinguish `unknown_date` from `outdated` and from a group with no matching observation.

#### Scenario: Missing source date is not treated as recent

- **WHEN** an eligible observation has no source medical date
- **THEN** its freshness is `unknown_date`, its value remains visible, and it does not satisfy readiness

#### Scenario: Unknown-date readiness is machine-readable

- **WHEN** a required group has matching observations but none has a current source date
- **THEN** the group reports `unknown_date` and the system exposes that group separately from `missing_groups` and `outdated_groups`

#### Scenario: Unknown-date selection is deterministic

- **WHEN** multiple observations for one identity have unavailable dates
- **THEN** the selected observation is independent of database fetch order and uses a stable immutable tie-breaker

### Requirement: Freshness participates in strict readiness

A named system SHALL be scoreable only when every configured required group has a current, numeric, reviewed, specimen-compatible observation with a usable document reference range. An outdated or unknown-date observation SHALL remain visible but SHALL NOT be a satisfying candidate. Readiness SHALL expose separate machine-readable groups for missing, present-without-reference, outdated, and unknown-date evidence.

#### Scenario: Outdated evidence does not create a score

- **WHEN** every candidate for a required group is outdated
- **THEN** the group status is `outdated`, the named system score is `null`, and the outdated marker remains in the system marker list

#### Scenario: Missing evidence remains missing

- **WHEN** no observation matches a required group
- **THEN** the group status is `missing`, the group appears in `missing_groups`, and it is not reported as outdated

#### Scenario: A current alternative satisfies a group

- **WHEN** one alternative in a required group is current and usable while another alternative is outdated
- **THEN** the group status is `satisfied` by the current alternative and the named system may be scoreable if every other group is satisfied

#### Scenario: Range and freshness reasons remain separate

- **WHEN** a matching observation is current but has no usable document reference range
- **THEN** the group status is `present_without_reference` and the observation is not relabeled as outdated or missing

### Requirement: Assessment versions record freshness policy identity

Every persisted Health Profile assessment version SHALL record the freshness policy version in a non-null database field. The serialized assessment payload and API assessment metadata SHALL expose the same policy version and the evaluation date used to classify source dates. The input hash SHALL change when the freshness policy version or evaluation date changes.

#### Scenario: Worker completion stamps the version

- **WHEN** the assessment worker completes a valid snapshot
- **THEN** the immutable assessment version row, serialized payload, and API assessment metadata contain the policy version used by that snapshot

#### Scenario: Existing assessment rows remain queryable

- **WHEN** the EH-144 migration is applied to existing assessment versions
- **THEN** each existing row receives a non-null compatibility policy version without mutating its append-only payload or source observations

#### Scenario: Policy mismatch cannot be hidden by the hash

- **WHEN** a snapshot is generated under a different policy version or evaluation date
- **THEN** its input hash differs from the prior snapshot hash and the worker cannot silently reuse the prior assessment version as the new policy result

### Requirement: Health Profile wording is factual and non-prescriptive

The Health Profile SHALL render outdated and unknown-date evidence with factual labels that distinguish it from missing evidence. The interface MUST NOT tell users to order tests, imply that an outdated source is a diagnosis or danger state, or present an unavailable score as `0/100`. Existing source-document and upload navigation SHALL remain evidence-management actions only.

#### Scenario: Outdated UI state is distinguishable

- **WHEN** a required group has only outdated observations
- **THEN** the Health Profile details state that the data is outdated under the current assessment policy and shows the source observation without an order-test prompt

#### Scenario: Unknown-date UI state is distinguishable

- **WHEN** a required group has an observation with no source medical date
- **THEN** the Health Profile details state that the observation date is unavailable and does not label the evidence as outdated or current

#### Scenario: Incomplete score remains unavailable

- **WHEN** freshness prevents a required group from being satisfied
- **THEN** the body-map score and system score render as unavailable (`—`/equivalent), while the factual marker and readiness explanation remain accessible
