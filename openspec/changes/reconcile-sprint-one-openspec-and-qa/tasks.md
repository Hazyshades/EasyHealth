## 1. Stage A canonical baseline declaration

- [ ] 1.1 Add an audit notice naming `eh-104-separate-resolver-outcomes-from-verification-status` as the canonical EH-104 requirement baseline.
  - [ ] 1.1.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 1.1.b Implement the stated operation only at its designated authority boundary.
  - [ ] 1.1.c Exercise focused success and failure cases and capture evidence.

- [ ] 1.2 Label archived EH-104 Phase B/closeout artifacts historical and the `- backup` change non-canonical without deleting or rewriting historical evidence.
  - [ ] 1.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.2.b Execute the stated action through its approved boundary.
  - [ ] 1.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 1.3 Publish the corrected DAG: PR 1 and PR 2 independent; PR 3 after PR 2; PR 4 after PR 3; Stage B (`reconcile-sprint-one-release-evidence`) after PRs 1–4 and all target/manual gates; EH-109/EH-110 independent; EH-112 blocked.
  - [ ] 1.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.3.b Execute the stated action through its approved boundary.
  - [ ] 1.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 1.4 Record production and Sprint 1 `No-Go` with every unexecuted remediation, target, and manual gate pending.
  - [ ] 1.4.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 1.4.b Perform the stated review or preflight against the defined invariants.
  - [ ] 1.4.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 1.5 Merge Stage A before remediation implementation while leaving final closure to the separate Stage B change.
  - [ ] 1.5.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.5.b Execute the stated action through its approved boundary.
  - [ ] 1.5.c Verify expected and failure behavior and record attributable evidence.

## 2. Stage A release evidence ledger

- [ ] 2.1 Define stable gate ids, required classification, and typed status for each remediation PR, CI suite, migration state, target preflight, schema-cache/storage check, concurrency/failure suite, manual smoke, and release gate.
  - [ ] 2.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.1.b Execute the stated action through its approved boundary.
  - [ ] 2.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.2 Require environment, database/build/commit, executor, UTC timestamp, action, expected/observed result, evidence link, and remediation owner for each gate.
  - [ ] 2.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.2.b Execute the stated action through its approved boundary.
  - [ ] 2.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.3 Keep CI/developer, target-database, and manual product-interface evidence separate; a waiver, deferment, not-applicable status, or unrelated green CI never satisfies a mandatory gate.
  - [ ] 2.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 2.3.b Execute the stated action through its approved boundary.
  - [ ] 2.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 2.4 Create pending `S1-PR1-*`, `S1-PR2-*`, `S1-PR3-*`, `S1-PR4-*`, `S1-OS-*`, `S1-QA-*`, and `S1-REL-*` gate families matching the amended remediation boundaries.
  - [ ] 2.4.a Define inputs, state transitions, authorization, and invariant boundaries.
  - [ ] 2.4.b Implement the stated operation only at its designated authority boundary.
  - [ ] 2.4.c Exercise focused success and failure cases and capture evidence.

- [ ] 2.5 Record that PR 1 alias removal requires a later separate cleanup change and is not executable in the hotfix package.
  - [ ] 2.5.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.5.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.5.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 2.6 Record that Stage B work belongs only to `reconcile-sprint-one-release-evidence` and that this Stage A change contains no final evidence/status edits.
  - [ ] 2.6.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.6.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.6.c Publish attributable findings and block unresolved or unsafe results.

## 3. Reference and status inventory

- [ ] 3.1 Inventory every repository, issue, QA, roadmap, archive, and external release reference to canonical, historical, and backup EH-104 paths.
  - [ ] 3.1.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 3.1.b Perform the stated review or preflight against the defined invariants.
  - [ ] 3.1.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 3.2 Map archived task/waiver claims to current gate ids without converting them to passed unless the current gate's exact action/environment/evidence matches.
  - [ ] 3.2.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.2.b Execute the stated action through its approved boundary.
  - [ ] 3.2.c Verify expected and failure behavior and record attributable evidence.

- [ ] 3.3 Reconcile EH-103, EH-104, EH-105, and EH-106 QA checklist structure so tester actions remain separate from database/developer evidence while preserving all pending results.
  - [ ] 3.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.3.b Execute the stated action through its approved boundary.
  - [ ] 3.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 3.4 Record EH-109 and EH-110 as independently startable and EH-112/production/formal Sprint 1 closure as blocked.
  - [ ] 3.4.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 3.4.b Perform the stated review or preflight against the defined invariants.
  - [ ] 3.4.c Publish attributable findings and block unresolved or unsafe results.

## 4. Stage A repository hygiene

- [ ] 4.1 Delete the accidental empty `$env` file and verify it is absent from the repository root.
  - [ ] 4.1.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 4.1.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 4.1.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 4.2 Document `.papercuts.jsonl` as the permanent tracked non-PHI process-friction ledger and verify no secrets/PHI are present in current entries.
  - [ ] 4.2.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 4.2.b Perform the stated review or preflight against the defined invariants.
  - [ ] 4.2.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 4.3 Point roadmap/release notes at Stage B change `reconcile-sprint-one-release-evidence` for final evidence and formal closure.
  - [ ] 4.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 4.3.b Execute the stated action through its approved boundary.
  - [ ] 4.3.c Verify expected and failure behavior and record attributable evidence.

- [ ] 4.4 Run `openspec validate --strict` for this Stage A change and the five remediation packages after amendments.
  - [ ] 4.4.a Prepare the target environment, entry criteria, and rollback decision.
  - [ ] 4.4.b Execute the stated operation within the declared safety gates.
  - [ ] 4.4.c Capture attributable smoke, negative-case, and completion evidence.

