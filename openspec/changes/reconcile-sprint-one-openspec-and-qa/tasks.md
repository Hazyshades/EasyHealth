## 1. Stage A canonical baseline declaration

- [ ] 1.1 Add an audit notice naming `eh-104-separate-resolver-outcomes-from-verification-status` as the canonical EH-104 requirement baseline.
- [ ] 1.2 Label archived EH-104 Phase B/closeout artifacts historical and the `- backup` change non-canonical without deleting or rewriting historical evidence.
- [ ] 1.3 Publish the corrected DAG: PR 1 and PR 2 independent; PR 3 after PR 2; PR 4 after PR 3; Stage B after PRs 1–4 and all target/manual gates; EH-109/EH-110 independent; EH-112 blocked.
- [ ] 1.4 Record production and Sprint 1 `No-Go` with every unexecuted remediation, target, and manual gate pending.
- [ ] 1.5 Merge Stage A before remediation implementation while leaving this reconciliation change and final closure incomplete.

## 2. Stage A release evidence ledger

- [ ] 2.1 Define stable gate ids, required classification, and typed status for each remediation PR, CI suite, migration state, target preflight, schema-cache/storage check, concurrency/failure suite, manual smoke, and release gate.
- [ ] 2.2 Require environment, database/build/commit, executor, UTC timestamp, action, expected/observed result, evidence link, and remediation owner for each gate.
- [ ] 2.3 Keep CI/developer, target-database, and manual product-interface evidence separate; a waiver, deferment, not-applicable status, or unrelated green CI never satisfies a mandatory gate.
- [ ] 2.4 Create pending `S1-PR1-*`, `S1-PR2-*`, `S1-PR3-*`, `S1-PR4-*`, `S1-OS-*`, `S1-QA-*`, and `S1-REL-*` gate families matching the amended remediation boundaries.
- [ ] 2.5 Record that PR 1 alias removal requires a later separate cleanup change and is not executable in the hotfix package.

## 3. Reference and status inventory

- [ ] 3.1 Inventory every repository, issue, QA, roadmap, archive, and external release reference to canonical, historical, and backup EH-104 paths.
- [ ] 3.2 Map archived task/waiver claims to current gate ids without converting them to passed unless the current gate's exact action/environment/evidence matches.
- [ ] 3.3 Reconcile EH-103, EH-104, EH-105, and EH-106 QA checklist structure so tester actions remain separate from database/developer evidence while preserving all pending results.
- [ ] 3.4 Record EH-109 and EH-110 as independently startable and EH-112/production/formal Sprint 1 closure as blocked.

## 4. Collect remediation and target evidence

- [ ] 4.1 Record PR 1 dual-schema migration state, five live PostgREST consumers, schema-cache reload, application-instance inventory, and target API smoke.
- [ ] 4.2 Record PR 2 populated migration, canonical hashes, same-hash state matrix, claim/finalize concurrency, failure injection, compatibility-reader equivalence, and target worker smoke.
- [ ] 4.3 Record PR 3 retained storage/report/observability preflight, legacy-worker drain, deletion races, paginated stable-empty cleanup, PHI visibility, signed-URL behavior, operation receipt, and target cleanup smoke.
- [ ] 4.4 Record PR 4 writer inventory, reviewed manifest, role/grant negatives, full protected-field matrix, projection success, helper/purge-path removal, and target provenance/deletion smoke.
- [ ] 4.5 Record strict validation, monitoring/rollback ownership, and safe manual product-interface smoke separately; mark only observed gates passed.

## 5. Stage B final reconciliation

- [ ] 5.1 Refuse Stage B while any mandatory gate is pending, failed, deferred, not applicable without an approved non-mandatory classification, unattributed, or linked to invalid evidence.
- [ ] 5.2 Reconcile canonical EH-104 tasks/status only from the completed gate ledger and explicitly preserve any remaining pending production work.
- [ ] 5.3 Migrate every live backup-path reference, then archive/remove the non-canonical backup only after strict validation proves no dependency.
- [ ] 5.4 Run `openspec validate --strict` for every retained canonical/remediation change after reconciliation.
- [ ] 5.5 Review final evidence for missing attribution, false pass conversion, PHI, broken links, stale schema/build identity, and DAG violations.
- [ ] 5.6 Update roadmap, issue, release, and formal Sprint 1 production/closure status only when every mandatory gate has attributable passed evidence.
- [ ] 5.7 Preserve final evidence links and canonical/historical ownership in release records and merge Stage B last.
