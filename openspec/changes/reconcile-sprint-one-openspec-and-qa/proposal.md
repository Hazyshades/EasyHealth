## Why

Sprint 1 currently has contradictory EH-104 task/status records across an active change, an archived Phase B change, a backup directory, and QA evidence, while four post-audit production blockers remain unresolved. A canonical requirement baseline must be declared before remediation starts, but final delivery evidence must not be written until implementation, target preflight, and smoke actually pass.

## What Changes

- Declare `openspec/changes/eh-104-separate-resolver-outcomes-from-verification-status` as the canonical EH-104 requirement baseline for remediation planning.
- Treat the archived EH-104 Phase B and Sprint 1 closeout changes as historical implementation/waiver evidence only, not authoritative proof of current production readiness.
- Treat `eh-104-separate-resolver-outcomes-from-verification-status - backup` as non-canonical pending reference review and later removal/archive; its task state never drives release status.
- Split reconciliation into two stages:
  - early baseline declaration and pending-gate inventory before any implementation;
  - late evidence/status reconciliation only after remediation PRs 1–4, strict validation, target database preflight, and manual production smoke.
- Add one Sprint 1 release-gate record linking the FK hotfix, atomic instrumental publication, durable deletion, strict provenance, CI, migration/preflight evidence, and manual QA.
- Keep every unavailable or unexecuted check explicitly pending; never translate CI coverage or a waiver into a manual/target-environment pass.
- Reconcile and archive/remove duplicate OpenSpec artifacts only after reference checks, then update QA and formal Sprint 1 status from observed evidence.

## Capabilities

### New Capabilities

- `sprint-one-release-governance`: Canonical baseline selection, pending-gate representation, evidence provenance, and formal closeout criteria for the post-audit Sprint 1 release.

### Modified Capabilities

- None. This change reconciles planning and evidence; it does not change product behavior.

## Impact

- **Domains:** roadmap governance and QA, with links to documents, health-profile, and reports remediation.
- **OpenSpec:** one canonical EH-104 baseline, historical evidence classification, and duplicate cleanup.
- **QA:** separate manual tester evidence from database/developer evidence; preserve pending states accurately.
- **Delivery:** the baseline declaration is planning-time context now. Final evidence/status edits and formal closure merge last, after PRs 1–4 plus target preflight and smoke.
- **Non-goal:** this change cannot waive, simulate, or retroactively mark any production gate as passed.
