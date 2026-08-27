## MODIFIED Requirements

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
