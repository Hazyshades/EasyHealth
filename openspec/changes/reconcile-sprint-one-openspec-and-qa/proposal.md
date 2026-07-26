## Why

Sprint 1 has contradictory EH-104 task/status records across an active change, archived Phase B/closeout artifacts, a backup directory, and QA evidence, while four post-audit production blockers remain unresolved. A canonical requirement baseline and pending-gate ledger must be declared before remediation begins, but final delivery evidence belongs in a separate future Stage B change after implementation, target preflight, and production smoke actually pass.

## What Changes

- **Stage A only (this change):** declare `openspec/changes/eh-104-separate-resolver-outcomes-from-verification-status` the canonical EH-104 requirement baseline; label archived Phase B/closeout artifacts historical; label `- backup` non-canonical; publish the corrected dependency DAG and every unexecuted gate as pending; define the typed release ledger schema.
- **Stage B is a separate future OpenSpec change/PR:** `reconcile-sprint-one-release-evidence`. It alone may attach attributable evidence, reconcile canonical tasks/status, remove/archive the backup after reference migration, and update formal Sprint 1 closure.
- Record the corrected remediation DAG: FK compatibility and atomic publication may start independently; durable deletion requires atomic publication; strict provenance requires durable deletion; Stage B requires all four remediation PRs plus target preflight, schema-cache verification, concurrency/failure suites, and manual production smoke.
- Keep PR 1's compatibility alias removal in a separate later cleanup change/PR; do not place an executable drop migration in the hotfix package.
- Define stable release gate ids and typed statuses (`pending`, `passed`, `failed`, `deferred`, `not_applicable`) with environment, build/commit, executor, timestamp, action, expected/observed result, and evidence link.
- Separate CI/developer, target-database, and manual product-interface evidence. A waiver, green CI, or deferred check never satisfies a mandatory target/manual gate.
- Keep EH-109 and EH-110 independently startable. Keep EH-112, production release, and formal Sprint 1 closure blocked until the remediation and production gates pass.
- Delete the accidental empty repository file `$env`.
- Declare `.papercuts.jsonl` as the permanent tracked repository process-friction ledger for non-PHI agent/tooling notes only; it is not release evidence and must never contain secrets, PHI, credentials, or `.env` contents.

## Capabilities

### New Capabilities

- `sprint-one-release-governance`: Canonical requirement ownership, corrected remediation dependencies, typed pending release ledger, and Stage A/Stage B separation.

### Modified Capabilities

- None. This change reconciles planning and pending evidence structure; it does not change product behavior.

## Impact

- **Domains:** roadmap governance and QA, with links to documents, health-profile, and reports remediation.
- **OpenSpec:** one canonical EH-104 baseline, historical/non-canonical classification, corrected DAG, Stage A-only scope, and pointer to future Stage B change `reconcile-sprint-one-release-evidence`.
- **QA:** separate manual tester evidence from database/developer evidence; preserve all pending results.
- **Delivery:** Stage A merges before remediation. Stage B is a different change/PR and merges last.
- **Repository hygiene:** remove `$env`; keep `.papercuts.jsonl` as a tracked non-PHI process ledger.
- **Non-goal:** this change cannot waive, simulate, or retroactively mark any production gate passed, and it MUST NOT perform Stage B evidence/status edits.
