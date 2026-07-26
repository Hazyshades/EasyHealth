## Context

`reconcile-sprint-one-openspec-and-qa` is Stage A only: canonical baseline, DAG, pending ledger, and repository hygiene. Final evidence and formal closure need a separate change so planning-time merge cannot be mistaken for Go.

## Goals / Non-Goals

**Goals:**

- Attach attributable evidence only after observed remediation and target/manual gates.
- Reconcile canonical EH-104 status from the ledger without false pass conversion.
- Remove/archive the non-canonical backup only after reference migration and strict validation.
- Update formal Sprint 1 / production / EH-112 status only on full mandatory-gate pass.

**Non-Goals:**

- Implement runtime remediation.
- Mark unexecuted checks passed.
- Rewrite historical archive completion claims.
- Use `.papercuts.jsonl` as release evidence.

## Decisions

### 1. This change is the only Stage B vehicle

No other OpenSpec change may convert Sprint 1 to Go. Stage A remains historical planning context after merge.

### 2. Evidence must match Stage A gate ids

Stage B reuses the Stage A gate families and required fields. It appends superseding records rather than repurposing ids. Mandatory gates accept only `passed` with environment/build/executor/timestamp/action/expected/observed/evidence link.

### 3. Backup cleanup is reference-safe and last-among-reconciliation-steps

Inventory and migrate every live reference first. Archive/remove `- backup` only after `openspec validate --strict` shows no dependency. Canonical EH-104 remains authoritative.

### 4. Papercuts stay out of Go/No-Go

`.papercuts.jsonl` may receive process notes during Stage B work but never satisfies a release gate.

## Risks / Trade-offs

- **[Pressure to close after green CI]** → Target and manual gates remain independently mandatory.
- **[Stage A leftovers look like unfinished Stage B]** → Explicit cross-links and No-Go until this change completes.
- **[Backup removal breaks links]** → Reference inventory gate blocks cleanup.
