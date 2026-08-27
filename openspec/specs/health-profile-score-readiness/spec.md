# Health Profile score readiness

## Purpose

Define the delivered Health Profile contract for complete Registry-approved readiness, nullable current-state scores, machine-readable readiness reasons, and suppression of stale persisted assessments.

## Requirements

### Requirement: Named-system scoring requires complete approved readiness groups
The Health Profile SHALL evaluate each of the eight named body systems against the reviewed Registry 2.0 readiness groups for that system. A numeric `state_score` SHALL be returned only when every required group has one usable `core` alternative. An alternative is usable only when it has a finite numeric value, matches its reviewed specimen policy, and has at least one document-native numeric reference bound.

#### Scenario: One required group is absent
- **WHEN** an admitted named-system observation set does not contain any alternative from one required group
- **THEN** that system's `state_score` is `null`
- **AND** the system includes exactly one readiness reason with code `missing` and that required group
- **AND** no partial average or `0` is returned as a substitute score

#### Scenario: Required alternatives satisfy one group
- **WHEN** a required group contains multiple approved alternatives and one usable alternative is present
- **THEN** that group is satisfied
- **AND** no sibling alternative is required for readiness
- **AND** the selected alternative does not satisfy a different required group

#### Scenario: All eight named systems have incomplete evidence
- **WHEN** each named system lacks at least one required group
- **THEN** all eight named systems are returned with `null` scores
- **AND** the overall score is `null`

### Requirement: Unusable present alternatives expose invalid readiness reasons
The Health Profile SHALL distinguish a missing required group from a group with present but unusable alternatives. A present alternative that is nonnumeric, is a printed comparator or detection-limit result, lacks usable document-native reference bounds, has a mismatching reviewed specimen, or otherwise fails the usability predicate SHALL not unlock a score.

#### Scenario: Required alternative lacks a usable reference range
- **WHEN** a required alternative is present but has neither document-native reference bound
- **THEN** that group is not satisfied
- **AND** the system includes exactly one readiness reason with code `invalid`
- **AND** the reason identifies the group and the present alternative keys
- **AND** the system's score is `null`

#### Scenario: Context-only measurement is present
- **WHEN** an admitted context-only or contribution-only measurement is present while a required group is missing
- **THEN** that measurement does not satisfy the missing group
- **AND** the readiness reason remains `missing`

#### Scenario: Censored threshold result is present
- **WHEN** a required alternative is present as printed comparator text such as `< 0.20`
- **THEN** that alternative is not usable
- **AND** that group is not satisfied by the censored result
- **AND** the system's score is not unlocked by inventing a magnitude from the comparator

### Requirement: Health Profile API returns a canonical null-result contract
Each named-system entry in `GET /api/health-profile` SHALL include `score_readiness.required_groups` and ordered `score_readiness.reasons`. The API SHALL use only the `satisfied`, `missing`, and `invalid` group statuses and SHALL NOT emit the retired `missing_groups` or `present_without_reference` fields. `overall_state_score` SHALL be numeric only when at least three named systems currently have numeric scores.

The same response SHALL include the reported-results summary defined by `health-profile-reported-results`. `profile_display_state` SHALL distinguish `onboarding`, `no_recognized_biomarkers`, `reported_but_not_scoreable`, and `body_map` without using a raw reported count to unlock a score. `reported_but_not_scoreable` SHALL mean that processed profile-owned documents contain at least one current reported laboratory row but zero assessment-eligible laboratory inputs; it SHALL never mean that the raw rows were clinically verified.

#### Scenario: Incomplete evidence reaches the API
- **WHEN** an authenticated Health Profile request has a persisted or fallback assessment with an unsatisfied required group
- **THEN** the API response includes `state_score: null` for that system
- **AND** exposes its machine-readable readiness reason
- **AND** does not expose a partial numeric system or overall score

#### Scenario: Reported rows do not become a score
- **WHEN** an authenticated profile has processed reported laboratory rows but no assessment-eligible laboratory input
- **THEN** the response reports `profile_display_state: "reported_but_not_scoreable"`
- **AND** reports a positive `reported_results.reported_count` and zero `ready_for_scoring_count`
- **AND** leaves all affected system and overall scores governed by the existing readiness and eligibility contract

#### Scenario: Mixed raw and eligible evidence preserves score boundaries
- **WHEN** a profile has both assessment-eligible observations and unresolved reported rows
- **THEN** the API preserves numeric scores only for systems that satisfy the existing complete required groups
- **AND** the reported-results summary exposes the unresolved counts
- **AND** unresolved rows remain excluded from scores, trends, conversions, reports, and assessment calculations

### Requirement: Outdated assessment snapshots suppress scores
The API SHALL not present a persisted numeric assessment as current when its recalculation job exists and its status is not `succeeded`. It SHALL set `assessment_freshness` to `outdated`, set named-system and overall scores to `null`, and append one `outdated` reason to each named system. The response SHALL retain factual markers, data confidence, and the operational `assessment.status`.

#### Scenario: Recalculation is queued after a persisted assessment
- **WHEN** the latest persisted Health Profile assessment has a corresponding recalculation job with status `queued`, `processing`, `retryable_failed`, or `failed`
- **THEN** the response reports `assessment_freshness: "outdated"`
- **AND** every named system has `state_score: null` and an `outdated` readiness reason
- **AND** `overall_state_score` is `null`

#### Scenario: Persisted assessment is current
- **WHEN** the latest persisted Health Profile assessment has no recalculation job or a job with status `succeeded`
- **THEN** the response reports `assessment_freshness: "current"`
- **AND** score availability is determined solely by the completed readiness evaluation
