# Registry documentation

Canonical home for EasyHealth Registry 2.0 launch documentation and evidence.
Do not use the gitignored `/docs/` tree for this material.

## Start here

| Document | Purpose |
| --- | --- |
| [ADR 0001: Registry 2.0 hard cutover](adr/0001-registry-v2-hard-cutover.md) | Stable decision, schema/ownership, maturity/resolver policy, version axes |
| [Launch cutover checklist](launch-cutover-checklist.md) | Procedural Fresh vs Retained cutover, verify commands, evidence blanks |
| [Candidate-release package v1](candidate-release/v1/README.md) | EH-106 44-row corpus, policy, approvals, reset/rollback notes |
| [Superseded rollout stub](measurement-registry-rollout.md) | Historical pointer only; shadow/dual-runtime guidance is inactive |
| [Registry v1 audit fixture](biomarker-registry/v1.0.0/AUDIT.md) | Frozen v1 baseline for migration/audit tooling |

## QA evidence

| Checklist | Covers |
| --- | --- |
| [`QA/eh-106/checklist.md`](../QA/eh-106/checklist.md) | Runtime cutover / acceptance / consumer behavior |
| [`QA/eh-107/checklist.md`](../QA/eh-107/checklist.md) | CBC antipair regression evidence |
| [`QA/eh-108/checklist.md`](../QA/eh-108/checklist.md) | ADR explain / cutover run / evidence interpret |

## Ownership reminder

- EH-104 owns promotion primitive + Phase B enforcement.
- EH-106 owns corpus/manifest/approvals evidence.
- EH-107 owns CBC identity antipair suite evidence.
- EH-108 owns the ADR, launch checklist, and cutover hygiene docs/CI trigger.
