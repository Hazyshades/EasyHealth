## ADDED Requirements

### Requirement: Stage B owns final release-evidence reconciliation

After Stage A has declared the canonical baseline and pending ledger, only `reconcile-sprint-one-release-evidence` MUST attach final attributable evidence, reconcile canonical EH-104 status, perform reference-safe backup cleanup, and convert formal Sprint 1 / production status to Go.

#### Scenario: Stage A alone is complete

- **WHEN** Stage A has merged and remediation evidence is not yet complete
- **THEN** formal Sprint 1 / production status remains No-Go
- **AND** Stage B has not marked mandatory gates passed

### Requirement: Formal closure requires every mandatory gate

Formal Sprint 1 production/closure status MUST change to Go only when PRs 1–4 and every mandatory CI/developer, target-database, manual interface, OpenSpec, and release gate have attributable passed evidence recorded by Stage B.

#### Scenario: All mandatory gates pass

- **WHEN** evidence review finds every mandatory gate passed with valid attribution and no PHI/broken links/DAG violations
- **THEN** Stage B reconciles canonical tasks, updates roadmap/release records, and closes Sprint 1
