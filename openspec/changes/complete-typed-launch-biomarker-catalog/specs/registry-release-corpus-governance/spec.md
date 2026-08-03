## MODIFIED Requirements

### Requirement: Thresholds and approvals gate launchability
Candidate-release policy SHALL define numerical thresholds and named approval owners. A candidate SHALL not be marked launchable unless its threshold checks pass, its required fixture and release artifacts are present, and every required approval is bound to its exact candidate input hash. Unit coverage SHALL measure accepted source-unit evidence for typed candidates; it SHALL NOT require a non-concrete row to become a reviewed concrete runtime identity.

#### Scenario: Typed partial row satisfies unit coverage
- **WHEN** a typed provisional or incomplete reviewed candidate accepts a row's source unit but the resolver correctly returns `partial` because an identity axis is absent
- **THEN** the report counts the row as unit-covered
- **AND** the row remains consumer-ineligible
- **AND** the candidate is still subject to all other threshold and approval checks

#### Scenario: Candidate input changes invalidate approvals
- **WHEN** a catalog definition, corpus row, release policy, document fixture, or reset/rollback note changes
- **THEN** the runner computes a new candidate input hash
- **AND** approvals bound to a prior hash are rejected
- **AND** the candidate is not launchable until the required reviewers approve the new hash

#### Scenario: True unit conflict blocks launchability
- **WHEN** a matched typed candidate rejects the observed unit because its dimension or token is incompatible
- **THEN** the report records the conflict and excludes the row from unit coverage
- **AND** the numerical unit-coverage threshold fails if the configured threshold is no longer met
