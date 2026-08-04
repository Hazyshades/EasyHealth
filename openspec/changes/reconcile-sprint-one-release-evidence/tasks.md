## 1. Preconditions

- [ ] 1.1 Verify Stage A change is merged and the pending ledger/gate ids exist.
  - [ ] 1.1.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 1.1.b Exercise the required positive and negative cases.
  - [ ] 1.1.c Record results and resolve any divergence before parent completion.

- [ ] 1.2 Verify PRs 1–4 implementation branches/PRs are complete enough to gather evidence or explicitly leave their gates pending.
  - [ ] 1.2.a Define the deterministic fixture, environment, and expected assertion.
  - [ ] 1.2.b Exercise the required positive and negative cases.
  - [ ] 1.2.c Record results and resolve any divergence before parent completion.

- [ ] 1.3 Refuse any closure edit while mandatory gates remain pending/failed/unattributed.
  - [ ] 1.3.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 1.3.b Execute the stated action through its approved boundary.
  - [ ] 1.3.c Verify expected and failure behavior and record attributable evidence.

## 2. Collect remediation and target evidence

- [ ] 2.1 Record PR 1 dual-schema migration state, five live PostgREST consumers, schema-cache reload, application-instance inventory, and target API smoke.
  - [ ] 2.1.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.1.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.1.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 2.2 Record PR 2 populated migration, canonical hashes, same-hash state matrix, claim/finalize concurrency, failure injection, compatibility-view equivalence, document-projection equality, and target worker smoke.
  - [ ] 2.2.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.2.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.2.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 2.3 Record PR 3 constrained upload capability, retained storage/report/observability preflight, legacy-worker drain, deletion races against report/synthesis writers, paginated stable-empty cleanup, PHI visibility, signed-URL behavior, operation receipt, and target cleanup smoke.
  - [ ] 2.3.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.3.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.3.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 2.4 Record PR 4 writer inventory, full nullability matrix, reviewed manifest, role/grant negatives including revision/source tables, cascade/parent-path negatives, projection success, helper/purge-path removal, and target provenance/deletion smoke.
  - [ ] 2.4.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.4.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.4.c Publish attributable findings and block unresolved or unsafe results.

- [ ] 2.5 Record strict validation, monitoring/rollback ownership, and safe manual product-interface smoke separately; mark only observed gates passed.
  - [ ] 2.5.a Enumerate exact inputs, owners, and required evidence or failure classifications.
  - [ ] 2.5.b Perform the stated review or preflight against the defined invariants.
  - [ ] 2.5.c Publish attributable findings and block unresolved or unsafe results.

## 3. Final reconciliation

- [ ] 3.1 Reconcile canonical EH-104 tasks/status only from the completed gate ledger and explicitly preserve any remaining pending production work.
  - [ ] 3.1.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.1.b Execute the stated action through its approved boundary.
  - [ ] 3.1.c Verify expected and failure behavior and record attributable evidence.

- [ ] 3.2 Migrate every live backup-path reference, then archive/remove the non-canonical backup only after strict validation proves no dependency.
  - [ ] 3.2.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 3.2.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 3.2.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 3.3 Run `openspec validate --strict` for every retained canonical/remediation/Stage B change after reconciliation.
  - [ ] 3.3.a Prepare the target environment, entry criteria, and rollback decision.
  - [ ] 3.3.b Execute the stated operation within the declared safety gates.
  - [ ] 3.3.c Capture attributable smoke, negative-case, and completion evidence.

- [ ] 3.4 Review final evidence for missing attribution, false pass conversion, PHI, broken links, stale schema/build identity, and DAG violations.
  - [ ] 3.4.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.4.b Execute the stated action through its approved boundary.
  - [ ] 3.4.c Verify expected and failure behavior and record attributable evidence.

- [ ] 3.5 Update roadmap, issue, release, and formal Sprint 1 production/closure status only when every mandatory gate has attributable passed evidence.
  - [ ] 3.5.a Map affected callers, data, compatibility constraints, and rollback boundary.
  - [ ] 3.5.b Apply the stated cutover consistently to every in-scope path.
  - [ ] 3.5.c Verify no legacy path or invalid state remains and record evidence.

- [ ] 3.6 Preserve final evidence links and canonical/historical ownership in release records and merge Stage B last.
  - [ ] 3.6.a Identify scope, prerequisites, owners, and measurable acceptance evidence.
  - [ ] 3.6.b Execute the stated action through its approved boundary.
  - [ ] 3.6.c Verify expected and failure behavior and record attributable evidence.

