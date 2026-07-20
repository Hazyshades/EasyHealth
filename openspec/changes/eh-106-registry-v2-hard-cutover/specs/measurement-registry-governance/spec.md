## ADDED Requirements

### Requirement: Minimum hard-cutover corpus has expected per-fixture assertions

The EH-106 candidate-release corpus SHALL include the committed 44 launch fixture rows and committed missing-context/unit negative cases. Every fixture SHALL declare expected resolver outcome, expected analyte and concrete measurement identity when applicable, required null identity when incomplete, expected missing axes or conflicts, and expected value-kind/unit compatibility. The report SHALL compare actual output against each declaration rather than treating aggregate recognition as sufficient.

The minimum gate SHALL require 100% raw-preservation checks, 100% expected-outcome/identity match, 0 false concrete resolutions in negative fixtures, 0 processing errors, and 100% declared fixture coverage.

#### Scenario: Recognized partial fixture is expected

- **WHEN** a fixture intentionally lacks specimen evidence and declares `partial` with no concrete measurement identity
- **THEN** the candidate passes that fixture only when it produces the declared incomplete outcome
- **AND** aggregate recognition alone cannot mark a different concrete resolution as passing

### Requirement: Candidate approval is digest-bound and versioned

Before a hard-cutover candidate manifest is approved, a tracked candidate-release record SHALL bind the manifest digest, resolver and normalization versions, corpus digest, threshold-policy version, report digest, changed-record classifications, score-affecting binding review, approval entries, and reset/rollback notes. Each approval entry SHALL record `approved_by`, role, timestamp, and decision.

The approval record SHALL require a new candidate identity when any digest-bound content changes. A candidate with an unclassified or unapproved score-affecting binding change MUST remain blocked.

#### Scenario: Manifest changes after approval

- **WHEN** a Registry change produces a different manifest digest after an approval record exists
- **THEN** CI rejects the old record as non-matching
- **AND** the changed candidate requires a new report and approval record

### Requirement: EH-106 corpus run is non-mutating and does not auto-promote

The EH-106 runner SHALL evaluate fixture and isolated candidate input without writing active observations, revisions, trends, readiness, scores, or manual decisions. Approval of a release record SHALL NOT itself activate an observation or introduce automatic verification; automatic-verification workflow remains EH-120.

#### Scenario: Candidate report is generated

- **WHEN** CI evaluates a candidate registry/resolver against the minimum corpus
- **THEN** it emits a reproducible manifest/report/approval verification result
- **AND** before-and-after product-data fixtures prove that the corpus path made no active-data mutation

### Requirement: CI enforces minimum cutover evidence on the protected branch

Registry CI SHALL run for pull requests and for pushes that include the repository default branch. It SHALL regenerate the minimum corpus report, validate fixture declarations and threshold results, verify the digest-bound approval record, reject prohibited Registry v1 runtime imports, and publish the candidate manifest/report as build artifacts.

#### Scenario: Default-branch registry change lacks approval evidence

- **WHEN** a Registry change is pushed to the protected default branch without a matching approved candidate-release record
- **THEN** the registry workflow runs on that branch and fails
- **AND** it does not treat a declared fixture name as a passing corpus result

### Requirement: Corpus expansion is an explicit later-roadmap handoff

EH-106 SHALL provide the baseline fixture harness and hard-cutover gate only. Multilingual, multi-laboratory, specialty-document, expanded resolver-policy, decision-trace, UX/metrics, and reprocessing coverage SHALL be extended by EH-107 through EH-116. The initial gate MUST NOT claim that those later corpus dimensions are already complete.

#### Scenario: A later language fixture is added

- **WHEN** EH-107 through EH-116 add a language, laboratory, specialty, or reprocessing fixture
- **THEN** it extends the same versioned corpus contract
- **AND** the EH-106 baseline approval record is not retroactively represented as coverage for that new fixture
