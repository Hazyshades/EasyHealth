## ADDED Requirements

### Requirement: The specimen axis may be satisfied by a reviewed panel policy

The specimen axis SHALL be satisfiable either by a specimen the document states or by a reviewed panel specimen policy that matches the row's captured heading and lists the candidate's analyte. Both SHALL clear the missing-axis set, and the two SHALL be recorded distinctly in candidate evidence so that a reader can always tell which applied. No other source SHALL satisfy the specimen axis; in particular an extraction model's unevidenced value SHALL NOT, as required by the stated-evidence boundary.

#### Scenario: Policy satisfies the axis

- **WHEN** a haematology candidate is evaluated for a row printed under a matching complete-blood-count heading
- **THEN** the specimen axis is satisfied
- **AND** the candidate evidence records `specimen_from_reviewed_panel`

#### Scenario: Outcome parity with a stated specimen

- **WHEN** the same row is evaluated once with the specimen printed in its snippet and once supplied by the policy
- **THEN** both produce the same selected measurement definition key
- **AND** the two evaluations differ only in the specimen evidence code and its weight

#### Scenario: Neither source available

- **WHEN** a row states no specimen and matches no policy
- **THEN** the specimen axis remains missing and the outcome is not `resolved`

#### Scenario: A policy cannot rescue an otherwise inadmissible candidate

- **WHEN** a candidate would remain below the concrete-resolution bar with a stated specimen
- **THEN** it MUST also remain below the bar with a policy-derived specimen
