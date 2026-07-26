## 1. Preconditions

- [ ] 1.1 Verify Stage A change is merged and the pending ledger/gate ids exist.
- [ ] 1.2 Verify PRs 1–4 implementation branches/PRs are complete enough to gather evidence or explicitly leave their gates pending.
- [ ] 1.3 Refuse any closure edit while mandatory gates remain pending/failed/unattributed.

## 2. Collect remediation and target evidence

- [ ] 2.1 Record PR 1 dual-schema migration state, five live PostgREST consumers, schema-cache reload, application-instance inventory, and target API smoke.
- [ ] 2.2 Record PR 2 populated migration, canonical hashes, same-hash state matrix, claim/finalize concurrency, failure injection, compatibility-view equivalence, document-projection equality, and target worker smoke.
- [ ] 2.3 Record PR 3 constrained upload capability, retained storage/report/observability preflight, legacy-worker drain, deletion races against report/synthesis writers, paginated stable-empty cleanup, PHI visibility, signed-URL behavior, operation receipt, and target cleanup smoke.
- [ ] 2.4 Record PR 4 writer inventory, full nullability matrix, reviewed manifest, role/grant negatives including revision/source tables, cascade/parent-path negatives, projection success, helper/purge-path removal, and target provenance/deletion smoke.
- [ ] 2.5 Record strict validation, monitoring/rollback ownership, and safe manual product-interface smoke separately; mark only observed gates passed.

## 3. Final reconciliation

- [ ] 3.1 Reconcile canonical EH-104 tasks/status only from the completed gate ledger and explicitly preserve any remaining pending production work.
- [ ] 3.2 Migrate every live backup-path reference, then archive/remove the non-canonical backup only after strict validation proves no dependency.
- [ ] 3.3 Run `openspec validate --strict` for every retained canonical/remediation/Stage B change after reconciliation.
- [ ] 3.4 Review final evidence for missing attribution, false pass conversion, PHI, broken links, stale schema/build identity, and DAG violations.
- [ ] 3.5 Update roadmap, issue, release, and formal Sprint 1 production/closure status only when every mandatory gate has attributable passed evidence.
- [ ] 3.6 Preserve final evidence links and canonical/historical ownership in release records and merge Stage B last.
