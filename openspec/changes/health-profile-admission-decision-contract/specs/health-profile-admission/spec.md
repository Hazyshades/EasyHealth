## ADDED Requirements

### Requirement: Admission returns a typed decision with canonical evidence

The system SHALL expose a Health Profile laboratory admission projector that returns either an `accepted` decision containing the exact Health Profile input or an `excluded` decision containing the canonical assessment exclusion reason. Both decisions SHALL retain the outcome, binding, verification, resolver evidence, candidate evidence, resolution versions, and incomplete reason used to reach the decision.

#### Scenario: Eligible numeric observation is accepted

- **WHEN** a persisted laboratory observation has an active resolved Registry 2.0 revision, a matching selected candidate, a reviewed compatible assessment binding, an eligible verification status, a finite numeric value, and a usable document reference range
- **THEN** the admission decision SHALL be `accepted`
- **AND** the decision SHALL contain the assessment input key and the presented Health Profile input
- **AND** the decision evidence SHALL retain the resolved outcome and resolver versions

#### Scenario: First failing assessment gate determines exclusion

- **WHEN** a laboratory observation fails an assessment eligibility gate
- **THEN** the admission decision SHALL be `excluded`
- **AND** its reason SHALL equal the first-failure `AssessmentExclusionReason` produced by `evaluateAssessmentEligibility`
- **AND** no snapshot consumer SHALL re-run the eligibility predicate to derive a competing reason

#### Scenario: Resolver candidates survive admission projection

- **WHEN** the persisted resolver evidence contains candidate evidence and version metadata
- **THEN** the admission evidence SHALL expose those candidates and versions unchanged
- **AND** candidate evidence SHALL not be inserted into the canonical snapshot hash

### Requirement: Censored laboratory markers remain accepted text evidence

The system SHALL preserve comparator or detection-limit laboratory values as accepted text markers when identity, binding, and verification gates pass, even when the printed document range is missing or inverted.

#### Scenario: Censored marker with a valid range

- **WHEN** a bound laboratory result such as `< 0.20` has a reviewed compatible assessment binding and a valid printed range
- **THEN** the admission decision SHALL be `accepted`
- **AND** the input SHALL have `value: null`, `value_kind: "text"`, and the original comparator text in `value_text`
- **AND** the marker SHALL not be a numeric score or trend contributor

#### Scenario: Censored marker with missing or inverted range

- **WHEN** a bound comparator result has no printed endpoints or has inverted printed endpoints
- **THEN** the admission decision SHALL remain `accepted` with `non_numeric_value` evidence
- **AND** missing endpoints SHALL remain null
- **AND** finite printed inverted endpoints SHALL remain available as factual marker evidence

#### Scenario: Unverified censored marker is excluded

- **WHEN** a comparator result fails verification before the non-numeric branch
- **THEN** the admission decision SHALL be `excluded` with `verification_required`
- **AND** no text marker SHALL enter Health Profile assessment input

### Requirement: Snapshot reuses admission without changing reported-result policy

The shared Health Profile snapshot SHALL compute one admission decision per persisted laboratory observation and reuse it for direct inputs, score exclusions, and linked reported-result rows. Assessment admission SHALL NOT gate reported-result visibility, outcome buckets, or source-document counts.

#### Scenario: Linked reported row reuses the cached decision

- **WHEN** an extracted laboratory row links to a persisted observation already present in the snapshot decision map
- **THEN** the reported row SHALL reuse that observation's outcome and accepted input decision
- **AND** the snapshot SHALL not re-project the same persisted observation for another consumer

#### Scenario: Unlinked extracted row remains report-only

- **WHEN** an extracted row has no linked persisted observation
- **THEN** the snapshot MAY use a preview outcome for reported-result classification
- **AND** the row SHALL have no Health Profile assessment input
- **AND** the row SHALL remain subject to reported-result visibility and bucket policy

#### Scenario: Reported counts remain independent

- **WHEN** a linked observation is excluded from Health Profile admission
- **THEN** the reported row SHALL remain visible when its reported-result outcome permits visibility
- **AND** reported counts and bucket classifications SHALL be computed by `projectHealthProfileReportedResults`, not by the admission decision

### Requirement: Snapshot compatibility is regression-tested

The admission migration SHALL preserve the existing snapshot hash fields, score-exclusion mapping, and fixed baseline output. The `ready_for_scoring_count` policy SHALL remain unchanged until a separate specification changes it.

#### Scenario: Fixed baseline remains identical

- **WHEN** the admission baseline verifier runs against the checked-in pre-change fixture and expected output
- **THEN** inputs, exclusions, reported rows, reported counts, and the snapshot hash SHALL match exactly
- **AND** the verifier SHALL report the before/after values for human review
