## ADDED Requirements

### Requirement: Sprint 1 issue closeout uses CI as database authority

When a developer workstation cannot run Docker or local Supabase, Sprint 1
roadmap closeout for EH-103, EH-105, and EH-104 SHALL accept the GitHub Actions
database job as the required database proof. Local `supabase db reset` and
local `supabase test db` SHALL NOT be required gates for issue closure on that
workstation.

#### Scenario: Closeout without local Supabase

- **WHEN** the operator documents that local Docker/Supabase is unavailable
- **THEN** closeout proceeds using static verification plus CI database job
  results
- **AND** issue comments record CI-only database evidence explicitly

#### Scenario: Local database commands are not demanded

- **WHEN** closeout tasks list verification steps
- **THEN** they do not require the developer to run local Supabase database
  tests successfully

### Requirement: EH-103 closes on completed delivery hygiene

GitHub issue #3 (EH-103) SHALL be closed when implementation is already
complete, the OpenSpec change is complete, a delivery comment summarizes
evidence, and the QA checklist notes developer evidence status without marking
unexecuted manual checks as passed.

#### Scenario: EH-103 close

- **WHEN** EH-103 code and OpenSpec tasks are complete and a delivery comment
  is posted
- **THEN** issue #3 may be closed

### Requirement: EH-105 closes with CI-only waiver for local db smoke

GitHub issue #5 (EH-105) SHALL be closable when instrumental identity
implementation and static checks are complete, remaining clean-reset/pgTAP
execution is assigned to CI (or explicitly waived with CI path), and a delivery
comment records that local db smoke was not run due to environment limits.

#### Scenario: EH-105 close with CI waiver

- **WHEN** EH-105 implementation tasks other than local db execution are done
  and CI is configured or green for EH-105 database fixtures
- **THEN** issue #5 may be closed with an explicit CI-only database note

### Requirement: EH-104 Phase B ships before issue close

GitHub issue #4 (EH-104) SHALL not be closed until EH-104 Phase B code is
committed, opened as a pull request, and merged (or explicitly accepted as
merged) with static Phase B verification passing and CI database verification
for EH-104 either green or actively required on that PR. Residual operator
preflight/smoke MAY be noted without blocking close only when CI database proof
exists and no disposable environment is available from the closing workstation.

#### Scenario: EH-104 blocked before merge

- **WHEN** Phase B exists only as local uncommitted files
- **THEN** issue #4 remains open

#### Scenario: EH-104 close after merge and CI

- **WHEN** Phase B is merged and CI database evidence for EH-104 is recorded
- **THEN** issue #4 may be closed with links to PR/CI and residual ops notes if
  any

### Requirement: Closeout PR scope stays on Sprint 1 integrity ship

The closeout pull request SHALL include EH-104 Phase B ship artifacts and
issue-hygiene documentation. It SHALL NOT expand into EH-107 CBC fixtures or
EH-108 ADR content.

#### Scenario: Out-of-scope work stays out

- **WHEN** the closeout PR is prepared
- **THEN** it does not claim EH-107 or EH-108 completion
