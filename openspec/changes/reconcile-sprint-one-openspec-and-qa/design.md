## Context

The active EH-104 change contains the broad Phase A/Phase B requirement history but leaves Phase B tasks unchecked. A separate archived Phase B change marks equivalent implementation tasks complete and records operator gates as waived/deferred. A backup active directory presents a third task state. QA correctly says target operator/manual work is pending, while archived closeout allowed issue closure based on CI.

The post-audit remediation consists of four runtime changes: PostgREST FK compatibility, atomic instrumental publication, durable document deletion, and strict provenance. Their detailed proposals now establish shared contracts for processing attempts/write generation, direct final deletion, source-aware report retention, and exclusive observation writers.

Planning needs one baseline and corrected DAG now. Release status must wait for observed evidence.

## Goals / Non-Goals

**Goals:**

- Establish a single authoritative EH-104 requirement baseline before remediation implementation.
- Preserve historical records without treating old task checkboxes or waivers as current release proof.
- Encode the real dependency DAG and independently startable work.
- Separate pending, passed, failed, deferred, and not-applicable evidence.
- Reconcile final status only after runtime remediation and target-environment gates.

**Non-Goals:**

- Modify runtime code or migrations.
- Mark any unexecuted check passed.
- Use CI as a substitute for target preflight, schema-cache proof, storage cleanup, or manual production smoke.
- Delete backup/history before reference inventory and strict validation.
- Close EH-112 or Sprint 1 from planning artifacts alone.

## Decisions

### 1. Split this change into Stage A and Stage B

**Stage A merges before remediation:**

- add an audit notice to the canonical EH-104 active change;
- label archived Phase B/closeout as historical evidence;
- label the `- backup` directory non-canonical without deleting it;
- publish the corrected dependency DAG;
- create the release ledger with every unexecuted mandatory gate `pending`;
- preserve production/Sprint 1 `No-Go`.

**Stage B merges last:**

- attach attributable implementation, CI, target, and manual evidence;
- reconcile canonical EH-104 task/status only from that evidence;
- migrate references and remove/archive the backup after strict validation;
- update roadmap/issue/release closure only when all mandatory gates are passed.

Stage A and Stage B may be delivered as separate commits/PRs from this one OpenSpec change. Stage A completion does not make the change or Sprint 1 complete.

### 2. Use the corrected dependency graph

```text
PR 5A canonical baseline/ledger ------------------------------┐
                                                               │
PR 1 FK compatibility bridge --------> target PostgREST/cache ├─┐
                                                               │ │
PR 2 atomic publication --------> PR 3 durable deletion ------> PR 4 strict provenance
                                                               │ │
EH-109 / EH-110 ---------------- independently startable       │ │
                                                               v v
all PRs + retained-DB preflight + concurrency/failure suites + production smoke
                                                               |
                                                               v
PR 5B final evidence/status reconciliation -> Sprint 1 closure / production / EH-112
```

PR 1 and PR 2 may start independently. PR 3 waits for PR 2 because deletion extends the same processing attempts/write generation and must fence prepared/current publication. PR 4 waits for PR 3 because strict immutable `document_id` is incompatible with lineage-nulling purge and requires direct row deletion. PR 5A happens now; PR 5B happens last.

PR 1's alias-drop migration is outside PR 1 and requires a later separately gated cleanup change after complete application/cache cutover evidence.

### 3. Use stable typed gate records

Each ledger row records:

- stable gate id;
- required/optional classification;
- status: `pending`, `passed`, `failed`, `deferred`, or `not_applicable`;
- environment and database/build/commit identity;
- executor and UTC timestamp;
- action and expected result;
- observed result;
- evidence link/artifact;
- remediation owner when failed/pending.

A mandatory gate is satisfied only by `passed`. `deferred`, `not_applicable`, a waiver, task checkbox, or unrelated green CI does not convert it to passed.

### 4. Define mandatory gate families

The ledger contains at least:

- `S1-PR1-*`: bridge migration state matrix, migrated PostgREST five-reader suite, schema-cache reload, all application-instance inventory, target API smoke;
- `S1-PR2-*`: populated attempt/content migration, golden hashes, same-hash matrix, two-session claim/finalize, failure injection, compatibility-reader equivalence, target worker smoke;
- `S1-PR3-*`: retained storage/report/observability preflight, legacy-worker drain, two-session delete races, paginated/stable-empty storage, cross-domain PHI hiding, target cleanup/status smoke;
- `S1-PR4-*`: writer inventory, reviewed backfill manifest, role/grant negatives, all protected-field matrices, projection success, purge-path removal, target provenance/deletion smoke;
- `S1-OS-*`: strict validation, canonical/reference inventory, no duplicate live baseline;
- `S1-QA-*`: manual owner/product-interface smoke using safe synthetic data;
- `S1-REL-*`: monitoring/rollback ownership, evidence review, formal production/Sprint closure.

Exact child ids are fixed when the Stage A ledger is created and never repurposed; corrections append superseding records.

### 5. Keep evidence domains separate

- **CI/developer:** migrations, pgTAP, real concurrent sessions, failure injection, grants, populated fixtures, builds/typecheck.
- **Target database:** actual migration state, retained-data preflight, PostgREST schema cache, worker inventory/drain, storage pagination/quiescence, target smoke.
- **Manual product interface:** owner-facing document read/delete/status behavior, Biomarkers/Health Profile/Reports visibility, safe observable outcomes.

An unavailable UI is explicitly untested. Database evidence is not pasted into the manual checklist as if a tester observed it.

### 6. Preserve canonical/historical ownership

The active `eh-104-separate-resolver-outcomes-from-verification-status` proposal/design/spec remains the requirement baseline. Archived implementation changes remain immutable historical evidence and receive a clearly separate audit annotation/link rather than rewritten completion claims. The backup remains non-canonical until all live references are inventoried and migrated; its task count never drives release status.

### 7. Keep roadmap status conservative

EH-109 and EH-110 can proceed independently because they do not depend on remediation runtime contracts. EH-112 integration, production release, and formal Sprint 1 closure remain blocked until PRs 1–4, retained-data/target gates, and manual production smoke pass. Stage A records this state; Stage B alone may change it.

## Risks / Trade-offs

- **[Canonical tasks look stale during remediation]** → Stage A audit notice and ledger explain the gap; do not convert checkboxes without evidence.
- **[Historical archive is mistaken for current truth]** → Label it historical and link the superseding remediation/ledger.
- **[Backup removal breaks references]** → Inventory repository, issue, QA, roadmap, and archive links before removal.
- **[Pressure to close after green CI only]** → Mandatory target and manual gates have independent ids and cannot inherit CI status.
- **[One reconciliation change spans time]** → Explicit Stage A/Stage B commits preserve ordering without pretending Stage A is final.
