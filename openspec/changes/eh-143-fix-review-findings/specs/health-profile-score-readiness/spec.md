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
The drawer SHALL continue to render readiness-driven states from machine-readable reasons: missing-group guidance lists each unsatisfied group, invalid notices identify present-but-unusable keys, and factual `outdated` or `unknown_date` reasons keep the affected system unscored. Assessment job lifecycle SHALL remain a separate display input and SHALL NOT be inferred from score-readiness reasons.

#### Scenario: Outdated observation remains unscored
- **WHEN** a named system has a required observation older than the configured freshness policy
- **THEN** the affected required group reports `outdated`
- **AND** the system drawer shows `Not scored - outdated data`
- **AND** factual markers, data confidence, and source information remain visible

#### Scenario: Assessment update retains the completed score
- **WHEN** a completed assessment has a numeric system score and a newer recalculation job is queued or processing
- **THEN** the separate lifecycle state is `outdated`
- **AND** the drawer retains the completed numeric score and its canonical status label
- **AND** the lifecycle copy states that the latest completed assessment remains visible while the update is prepared
