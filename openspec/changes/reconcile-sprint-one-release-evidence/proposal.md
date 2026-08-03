## Why

Stage A declared the canonical EH-104 baseline and pending release ledger, but formal Sprint 1 closure still requires attributable evidence from remediation PRs 1–4, target-database preflight, and manual production smoke. That final reconciliation must not share an OpenSpec change with Stage A planning.

## What Changes

- Collect and attach attributable passed/failed evidence for every mandatory `S1-*` gate after PRs 1–4 and target/manual work complete.
- Reconcile canonical EH-104 tasks/status only from the completed gate ledger.
- Migrate every live backup-path reference, then archive/remove the non-canonical `- backup` change after strict validation.
- Update roadmap, issue, release, and formal Sprint 1 production/closure status only when every mandatory gate has attributable passed evidence.
- Preserve final evidence links and canonical/historical ownership in release records.
- **BREAKING** for release process only: Stage A alone is no longer allowed to close Sprint 1; this change is the sole final reconciliation vehicle.

## Capabilities

### New Capabilities

- `sprint-one-release-evidence`: Final attributable evidence attachment, reference-safe backup cleanup, and formal Sprint 1 closeout rules.

### Modified Capabilities

- None. Stage A already added `sprint-one-release-governance`; this change adds Stage B evidence requirements without rewriting archived main specs.

## Impact

- **Domains:** roadmap governance and QA closeout.
- **OpenSpec:** depends on completed Stage A ledger schema and remediation packages; merges last.
- **Runtime:** none. This change does not implement product behavior.
- **Non-goal:** cannot invent evidence, convert waivers into passes, or close while any mandatory gate is pending/failed.
