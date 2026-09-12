# Delta Spec: health-profile-score-readiness-policy

## ADDED Requirements

### Requirement: Score and readiness evaluation has one policy owner

The system SHALL evaluate admitted Assessment candidates through `evaluateHealthProfileScorePolicy`. That policy SHALL own latest-by-identity selection, factual freshness, required-group readiness, numeric score contribution, data confidence, score exclusions, provenance, and profile-level aggregates. Admission, observation loading, profile assembly, lifecycle state, and presentation SHALL remain outside the policy.

#### Scenario: Builder delegates complete admitted facts

- **WHEN** `buildHealthProfile` receives admitted Registry 2.0 observations
- **THEN** it prepares Assessment candidates and delegates score/readiness evaluation to the policy
- **AND** it assembles the existing public `HealthProfileResult` without reselecting contributors or recomputing aggregates

#### Scenario: Unadmitted direct input stays outside policy evaluation

- **WHEN** a direct builder input is instrumental, unresolved, provisional, or lacks a reviewed Registry definition
- **THEN** the admission boundary does not create an Assessment candidate for it
- **AND** the policy receives only admitted candidates

### Requirement: Candidate identity selection preserves existing recency behavior

The policy SHALL select one candidate per `(assessment_input_key, specimen, modifier)` identity. Complete calendar dates SHALL outrank incomplete dates, complete dates SHALL use the existing lexical comparison, and the existing `observation_id:document_id` lexical tie-break SHALL be preserved. When all comparison fields are identical, input order SHALL remain the effective tie behavior.

#### Scenario: Latest candidate wins within one identity

- **WHEN** two admitted candidates share an identity and one has a later complete observation date
- **THEN** the later candidate is the selected marker
- **AND** only the selected candidate can contribute to that identity's readiness or score

#### Scenario: Identical tie fields remain input-order dependent

- **WHEN** two candidates share an identity and have identical date, observation-id, and document-id comparison fields
- **THEN** the first candidate in the supplied input remains selected
- **AND** the policy does not invent a new tie-breaker

### Requirement: Freshness uses explicit evaluation context

The policy SHALL use `context.asOf` for every factual freshness decision. `context.evaluatedAt` SHALL be retained as computation/provenance metadata and SHALL NOT affect freshness, readiness, score, confidence, or aggregate values. The policy SHALL use the supplied versioned freshness policy and read-only Registry 2.0 snapshot.

#### Scenario: Evaluation timestamp does not change a score

- **WHEN** the facts, `asOf`, freshness policy, and Registry snapshot are identical but `evaluatedAt` differs
- **THEN** the score/readiness projection is identical
- **AND** only computation/provenance timestamp metadata may differ

#### Scenario: Unknown and outdated dates remain distinct

- **WHEN** a required candidate has no complete medical date
- **THEN** its required group reports `unknown_date`
- **AND** the system remains unavailable for scoring

- **WHEN** a required candidate is older than the configured freshness boundary
- **THEN** its required group reports `outdated`
- **AND** the system remains unavailable for scoring

### Requirement: Required groups and contribution eligibility preserve policy boundaries

A named system SHALL be scoreable only when every Registry-defined required group is satisfied. Approved alternatives SHALL satisfy only their own group. A candidate SHALL satisfy a required group only when it is current, numeric, core, reference-backed, and specimen-compatible. The existing readiness reason precedence SHALL remain `missing`, `unknown_date`, `outdated`, then `invalid`.

#### Scenario: Context-only evidence cannot unlock readiness

- **WHEN** a system has a context-only marker but a required group has no approved candidate
- **THEN** that group reports `missing`
- **AND** the system score is `null`

#### Scenario: Invalid required evidence remains explanatory

- **WHEN** a required candidate is present but lacks a usable document reference, has an incompatible specimen, or is nonnumeric
- **THEN** the group reports `invalid` unless a higher-precedence date reason applies
- **AND** the system score is `null`
- **AND** the candidate remains visible through readiness/provenance evidence

### Requirement: Scores, confidence, provenance, and aggregates share selected facts

The policy SHALL compute score contribution, data confidence, contributors, score exclusions, per-system provenance, overall confidence, and the overall score from the same selected marker set. The overall score SHALL remain `null` unless at least three named systems are scoreable. Existing score formulas, rounding, contribution groups, exclusion reason ordering, and algorithm version SHALL remain unchanged.

#### Scenario: Complete systems produce the existing aggregate

- **WHEN** at least three named systems satisfy all required groups
- **THEN** each scoreable system has its existing numeric score and provenance
- **AND** the overall score is the rounded average of those system scores
- **AND** `scoreable_named_system_count` reflects exactly those systems

#### Scenario: Fewer than three systems do not produce an overall score

- **WHEN** fewer than three named systems are scoreable
- **THEN** the per-system results remain available
- **AND** `overall_state_score` is `null`

### Requirement: Factual marker status is neutral and shared

The system SHALL classify numeric values against their printed reference bounds through one neutral marker-status classifier. Numeric values within a usable bound SHALL be `in_range`, numeric values outside a bound SHALL be `out_of_range`, and text, qualitative, null, or range-less values SHALL be `unknown`. Text markers SHALL retain `value: null` and SHALL NOT contribute to a numeric score.

#### Scenario: Text marker cannot become a score contributor

- **WHEN** an admitted comparator or detection-limit result has `value_kind: text`
- **THEN** its factual status is `unknown`
- **AND** its numeric value remains `null`
- **AND** it is excluded from numeric score contribution

### Requirement: Lifecycle state is separate from factual readiness

Queued or processing assessment recalculation state SHALL be supplied by the lifecycle path and SHALL NOT be inferred from score-readiness reasons. When a completed assessment exists, its scores and provenance SHALL remain visible while the lifecycle display state reports the update. Observation-level `outdated` and `unknown_date` SHALL continue to make the affected readiness evaluation unavailable.

#### Scenario: Processing retains the completed score

- **WHEN** a completed assessment has a numeric system score and a newer recalculation is queued or processing
- **THEN** the completed score and canonical status label remain visible
- **AND** the lifecycle state reports the update separately
- **AND** the policy does not convert the lifecycle state into an observation-level readiness reason

### Requirement: Public and persisted contracts remain compatible

The external `HealthProfileResult` and `SystemInsight` shapes SHALL remain unchanged. Existing persisted Health Profile payloads SHALL remain readable. Newly computed results SHALL carry the existing score and freshness metadata. Unknown historical payloads SHALL NOT be relabeled with the current algorithm version solely because they are read.

#### Scenario: Existing consumer shape remains stable

- **WHEN** a consumer reads a profile assembled through the new policy seam
- **THEN** it receives the existing system, marker, provenance, exclusion, score, freshness, source, and aggregate fields
- **AND** no new required public field is introduced
