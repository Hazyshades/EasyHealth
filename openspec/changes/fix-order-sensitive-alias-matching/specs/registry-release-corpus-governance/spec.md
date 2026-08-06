## MODIFIED Requirements

### Requirement: Thresholds and approvals gate launchability

Candidate-release policy SHALL define numerical thresholds and named approval owners. A candidate SHALL not be marked launchable unless its threshold checks pass, false-resolution review is approved, mapping classifications are complete, and every score-affecting binding has recorded approval from its named owner.

The candidate input hash SHALL cover the resolver version. A change to the resolver version SHALL therefore invalidate every approval pinned to the previous hash, and the candidate SHALL NOT be launchable until each required approval is re-recorded against the new hash. Re-approval SHALL be an explicit human act; the pipeline MUST NOT rewrite, carry forward, or infer an approval hash.

#### Scenario: Unapproved score-affecting binding blocks candidate
- **WHEN** a candidate contains a score-affecting Registry binding without the required approval evidence
- **THEN** candidate validation fails and the manifest is not launchable

#### Scenario: Threshold failure blocks candidate
- **WHEN** a segmented metric exceeds its configured numerical threshold
- **THEN** the candidate report records the failed threshold and CI rejects release approval

#### Scenario: Resolver-version bump invalidates pinned approvals
- **WHEN** the resolver version changes and the recorded approvals still carry the previous candidate input hash
- **THEN** candidate validation fails with a bound-to-a-different-candidate-input-hash error for each stale approval
- **AND** the manifest is not launchable

#### Scenario: Re-approval restores launchability
- **WHEN** every required approval is re-recorded against the new candidate input hash by its named owner role
- **THEN** candidate validation passes and the manifest may be marked launchable

## ADDED Requirements

### Requirement: Admission-policy changes SHALL be reprocessed under review
A change that alters which candidates the resolver admits SHALL be followed by a reprocessing dry run over the affected scope before any apply. The dry-run diff SHALL be reviewed for regressed resolution, identity change, and lost manual selection, and the review outcome SHALL be recorded as release evidence. An apply SHALL NOT be executed on the basis of an unreviewed dry run.

#### Scenario: Dry run precedes apply
- **WHEN** an admission-policy change is deployed
- **THEN** a reprocessing dry run SHALL be executed and its diff classification counts recorded before any apply

#### Scenario: Regression or lost manual selection halts the apply
- **WHEN** the dry-run diff reports regressed resolution, identity change, or lost manual selection
- **THEN** the apply SHALL be withheld until each affected row is explicitly reviewed
