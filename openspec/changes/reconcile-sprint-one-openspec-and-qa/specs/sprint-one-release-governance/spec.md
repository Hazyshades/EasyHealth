## ADDED Requirements

### Requirement: Sprint 1 has one canonical EH-104 requirement baseline

Before remediation implementation begins, the system of record MUST identify `eh-104-separate-resolver-outcomes-from-verification-status` as the canonical EH-104 requirement baseline. Archived Phase B/closeout artifacts SHALL be historical evidence only, and the `- backup` change SHALL be non-canonical pending reference-safe removal/archive.

#### Scenario: Readiness audit resolves EH-104 scope

- **WHEN** an auditor evaluates a remediation requirement
- **THEN** the active canonical EH-104 proposal/design/spec determines intended behavior
- **AND** conflicting backup or archived task checkboxes do not override it

### Requirement: Baseline declaration and release evidence are separate stages

Planning-time baseline declaration MUST occur before implementation and MUST list all remediation and release gates as pending. Final evidence/status reconciliation MUST occur only after runtime PRs 1–4, strict validations, target-database preflight, and manual production smoke have observed results.

#### Scenario: Proposals are validated but code is not implemented

- **WHEN** the five remediation planning changes pass strict OpenSpec validation
- **THEN** the canonical baseline is established for readiness audit
- **AND** implementation, preflight, smoke, and Sprint 1 closure remain pending

#### Scenario: Runtime PRs merge without production smoke

- **WHEN** code and CI are green but target-environment manual smoke has not run
- **THEN** production readiness and formal Sprint 1 closure remain blocked

### Requirement: Release evidence has typed, attributable status

Every release gate MUST record a stable id, owner/change, environment, build/commit, executor, timestamp, action/command, expected result, observed result, artifact link, and one status from `pending`, `passed`, `failed`, `deferred`, or `not_applicable`. Deferred evidence MUST NOT satisfy a mandatory production gate.

#### Scenario: CI database suite passes

- **WHEN** CI completes a database contract suite
- **THEN** only the corresponding developer/CI gate may be marked passed
- **AND** retained-environment preflight and manual UI smoke remain independently pending

#### Scenario: A check is unavailable

- **WHEN** an interface or target environment cannot be exercised
- **THEN** the gate is recorded pending or deferred with reason and owner
- **AND** it is not represented as passed

### Requirement: Formal closure requires the audited DAG

Sprint 1 production readiness and formal closure MUST require the FK compatibility hotfix, atomic instrumental publication, durable deletion, strict provenance, strict OpenSpec validation, target preflight, and manual production smoke. Atomic publication MUST precede durable deletion integration; strict provenance may proceed independently.

#### Scenario: EH-109 or EH-110 development starts

- **WHEN** either independent Sprint 2 item starts in its own branch
- **THEN** this does not satisfy or waive any Sprint 1 production gate

#### Scenario: All mandatory gates pass

- **WHEN** remediation PRs 1–4 and every mandatory target/QA gate have attributable passed evidence
- **THEN** final reconciliation may update canonical status and formal Sprint 1 closure

### Requirement: QA separates tester actions from developer evidence

Manual QA MUST contain safe preconditions, synthetic test data, numbered product-interface actions, and observable expected results. Migration, grants, concurrency, failure injection, and database assertions MUST remain in a separate developer-evidence section.

#### Scenario: QA checklist is reconciled

- **WHEN** final evidence is added
- **THEN** manual and developer results remain distinguishable
- **AND** unavailable interfaces are explicitly untested rather than inferred from automation
