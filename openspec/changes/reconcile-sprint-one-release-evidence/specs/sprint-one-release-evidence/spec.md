## ADDED Requirements

### Requirement: Final evidence is attached only after observed gates

Stage B MUST attach attributable evidence for remediation PRs 1–4, CI/developer suites, target-database preflight, schema-cache/storage checks, concurrency/failure suites, and manual product-interface smoke only after those actions are observed. A waiver, deferment, or unrelated green CI MUST NOT satisfy a mandatory gate.

#### Scenario: Mandatory gate still pending

- **WHEN** any mandatory `S1-*` gate lacks attributable passed evidence
- **THEN** Stage B MUST refuse formal Sprint 1 / production closure

### Requirement: Canonical status follows the completed ledger

Canonical EH-104 tasks/status MUST be reconciled only from completed gate-ledger evidence and MUST preserve any remaining pending production work explicitly.

#### Scenario: Ledger has mixed results

- **WHEN** some gates passed and others remain pending or failed
- **THEN** canonical status records the passed evidence without converting unfinished gates to passed

### Requirement: Backup cleanup is reference-safe

The non-canonical `- backup` change MUST be archived or removed only after every live repository/issue/QA/roadmap reference is migrated and strict validation proves no dependency remains.

#### Scenario: Live reference still points to backup

- **WHEN** inventory finds a live dependency on the backup path
- **THEN** cleanup remains pending until the reference is migrated and revalidated

### Requirement: Formal closure requires every mandatory gate

Formal Sprint 1 production/closure status MUST change to Go only when PRs 1–4 and every mandatory CI/developer, target-database, manual interface, OpenSpec, and release gate have attributable passed evidence.

#### Scenario: All mandatory gates pass

- **WHEN** evidence review finds every mandatory gate passed with valid attribution and no PHI/broken links/DAG violations
- **THEN** Stage B reconciles canonical tasks, updates roadmap/release records, and closes Sprint 1
