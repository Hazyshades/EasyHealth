## ADDED Requirements

### Requirement: Candidate release corpus execution is non-mutating

The system SHALL provide a reproducible Registry 2.0 candidate-release corpus
runner. A corpus run SHALL evaluate candidate resolution and assessment impact
without writing active observations, normalization revisions, trends,
readiness, scores, manual decisions, or other patient/runtime state.

#### Scenario: Candidate corpus evaluates a release
- **WHEN** an operator runs the candidate-release corpus for a Registry 2.0
  candidate
- **THEN** the runner produces evaluation output without calling acceptance,
  correction, promotion, trend, readiness, score, or manual-decision writers

#### Scenario: Mutation attempt fails the run
- **WHEN** corpus execution attempts to use a prohibited runtime mutation path
- **THEN** the run fails and does not publish a launchable candidate manifest

### Requirement: Launch fixtures represent the required corpus coverage

The candidate corpus SHALL maintain all 44 sample rows with exact label, unit,
value-kind, and missing-context negative cases, plus representative
de-identified documents across target panels, languages, laboratories, and
specialty rows. Fixture validation SHALL reject an unclassified row, a missing
required fixture class, or a malformed expected classification.

#### Scenario: Required fixture coverage is complete
- **WHEN** fixture validation runs on the candidate corpus
- **THEN** it confirms every required sample row and representative document
  class is present with an explicit expected classification

#### Scenario: Missing-context negative is preserved
- **WHEN** a fixture omits context necessary for a concrete Registry 2.0
  definition
- **THEN** the expected result is `partial`, `ambiguous`, or `unmapped` rather
  than an inferred concrete resolution

### Requirement: Candidate report is segmented and reproducible

Each corpus run SHALL publish a candidate manifest and segmented report that
identify the exact candidate/fixture inputs and their hashes. The report SHALL
include raw preservation, recognition, `resolved`/`partial`/`ambiguous`/
`unmapped` outcomes, false concrete resolutions, alias and unit coverage,
processing errors, manual corrections, and assessment impact. Re-running with
the same inputs SHALL produce the same classification and threshold result.

#### Scenario: Same candidate produces the same report result
- **WHEN** the runner is executed twice with identical Registry candidate,
  fixture, policy, and document inputs
- **THEN** both reports have the same classifications, coverage, and threshold
  decision and identify the same input hashes

#### Scenario: False concrete resolution is visible
- **WHEN** a corpus row resolves to a concrete definition contrary to its
  expected classification
- **THEN** the report records it as a false concrete resolution rather than
  hiding it in an aggregate success count

### Requirement: Thresholds and approvals gate launchability

Candidate-release policy SHALL define numerical thresholds and named approval
owners. A candidate SHALL not be marked launchable unless its threshold checks
pass, false-resolution review is approved, mapping classifications are
complete, and every score-affecting binding has recorded approval from its
named owner.

#### Scenario: Unapproved score-affecting binding blocks candidate
- **WHEN** a candidate contains a score-affecting Registry binding without
  the required approval evidence
- **THEN** candidate validation fails and the manifest is not launchable

#### Scenario: Threshold failure blocks candidate
- **WHEN** a segmented metric exceeds its configured numerical threshold
- **THEN** the candidate report records the failed threshold and CI rejects
  release approval

### Requirement: CI publishes and validates release evidence

CI SHALL validate the candidate manifest, coverage report, approval evidence,
and reset/rollback notes. CI SHALL reject missing fixtures, unclassified
results, invalid or missing approvals, unapproved score-affecting changes, or
missing release evidence before a Registry 2.0 candidate can pass its release
gate.

#### Scenario: Complete evidence passes the release gate
- **WHEN** a candidate has complete fixtures, a reproducible passing report,
  approved thresholds, required reviews, and reset/rollback notes
- **THEN** CI publishes the evidence and marks the candidate eligible for the
  Registry 2.0 release gate

#### Scenario: Missing evidence blocks the release gate
- **WHEN** the manifest, coverage report, approval evidence, or reset/rollback
  notes are absent or inconsistent with the candidate inputs
- **THEN** CI fails the release gate
