## ADDED Requirements

### Requirement: Approved score-readiness policy
The Health Profile SHALL maintain a canonical, non-diagnostic policy for the eight named body systems. For every scoreable system, the policy SHALL identify each required measurement group, every approved alternative within that group, the technical rationale for requiring the group, and measurements that are context-only for readiness. The policy SHALL identify inflammation as factual-only and non-scoreable.

#### Scenario: Policy names every system
- **WHEN** a maintainer reviews the score-readiness policy
- **THEN** it lists cardiovascular, metabolic, thyroid, liver, kidney, blood, nutrients, and inflammation
- **AND** every scoreable system has one or more explicit required groups
- **AND** inflammation is explicitly identified as non-scoreable rather than implicitly complete with no groups

#### Scenario: Policy records context-only exclusions
- **WHEN** a reviewed measurement is useful for coverage, display, or score contribution but is absent from a system's required groups
- **THEN** the policy identifies it as context-only for readiness
- **AND** it cannot replace a missing required group

### Requirement: Strict readiness enforcement
The Health Profile SHALL derive score readiness from reviewed Registry 2.0 assessment bindings. A scoreable named system SHALL be ready only when every required group has at least one approved alternative represented by a numeric core observation with a matching reviewed specimen and a document-provided reference bound. A context-only measurement SHALL NOT satisfy a required group.

#### Scenario: One approved alternative satisfies its group
- **WHEN** all other required groups are satisfied and one approved alternative in a required group is usable
- **THEN** that group is satisfied
- **AND** the system may become scoreable without every alternative being present

#### Scenario: Context-only measurement is present
- **WHEN** a required group is missing and only a context-only measurement for that system is usable
- **THEN** the system scoreability is `incomplete`
- **AND** the Health Profile current-state score is `null`

#### Scenario: Required measurement lacks a usable reference
- **WHEN** a required measurement is present but has no document-provided numeric reference bound, is not numeric, is not core, or has a mismatched specimen
- **THEN** it does not satisfy its required group
- **AND** the system remains `incomplete`

#### Scenario: Inflammation remains factual-only
- **WHEN** inflammation contains any supported observation
- **THEN** its scoreability is `non_scoreable`
- **AND** its current-state score is `null`

### Requirement: Approval and regression evidence
The repository SHALL maintain a sign-off matrix identifying the accountable functional roles, the canonical policy, the Registry/runtime evidence, and the state of any external clinical approval. It SHALL provide an executable verification command that detects drift in approved groups, alternatives, context-only exclusions, and non-scoreable inflammation.

#### Scenario: External approval is not evidenced
- **WHEN** no dated Clinical Product approval is available in repository evidence or Issue #41
- **THEN** the sign-off matrix records that approval as pending
- **AND** it does not claim the release gate has passed
