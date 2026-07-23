## ADDED Requirements

### Requirement: Sprint 1 has one canonical EH-104 requirement baseline

Before remediation implementation begins, the system of record MUST identify `eh-104-separate-resolver-outcomes-from-verification-status` as the canonical EH-104 requirement baseline. Archived Phase B/closeout artifacts SHALL be historical evidence only, and the `- backup` change SHALL be non-canonical pending reference-safe removal/archive.

#### Scenario: Readiness audit resolves EH-104 scope

- **WHEN** an auditor evaluates a remediation requirement
- **THEN** the active canonical EH-104 proposal/design/spec determines intended behavior
- **AND** conflicting backup or archived task checkboxes do not override it

### Requirement: Baseline declaration and release reconciliation are separate merge stages

Stage A MUST merge before remediation and MUST declare canonical/historical/non-canonical ownership, the corrected dependency DAG, a pending release ledger, and production/Sprint 1 `No-Go`. Stage B MUST merge last and MAY add final evidence/status only after runtime PRs 1–4 and every mandatory target/QA gate have observed results.

#### Scenario: Stage A merges

- **WHEN** no remediation implementation or target smoke has yet passed
- **THEN** canonical ownership and pending gates are recorded
- **AND** no implementation, production, or manual gate is marked passed
- **AND** the reconciliation change remains incomplete

#### Scenario: Stage B is proposed early

- **WHEN** any mandatory remediation, retained-data, target-database, or manual gate lacks passed evidence
- **THEN** formal evidence/status reconciliation and Sprint 1 closure remain blocked

### Requirement: Remediation follows the corrected dependency DAG

FK compatibility and atomic publication MAY begin independently. Durable deletion MUST require atomic publication's shared processing-attempt/write-generation foundation. Strict provenance MUST require durable deletion's direct observation purge and removal of lineage-nulling. Final reconciliation MUST require all four PRs plus mandatory preflight, concurrency/failure, schema-cache/storage, and manual smoke evidence. EH-109 and EH-110 MAY proceed independently; EH-112 and production/Sprint 1 closure remain blocked.

#### Scenario: Durable deletion starts before atomic publication contract exists

- **WHEN** deletion would create a competing attempt/lease/generation authority or cannot fence prepared/current publication
- **THEN** PR 3 implementation is blocked until PR 2 establishes the shared contract

#### Scenario: Strict provenance starts before durable deletion

- **WHEN** document purge still clears immutable `document_id` or lineage on surviving observations
- **THEN** PR 4 deployment is blocked

#### Scenario: Independent roadmap work starts

- **WHEN** EH-109 or EH-110 has no dependency on the remediation runtime contracts
- **THEN** it may proceed without converting Sprint 1 production status to Go

### Requirement: FK alias removal is separately gated

The FK compatibility hotfix MUST NOT include an executable old-alias drop migration. Alias removal SHALL be proposed in a later cleanup change only after every application instance uses the new hint and all target PostgREST/schema-cache reads pass.

#### Scenario: Hotfix package is applied

- **WHEN** old and new application instances may coexist
- **THEN** both relationship names remain valid
- **AND** no in-package migration can remove the compatibility alias

### Requirement: Release gates have attributable typed evidence

Each release gate MUST have a stable id, required classification, typed status (`pending`, `passed`, `failed`, `deferred`, `not_applicable`), environment/build identity, executor, UTC timestamp, action, expected and observed result, and evidence link. A mandatory gate is satisfied only by attributable `passed` evidence.

#### Scenario: CI is green but target smoke was not run

- **WHEN** CI/developer gates pass while target database or manual production gates remain unexecuted
- **THEN** those gates remain pending
- **AND** production/Sprint 1 remains No-Go

#### Scenario: A gate is waived or deferred

- **WHEN** a mandatory gate receives a waiver, deferred status, or unrelated evidence
- **THEN** it is not treated as passed and formal closure remains blocked

### Requirement: Mandatory evidence covers all remediation boundaries

The ledger MUST separately cover PR 1 schema-state/cache/API compatibility; PR 2 populated migration/hash/state/concurrency/failure/reader equivalence; PR 3 retained storage/report/observability preflight, writer drain, deletion races, stable-empty storage, PHI visibility, and cleanup smoke; PR 4 writer/manifest/grant/mutation/projection/purge-removal evidence; strict OpenSpec/reference validation; manual interface smoke; and release monitoring/ownership.

#### Scenario: One PR has implementation evidence but not its target boundary

- **WHEN** code/tests pass but schema cache, retained storage, role grants, or target smoke for that PR is unobserved
- **THEN** the PR's release gate family remains incomplete

### Requirement: QA separates tester actions from developer evidence

Manual QA MUST contain safe preconditions, synthetic test data, numbered product-interface actions, and observable expected results. Migration, grants, concurrency, failure injection, storage inventory, cleanup internals, and database assertions MUST remain in a separate developer-evidence section.

#### Scenario: QA checklist is reconciled

- **WHEN** final evidence is added
- **THEN** manual and developer results remain distinguishable
- **AND** unavailable interfaces are explicitly untested rather than inferred from automation

### Requirement: Backup cleanup is reference-safe

The non-canonical backup MUST remain until repository, issue, QA, roadmap, and archive references are inventoried and migrated and strict validation proves no live dependency. Its task status MUST NOT determine readiness before or after cleanup.

#### Scenario: A live reference points to backup

- **WHEN** Stage B inventory finds a live dependency on the backup path
- **THEN** cleanup remains pending until the reference is migrated and revalidated

### Requirement: Formal closure requires every mandatory gate

Formal Sprint 1 production/closure status MUST remain No-Go unless PRs 1–4 and every mandatory CI/developer, target-database, manual interface, OpenSpec, and release gate have attributable passed evidence.

#### Scenario: All mandatory gates pass

- **WHEN** evidence review finds every mandatory gate passed with valid attribution and no PHI/broken links/DAG violations
- **THEN** Stage B may reconcile canonical tasks, update roadmap/release records, and close Sprint 1
