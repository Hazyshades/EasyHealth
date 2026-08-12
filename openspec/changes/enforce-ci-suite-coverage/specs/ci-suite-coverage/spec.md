## ADDED Requirements

### Requirement: Verification suite inventory is complete

The repository SHALL expose a deterministic CI coverage check that enumerates every `test:*` script in `package.json`, resolves its transitive TypeScript and SQL verification files, and compares those files with the commands reachable from the configured GitHub Actions workflows. The check SHALL fail closed when it cannot understand a workflow command or package-script form.

#### Scenario: A new test script has no workflow runner

- **WHEN** a `test:*` package script or one of its verification files is added without a reachable workflow command and without a declared exception
- **THEN** the CI coverage check fails
- **AND** the report names the orphan script and underlying verification file

#### Scenario: An existing workflow aggregator covers a test file

- **WHEN** a workflow invokes a package script that transitively executes a verification file referenced by a `test:*` script
- **THEN** the coverage check counts that file as covered
- **AND** it does not require a redundant dedicated workflow step

### Requirement: Local-only verification is explicit

A verification suite MAY be excluded from CI only when it appears in a versioned local-only policy with a non-empty reason and the coverage report includes that disposition. An unclassified missing runner SHALL be an error. The issue-110 release suites SHALL NOT be classified local-only solely to bypass a failure.

#### Scenario: A suite is explicitly local-only

- **WHEN** a test script is listed in the local-only policy with a reviewable reason
- **THEN** the coverage check reports it as local-only
- **AND** the check does not report it as an orphan

#### Scenario: A local-only entry is removed from the package

- **WHEN** the policy names a suite that no longer exists
- **THEN** the coverage check fails with a stale-policy error

### Requirement: Release-relevant suites run in compatible CI environments

The Measurement Registry workflow SHALL execute the seven suites identified by issue #110 in environments that satisfy their runtime requirements: pure verification suites in the verify job, pgTAP suites after local Supabase database startup, and the PostgREST embedding suite against a real full-stack endpoint. A workflow step SHALL fail the job on a non-zero result.

#### Scenario: Pure verification suites execute in CI

- **WHEN** the verify job runs
- **THEN** it executes `test:document-worker`, `test:eh113`, and `test:eh116`
- **AND** dummy environment values are used only where module loading requires them

#### Scenario: Database suites execute against the local database

- **WHEN** the database job runs
- **THEN** it executes `test:eh113-db`, `test:eh116-db`, and `test:pr2-db` after local Supabase database startup
- **AND** the stack is stopped even when a test fails

#### Scenario: PostgREST integration executes against a real endpoint

- **WHEN** the integration job runs `test:postgrest-embeds`
- **THEN** the endpoint and service-role key are real local-stack values rather than `ci-placeholder` values
- **AND** the job stops the full stack after success or failure

### Requirement: CI coverage protects generated Registry 2.0 evidence

The coverage check SHALL treat generated Registry 2.0 documentation, multilingual alias/corpus validation, and local Wiki-export derivation as repository verification inputs without reading or mutating the remote Wiki. The typed catalog and canonical `docs/` outputs remain the source of truth; Wiki pages remain generated mirror output.

#### Scenario: The Registry 2.0 catalog expands

- **WHEN** catalog definitions, EN/RU/ES aliases, corpus fixtures, or generated documentation checks change
- **THEN** the existing baseline, generated-output, and technical corpus contracts remain reachable from CI
- **AND** coverage is derived from package scripts and workflow commands rather than a copied count or hand-maintained biomarker list

#### Scenario: Wiki output is validated

- **WHEN** the local Wiki exporter or staging contract runs
- **THEN** it derives pages from canonical generated documentation
- **AND** it performs no remote Wiki mutation
- **AND** its approval-status text is not used as evidence that technical verification or release launchability passed

### Requirement: Coverage regressions are mutation-tested

The CI coverage verifier SHALL have deterministic contract tests for unrunnered scripts, explicit local-only entries, nested package scripts, workflow command blocks, and the required issue-110 job assignments.

#### Scenario: A runner is removed from the workflow fixture

- **WHEN** a fixture removes the workflow command for a covered test script
- **THEN** the coverage contract fails and names the missing runner

#### Scenario: A new workflow command covers a suite

- **WHEN** a fixture adds a supported workflow command for a previously orphaned test script
- **THEN** the coverage contract reports the suite as covered without changing the package script's source file

### Requirement: Issue closure requires complete evidence

Issue #110 SHALL remain open until the coverage report, all seven required suite results, known-failure triage, and a successful GitHub Actions run are recorded. A maintainer MAY close the issue only after those artifacts are reviewable and no required suite is hidden by `continue-on-error` or an undocumented exception.

#### Scenario: Coverage and suites are green

- **WHEN** every required suite is covered, the known failures are resolved or contractually triaged, and the complete workflow passes
- **THEN** the maintainer can publish the evidence comment and close issue #110

#### Scenario: A required suite is still red or orphaned

- **WHEN** any required suite fails, is skipped, or lacks a workflow runner
- **THEN** issue #110 remains open
- **AND** the release workflow does not claim complete CI verification
