## ADDED Requirements

### Requirement: Every scored readiness key is covered by a contribution group

The Registry 2.0 catalog SHALL satisfy a structural precondition for every scored named body system: each key appearing in a readiness group of that system SHALL also appear in at least one contribution group of the same system. A system listed in `NON_SCOREABLE_SYSTEMS`, or a system whose readiness-group list is empty, is exempt because it declares no readiness condition to cover.

The catalog verification suite SHALL assert this precondition over the whole catalog and SHALL exit non-zero when it is violated, naming the system and the uncovered keys. The suite SHALL additionally exercise a deliberately violating copy of the catalog tables and SHALL assert that the same assertion rejects it, so the check cannot pass unconditionally.

This precondition is what makes a numeric `state_score` reachable for a scoreable system. The policy resolves a readiness group and a contribution group through the same usable-marker predicate, so full readiness coverage guarantees at least one contribution resolves, and therefore that `state_score` is numeric whenever `scoreability` is `scoreable`.

#### Scenario: The shipped catalog satisfies the precondition

- **WHEN** the catalog verification suite runs against the shipped Registry 2.0 catalog tables
- **THEN** every scored named system's readiness keys are covered by its contribution groups
- **AND** the suite reports no uncovered key for any system
- **AND** the suite exits zero

#### Scenario: A readiness key without a contribution group is rejected

- **WHEN** a catalog edit adds a key to a readiness group of a scored system without adding that key to any contribution group of the same system
- **THEN** the catalog verification suite exits non-zero
- **AND** the failure names the affected system and the uncovered readiness key
- **AND** the failure is not reported as a warning or a skipped check

#### Scenario: The check rejects a violating catalog rather than passing unconditionally

- **WHEN** the suite runs its assertion against a synthetic copy of the catalog tables in which one readiness key is removed from its system's contribution coverage
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
