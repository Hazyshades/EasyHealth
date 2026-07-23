## Why

Sprint 1 has contradictory EH-104 task/status records across an active change, archived Phase B/closeout artifacts, a backup directory, and QA evidence, while four post-audit production blockers remain unresolved. A canonical requirement baseline and pending-gate ledger must be declared before remediation begins, but final delivery evidence must not be written until implementation, target preflight, and production smoke actually pass.

## What Changes

- Split reconciliation into two merge stages:
  - **Stage A now:** declare `openspec/changes/eh-104-separate-resolver-outcomes-from-verification-status` the canonical EH-104 requirement baseline; label archived Phase B/closeout artifacts historical; label `- backup` non-canonical; publish the corrected dependency DAG and every unexecuted gate as pending.
  - **Stage B last:** add attributable implementation/CI/target/manual evidence, reconcile canonical tasks/status, remove/archive the backup after reference migration, and update formal Sprint 1 closure only after every mandatory gate passes.
- Record the corrected remediation DAG: FK compatibility and atomic publication may start independently; durable deletion requires atomic publication; strict provenance requires durable deletion; final reconciliation requires all four remediation PRs plus target preflight, schema-cache verification, concurrency/failure suites, and manual production smoke.
- Keep PR 1's compatibility alias removal in a separate later cleanup change/PR; do not place an executable drop migration in the hotfix package.
- Define stable release gate ids and typed statuses (`pending`, `passed`, `failed`, `deferred`, `not_applicable`) with environment, build/commit, executor, timestamp, action, expected/observed result, and evidence link.
- Separate CI/developer, target-database, and manual product-interface evidence. A waiver, green CI, or deferred check never satisfies a mandatory target/manual gate.
- Keep EH-109 and EH-110 independently startable. Keep EH-112, production release, and formal Sprint 1 closure blocked until the remediation and production gates pass.
- Inventory and migrate every repository, issue, QA, roadmap, and archive reference before removing the non-canonical backup.
- Update QA only with observed safe tester/product-interface evidence; keep database, migration, grants, concurrency, failure injection, storage, and cleanup assertions in developer evidence.

## Capabilities

### New Capabilities

- `sprint-one-release-governance`: Canonical requirement ownership, corrected remediation dependencies, typed release evidence, and formal closeout criteria.

### Modified Capabilities

- None. This change reconciles planning and evidence; it does not change product behavior.

## Impact

- **Domains:** roadmap governance and QA, with links to documents, health-profile, and reports remediation.
- **OpenSpec:** one canonical EH-104 baseline, historical/non-canonical classification, corrected DAG, and reference-safe duplicate cleanup.
- **QA:** separate manual tester evidence from database/developer evidence; preserve pending states accurately.
- **Delivery:** Stage A merges before remediation. Stage B merges last, after PRs 1–4 plus target preflight and smoke.
- **Non-goal:** this change cannot waive, simulate, or retroactively mark any production gate passed.
