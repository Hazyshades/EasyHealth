## ADDED Requirements

### Requirement: Roadmap dependency graph must be a strict DAG

The roadmap issue dependency graph SHALL be a strict directed acyclic graph (DAG).

#### Scenario: Opening any roadmap issue dependencies
- **WHEN** a team member inspects the dependencies of any roadmap issue
- **THEN** no chain of dependencies returns to the same issue
- **AND** automated validation reports zero cycles

### Requirement: Dependency direction must be unambiguous

The notation "EH-X -> EH-Y" SHALL mean that EH-X depends on EH-Y.

#### Scenario: Reading the Dependencies field
- **WHEN** the Dependencies field says "EH-X -> EH-Y"
- **THEN** it SHALL mean EH-X depends on EH-Y
- **AND** EH-X must wait for EH-Y before it can be considered complete

### Requirement: Sprint assignments must be realistic

Sprint assignments SHALL be sized so that no conceptual half-sprint exceeds 28 story points and late-stage sprints are treated as release phases.

#### Scenario: Summarizing sprint load
- **WHEN** story points are summed per conceptual half-sprint
- **THEN** each half-sprint SHALL contain no more than 28 story points
- **AND** Sprints 7 and 8 SHALL be labeled as release phases, not committed two-week sprints

## MODIFIED Requirements

### Requirement: EH-120 defines three independent status fields

EH-120 SHALL define three independent status fields: `resolution_status`, `verification_status` and `record_status`.

#### Scenario: Persisting an observation decision
- **WHEN** the system stores a reviewed or corrected observation
- **THEN** `resolution_status` SHALL be one of `resolved | partial | ambiguous | unmapped`
- **AND** `verification_status` SHALL be one of `pending | user_verified | manually_corrected`
- **AND** `record_status` SHALL be one of `active | rejected | superseded`
- **AND** `rejected` and `superseded` SHALL NOT appear under `verification_status`

### Requirement: EH-102 is closed and #63 is owned by EH-109

EH-102 SHALL be closed as completed and issue #63 SHALL reference EH-109 as its primary owner and EH-112 as a secondary consumer.

#### Scenario: Closing a completed epic
- **WHEN** all checklist items in EH-102 are complete and the matching OpenSpec change is complete
- **THEN** EH-102 SHALL be closed as `completed`
- **AND** issue #63 SHALL reference EH-109 as primary owner and EH-112 as secondary consumer
