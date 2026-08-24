## MODIFIED Requirements

### Requirement: Definition-specific consumer exclusion

The system SHALL derive consumer eligibility from the active reviewed Registry 2.0 binding. Only eligible `resolved` rows SHALL enter definition-specific trend keys or series, conversion, abnormality interpretation, report biomarker context, or structured biomarker context.

Health Profile SHALL additionally require a reviewed assessment binding with `compatibility = compatible` before a row can affect readiness, data confidence, highlighted findings, state scores, or holistic assessment inputs. `partial`, `ambiguous`, and `unmapped` rows SHALL remain list-visible where raw results are shown but SHALL be excluded from all definition-specific consumers with a stable exclusion reason.

The shared identity gates (`no_active_revision`, `incomplete_resolution`, `candidate_only_identity`) SHALL be evaluated exactly once per row by the assessment eligibility predicate, and every consumer exclusion surface SHALL report the same reason code produced by that evaluation for these gates. A laboratory outcome whose assessment eligibility is eligible SHALL expose the `assessmentInputKey` of its reviewed compatible binding.

#### Scenario: Partial row is excluded from trends

- **WHEN** a partial row has a candidate key only in decision evidence
- **THEN** it SHALL remain visible in the result list but SHALL NOT appear in a trend selector or chart series

#### Scenario: Ambiguous row cannot affect assessment

- **WHEN** an ambiguous row has a high mapping confidence for its leading candidate
- **THEN** it SHALL NOT affect Health Profile readiness, confidence, highlights, or scores

#### Scenario: Resolved display-only binding is not score eligible

- **WHEN** a resolved reviewed definition lacks a reviewed assessment-compatible binding
- **THEN** it MAY remain visible and trend-eligible where appropriate but SHALL be assessment-ineligible with `assessment_binding_ineligible`

#### Scenario: Shared gates report one consistent reason

- **WHEN** a laboratory row fails one of the shared identity gates
- **THEN** the trend, report, structured-context, and assessment exclusion surfaces SHALL all report the same reason code from a single evaluation

#### Scenario: Eligible outcome exposes its assessment input key

- **WHEN** a laboratory row passes every assessment eligibility gate
- **THEN** the outcome summary SHALL expose the `assessmentInputKey` of its reviewed compatible binding without a second Registry binding projection
