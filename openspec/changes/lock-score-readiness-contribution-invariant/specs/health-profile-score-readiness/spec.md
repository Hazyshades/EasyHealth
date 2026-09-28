## ADDED Requirements

### Requirement: Every scored readiness key is covered by a contribution group

The Registry 2.0 reviewed assessment bindings SHALL satisfy a structural precondition for every scored named body system: each `assessmentInputKey` collected into a readiness group of that system SHALL also be collected into at least one contribution group of the same system. Both groups are derived from the reviewed bindings, `getRegistryV2ScoreReadinessGroups` grouping by `binding.readinessGroup` and `getRegistryV2ScoreContributionGroups` by `binding.contributionGroup`. A system listed in `NON_SCOREABLE_SYSTEMS`, or a system with no readiness group, is exempt because it declares no readiness condition to cover.

The catalog verification suite SHALL assert this precondition over every named system and SHALL exit non-zero when it is violated, naming the system and the uncovered keys. It SHALL read the groups through the same Registry 2.0 runtime accessors the score/readiness policy imports, so it cannot observe a source the policy does not consume. It SHALL additionally exercise a deliberately violating input and SHALL assert that the same assertion rejects it, so the check cannot pass unconditionally.

This precondition is what makes a numeric `state_score` reachable for a scoreable system. The policy resolves a readiness group and a contribution group through the same usable-marker predicate, so full readiness coverage guarantees at least one contribution resolves, and therefore that `state_score` is numeric whenever `scoreability` is `scoreable`.

#### Scenario: The shipped reviewed bindings satisfy the precondition

- **WHEN** the verification suite reads the groups through the Registry 2.0 runtime accessors and runs against the shipped reviewed assessment bindings
- **THEN** every scored named system's readiness keys are covered by its contribution groups
- **AND** the suite reports no uncovered key for any system
- **AND** the suite exits zero

#### Scenario: A readiness key without a contribution group is rejected

- **WHEN** a binding edit leaves a readiness key with no contribution group of the same system, for example by removing `contributionGroup` from a binding that still declares `readinessGroup`
- **THEN** the verification suite exits non-zero
- **AND** the failure names the affected system and the uncovered readiness key
- **AND** the failure is not reported as a warning or a skipped check

#### Scenario: The check rejects a violating input rather than passing unconditionally

- **WHEN** the suite runs its assertion against a synthetic input in which one scored system's contribution groups are emptied while its readiness groups are intact
- **THEN** the assertion fails
- **AND** the suite asserts that failure, so a suite that could never fail is itself a failure

#### Scenario: A factual-only system is exempt

- **WHEN** the suite evaluates `inflammation`, which is listed in `NON_SCOREABLE_SYSTEMS` and declares no readiness groups
- **THEN** the system is not required to have contribution-group coverage
- **AND** the suite records the exemption in its output rather than passing it over silently

#### Scenario: A scoreable system always yields a numeric score

- **WHEN** the score/readiness policy reports a scored named system with `scoreability` of `scoreable`
- **THEN** `state_score` is numeric
- **AND** the system carries at least one contributor
- **AND** the system carries no exclusion with the reason `score_not_available`
