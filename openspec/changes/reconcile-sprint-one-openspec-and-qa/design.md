## Context

The active EH-104 change contains the broad Phase A/Phase B requirement history but leaves six Phase B tasks unchecked. A separate archived Phase B change marks equivalent implementation tasks complete and records operator gates as waived/deferred. A backup active directory presents a third task state. QA correctly says target operator/manual work is pending, while the archived closeout allowed issue closure based on CI.

The post-audit remediation consists of four runtime changes: PostgREST FK compatibility, atomic instrumental publication, durable document deletion, and strict provenance. Planning needs one baseline now; release status must wait for observed evidence.

## Goals / Non-Goals

**Goals:**

- Establish a single authoritative requirement baseline before remediation implementation.
- Preserve historical records without treating old task checkboxes or waivers as current release proof.
- Separate pending, passed, failed, deferred, and not-applicable evidence.
- Reconcile final status only after runtime remediation and target-environment gates.

**Non-Goals:**

- Modify runtime code or migrations.
- Mark any unexecuted check passed.
- Use CI as a substitute for target retained-database preflight or manual production smoke.

## Decisions

### 1. Declare the canonical baseline now

For planning and readiness audit:

- `openspec/changes/eh-104-separate-resolver-outcomes-from-verification-status` is the canonical EH-104 requirement baseline.
- `archive/2026-07-22-eh-104-phase-b-enforcement-and-legacy-rpc-removal` and the Sprint 1 closeout change are immutable historical implementation/waiver evidence.
- `eh-104-separate-resolver-outcomes-from-verification-status - backup` is non-canonical and cannot determine scope or status.
- Task completion in any of those locations is not production-readiness evidence after the audit findings.

The four remediation changes are additive corrections to the canonical baseline. This declaration is effective in planning artifacts before implementation; it does not assert delivery.

### 2. Split reconciliation into early and late stages

**Stage A — baseline declaration and inventory (before implementation):**

- name the canonical and non-canonical artifacts;
- record the four blocking remediation changes and dependency DAG;
- list every required CI, migration, preflight, role, concurrency, failure-injection, and manual smoke item as pending;
- perform reference inventory before any duplicate removal.

**Stage B — evidence reconciliation (last merge):**

- link merged commits/PRs and exact CI runs;
- record target environment, migration state, preflight output, schema-cache evidence, and manual tester metadata;
- update task/status fields only from those observations;
- archive/remove the backup and reconcile the canonical EH-104 lifecycle after reference checks;
- close Sprint 1 only when all mandatory gates pass.

Stage B depends on runtime PRs 1–4, target preflight, and smoke. Stage A does not.

### 3. Use one evidence ledger with typed status

Each gate records: stable id, owning change, environment, build/commit, executor, timestamp, command or product action, expected result, observed result, artifact link, and status (`pending`, `passed`, `failed`, `deferred`, `not_applicable`).

`deferred` requires a reason and owner but does not satisfy a mandatory production gate. CI database evidence and manual UI evidence remain separate entries. A waiver remains historical context, never a `passed` conversion.

### 4. Preserve the actual dependency DAG

```text
FK hotfix ------------------------------------------ immediate
strict provenance --------------------------------- independent
atomic instrumental publication --> durable delete
PRs 1-4 + target preflight + manual smoke --------> final reconciliation
```

EH-109 and EH-110 may proceed in separate branches. EH-112 and production/Sprint 1 closure remain blocked by the relevant runtime and release gates.

### 5. Keep QA tester-facing

Manual QA retains preconditions, safe synthetic data, numbered product-interface actions, and observable expected results. Database migrations, grants, concurrency, cleanup, and failure injection remain in developer evidence. An unavailable interface is explicitly untested.

## Risks / Trade-offs

- **[Canonical active tasks still look stale during remediation]** → Add an explicit audit notice and gate ledger; do not rewrite completion until Stage B evidence exists.
- **[Historical archive is mistaken for current truth]** → Label it historical and link the superseding audit/remediation changes.
- **[Backup removal breaks references]** → Inventory and migrate references before deletion/archive.
- **[Pressure to close after green CI only]** → Make target preflight and manual smoke mandatory production gates with independent status.
