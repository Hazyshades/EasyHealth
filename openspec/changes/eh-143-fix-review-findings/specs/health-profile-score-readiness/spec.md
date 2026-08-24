# Delta Spec: health-profile-score-readiness

## ADDED Requirements

### Requirement: System drawer status labels derive from the canonical helper
The Health Profile system drawer SHALL render its assessment status chip exclusively from the canonical `assessmentStatusLabel(state_score, data_confidence)` helper bound to a local variable inside the component. The rendered chip SHALL NOT resolve to an ambient or global identifier and SHALL NOT be empty for any rendered system.

#### Scenario: Incomplete named-system drawer shows unavailable label
- **WHEN** a named system with an unsatisfied required group is opened in the drawer
- **THEN** the status chip renders the canonical label `Assessment unavailable`
- **AND** the chip text is non-empty regardless of browser globals

#### Scenario: Scored system drawer shows its status
- **WHEN** a named system with complete readiness groups is opened in the drawer
- **THEN** the status chip renders the canonical label derived from that system's numeric score and data confidence

### Requirement: Readiness-driven drawer states remain visible
The drawer SHALL continue to render readiness-driven states from machine-readable reasons: missing-group guidance lists each unsatisfied group, invalid notices identify present-but-unusable keys, and an `outdated` reason suppresses score presentation while stating the previous score is not shown as current.

#### Scenario: Outdated system drawer withholds score and explains why
- **WHEN** a persisted assessment is superseded by a non-succeeded recalculation job
- **THEN** every named-system drawer shows `Assessment unavailable` as the status chip
- **AND** displays updating-state copy stating the previous score is not shown as current
- **AND** factual markers, data confidence, and source information remain visible
