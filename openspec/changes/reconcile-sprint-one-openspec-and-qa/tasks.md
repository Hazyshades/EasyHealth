## 1. Early canonical baseline declaration

- [ ] 1.1 Add an audit notice naming `eh-104-separate-resolver-outcomes-from-verification-status` as the canonical EH-104 requirement baseline.
- [ ] 1.2 Label archived EH-104 Phase B/closeout artifacts as historical evidence and the `- backup` change as non-canonical without deleting anything yet.
- [ ] 1.3 Record the four remediation changes, exact dependency DAG, and production/Sprint 1 No-Go status with every unexecuted gate pending.
- [ ] 1.4 Inventory all repository, issue, QA, roadmap, and archived references to the canonical, historical, and backup paths before cleanup.

## 2. Release evidence ledger

- [ ] 2.1 Define stable gate ids and typed status fields for each remediation PR, CI suite, migration state, target preflight, schema-cache check, concurrency/failure suite, and manual smoke.
- [ ] 2.2 Record environment, build/commit, executor, timestamp, action, expected/observed result, and evidence link for each gate.
- [ ] 2.3 Keep CI/developer, target-database, and manual product-interface evidence separate; a waiver or deferred check never satisfies a mandatory gate.
- [ ] 2.4 Record EH-109/EH-110 as independently startable without changing Sprint 1 or EH-112 release gates.

## 3. Runtime dependency gate

- [ ] 3.1 Link the deployed FK compatibility hotfix and its two-state rollout/schema-cache/five-consumer evidence.
- [ ] 3.2 Link atomic instrumental publication evidence, including populated migration, state matrix, two-session concurrency, role negatives, and stepwise rollback injection.
- [ ] 3.3 Link durable deletion evidence, including legacy-worker drain, lease fencing, storage pagination/stability, signed-URL behavior, final purge, and retained receipt.
- [ ] 3.4 Link strict provenance evidence, including populated backfill, field/source policy, role negatives, GUC bypass removal, and later temporary purge-path retirement.
- [ ] 3.5 Do not begin final status reconciliation while any mandatory runtime or target gate is pending, failed, or merely deferred.

## 4. Late QA and status reconciliation

- [ ] 4.1 Run and record target retained-database preflight after all applicable migrations; keep closure blocked on findings.
- [ ] 4.2 Run manual production smoke with safe synthetic data for the five reads, coherent instrumental publication, deletion lifecycle, and provenance behavior.
- [ ] 4.3 Update EH-103, EH-104, and EH-105 QA checklists with manual preconditions/actions/results and separate developer evidence; mark only observed checks passed.
- [ ] 4.4 Reconcile canonical EH-104 tasks/status from evidence and explicitly preserve any remaining pending production work.
- [ ] 4.5 Move/archive/remove the non-canonical backup only after reference migration and strict validation prove no live dependency.

## 5. Formal closeout

- [ ] 5.1 Run `openspec validate --strict` for every retained canonical/remediation change after reconciliation.
- [ ] 5.2 Review the final evidence ledger for missing attribution, false pass conversion, PHI, broken links, and DAG violations.
- [ ] 5.3 Update formal Sprint 1 production/closure status only when every mandatory gate has attributable passed evidence.
- [ ] 5.4 Preserve the final evidence links and canonical/historical ownership in roadmap and release records.
