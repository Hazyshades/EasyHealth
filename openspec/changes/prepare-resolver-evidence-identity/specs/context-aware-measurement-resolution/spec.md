## ADDED Requirements

### Requirement: Resolver consumes one prepared evidence record

The Resolver SHALL consume a prepared evidence record whose stated-axis filtering and reviewed panel-policy admission have already completed. It SHALL NOT re-run panel-policy admission from raw captured heading text. The prepared record SHALL retain whether an effective specimen was stated, supplied by a reviewed policy, absent, or blocked by a policy conflict.

#### Scenario: Prepared policy context is authoritative

- **WHEN** a prepared CBC row carries a reviewed policy key and effective `whole_blood` specimen
- **THEN** Resolver evaluation SHALL use that prepared policy context
- **AND** it SHALL not re-match the raw CBC heading to derive a second specimen

#### Scenario: Policy conflict remains incomplete

- **WHEN** preparation finds multiple applicable reviewed panel policies for a captured heading
- **THEN** the prepared record SHALL retain a `conflict` context
- **AND** Resolver evaluation SHALL not fabricate an effective specimen or return a concrete mapping from that conflict

#### Scenario: Equivalent policy forms remain deterministic

- **WHEN** two headings match different reviewed forms of the same policy for the same analyte
- **THEN** both Resolver evaluations SHALL receive equivalent policy context
- **AND** the policy context SHALL not depend on the raw heading spelling
