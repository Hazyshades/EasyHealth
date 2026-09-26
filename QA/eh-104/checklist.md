# EH-104: Durable document deletion and resolver outcomes

**Roadmap status:** Durable deletion implemented; rollout gate and target QA pending  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-104 separates resolver outcome from verification trust and provides a durable
document-deletion workflow. Testers verify owner-facing tombstone/status behavior
and exclusion of deleting documents. Developers supply migration, storage, lease,
retained-data, and privacy-boundary evidence.

## Before you start

- [ ] Use a dedicated test account and synthetic documents only.
- [ ] Ask the QA lead for one clearly recognized laboratory fixture and one
      partial or ambiguous fixture.
- [ ] Record the baseline Documents, Biomarkers, and Health Profile state before
      uploading the fixtures.
- [ ] Confirm migrations `079_eh104_durable_processing_leases.sql` through
      `082_eh104_atomic_report_synthesis_writers.sql` are applied to the target.
- [ ] Confirm the lease-aware worker and deletion-cleanup worker are deployed;
      do not enable owner deletion while legacy workers remain unfenced.

## Test data

| ID                 | Test document or setup                                       | Purpose                             |
| ------------------ | ------------------------------------------------------------ | ----------------------------------- |
| `LAB-RESOLVED`     | Synthetic report with one reviewed, unambiguous result       | Normal visible flow                 |
| `LAB-NOT-RESOLVED` | Synthetic partial or ambiguous result                        | Safety boundary                     |
| `LAB-DELETE`       | Synthetic accepted laboratory document the tester may delete | Durable deletion path               |
| `INST-NORMAL`      | Synthetic instrumental report                                | Laboratory vs instrumental boundary |

## Interface checks

### EH104-UI-01: Recognized result remains consistent after a normal review

1. Upload `LAB-RESOLVED` and open it in **Documents** after processing.
2. Check the result in **Extracted biomarkers** and perform the normal review
   action when it is offered.
3. Refresh the document, then open **Biomarkers**.

**Expected result:** The visible source evidence, document result, and
biomarker row do not contradict one another. Refreshing does not create a
duplicate or a different visible measurement.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-02: A non-resolved source does not become a trusted trend

1. Upload `LAB-NOT-RESOLVED` and open the processed document.
2. Compare the source text/value with the original fixture.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The document can retain the raw source for review, but it
does not create a new trusted biomarker trend or assessment input solely from
partial or ambiguous evidence.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-03: Reprocess does not create contradictory visible state

1. On either test document, choose **Reprocess**.
2. Wait for processing to finish, refresh the browser, and reopen the document.
3. Repeat the relevant check above.

**Expected result:** The document remains usable and its visible source/result
state is internally consistent. If processing needs review, the interface asks
the user to reprocess or review rather than presenting a silently corrupted
accepted result.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-04: Delete an accepted laboratory document safely

1. Accept at least one result on `LAB-DELETE`.
2. Note the document in **Documents** and any biomarker rows it contributed.
3. Delete the document from **Documents**.
4. Refresh **Documents** and **Biomarkers**.

**Expected result:** The document is gone. The product does not leave a broken
review screen for that document. Biomarker presentation remains internally
consistent for remaining data.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

### EH104-UI-05: Instrumental report stays outside laboratory review semantics

1. Upload `INST-NORMAL` and open it after processing.
2. Inspect **Study findings** when available.
3. Open **Biomarkers** and **Health Profile**.

**Expected result:** The instrumental report does not appear as a laboratory
extracted-biomarker acceptance row and does not by itself create laboratory
trend/score inputs.

**Result:** `Pass | Fail | Blocked | N/A`  
**Notes / evidence link:** `________`

## Durable deletion UI limitation

The current Documents interface has no owner-delete control and no deletion
status screen. The durable deletion contract is currently exposed through the
owner-scoped HTTP routes and worker/database boundary, not a product UI. Do not
invent a manual UI pass: record the checks below as `N/A` until the product
surface is shipped, and use the developer evidence section for route behavior.

### EH104-DD-UI-01: Owner deletion is asynchronous and idempotent

**Result:** `N/A`: no owner-delete control is available in the current UI.
**Developer evidence instead:** exercise `DELETE /api/documents/:id` with a
synthetic owner session and verify `202`, a stable operation id, and active-view
exclusion.

### EH104-DD-UI-02: Deletion status does not expose private data

**Result:** `N/A`: no deletion status surface is available in the current UI.
**Developer evidence instead:** exercise
`GET /api/documents/:id/deletion` as the owner and a different test account;
verify safe fields only and `404`/equivalent denial for the other account.

### EH104-DD-UI-03: Upload and processing remain fenced during deletion

**Result:** `N/A`: no deletion control or status surface is available in the
current UI.
**Developer evidence instead:** use synthetic API/worker fixtures to request
deletion during upload or processing, then verify no late artifact is visible,
retryable cleanup is reported for storage failure, and finalization waits for
the empty-list stability interval.

## Developer evidence required

- [x] **Durable inventory:** `pnpm preflight:document-deletion` emits
      `eh104.durable-deletion.inventory.v1`; current static result is BLOCKED
      because this command cannot provide target-specific live evidence.
- [x] **Retained-data preflight:** `pnpm preflight:document-deletion-data`
      runs read-only on the fully migrated local disposable target, prints no
      PHI, and returned `READY_FOR_SCHEMA_PREFLIGHT` with zero rows.
- [x] **Database contract:** `pnpm test:eh104-durable-deletion-db` passes after
      `supabase db reset`, covering tombstone idempotency, generation fencing,
      report/synthesis invalidation, grants, and writer rejection.
- [x] **Phase B preflight:** `pnpm preflight:eh104` returned `status: clean`
      with zero findings on the local disposable target. Persistent
      environments still abort without mutation on findings.
- [ ] **Disposable reset contract:** reset refuses without
      `EH104_PHASE_B_DISPOSABLE=1` and `EH104_PHASE_B_ALLOW_RESET=1`; with both set,
      `pnpm reset:eh104-phase-b` clears document-derived laboratory lineage only.
- [x] **Static legacy RPC ban:** `pnpm check:no-legacy-promotion-rpc` passes.
- [x] **EH-104 static boundary:** `pnpm test:eh104` passes (legacy RPC ban,
      lifecycle/MATCH FULL guards, durable tombstone route, and finalizer
      wiring).
- [x] **Direct mutation fence:** migration `079` installs the security-definer
      document-active guard on document child/job/attempt/storage-intent/AI and
      publication writes; pgTAP covers rejected child and AI writes after tombstone
      when the database target is available.
- [ ] **Document delete:** owner DELETE returns `202` and the operation status
      route is owner-scoped; repeated DELETE returns the same operation id on a
      target with migrations `079`–`082`.
- [ ] **Final purge:** cleanup proves recursive paginated storage removal,
      expired-intent sweep, two stable empty listings, whole-row derivative
      deletion, receipt completion, and receipt expiry pruning.
- [ ] **Worker verification:** `pnpm typecheck:worker` passes after worker
      dependencies are installed; no legacy direct Storage upload remains.
- [ ] **Worker lab reprocess:** laboratory clear supersedes extracted rows and
      does not delete-then-orphan revision lineage; instrumental path unchanged.
- [ ] **Reviewed maturity:** acceptance/correction still reject non-reviewed
      concrete definitions before persistence.
- [x] Root typecheck and focused EH-105/EH-106 regressions recorded; the
      related PR2, registry, lifecycle, assessment, medical-event, and
      duplicate-document DB suites also passed.

## Durable-deletion inventory evidence (2026-09-19)

**Evidence owner:** implementation agent  
**Static command:** `pnpm preflight:document-deletion`  
**Scope:** working-tree inventory only; populated database/storage preflight remains a release gate.

### Document-derived retention inventory

| Retained surface                                                                   | Current owner / writer                   | Cleanup boundary                                    | Payload classification |
| ---------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------- | ---------------------- |
| `documents` paths, summary, processing state, `write_generation`                   | upload route and processing finalizers   | tombstone, storage inventory, final transaction     | PHI                    |
| storage intents and one-time upload tickets                                        | app broker and worker artifact broker    | completion/failure, expiry sweep, final purge       | metadata               |
| `document_deletion_operations` retained receipt                                    | owner DELETE and cleanup worker          | independent receipt retention/expiry                | metadata               |
| `document_pages` previews, OCR text/JSON                                           | document worker                          | attempt-aware final purge                           | PHI                    |
| jobs and processing attempts                                                       | worker claim/reclaim RPCs                | cancel/quiesce, then child purge                    | mixed                  |
| extracted biomarkers, observations, revisions, shadow/history rows                 | worker, normalization, registry services | lineage and revision purge                          | PHI/mixed              |
| instrumental snapshot/content/publication/current pointer/measure/finding versions | PR2 prepare/finalize RPCs                | explicit restrict-FK publication purge              | PHI                    |
| clinical notes, prescriptions, referrals                                           | typed extraction worker                  | document-derived row purge                          | PHI                    |
| medical events and dates                                                           | document trigger and worker date sync    | document-derived event/date purge                   | metadata               |
| duplicate candidates and audit events                                              | duplicate detector/resolution route      | candidate cascade plus audit purge/detach           | metadata               |
| batch verification, EH-120 lifecycle, registry reprocess rows                      | review and registry services             | operation/revision purge or approved receipt policy | mixed                  |
| assessment dependency/jobs/versions/receipts                                       | capture triggers and assessment worker   | invalidation plus payload purge policy              | mixed                  |
| `ai_invocations`                                                                   | worker and report/synthesis tracing      | allowlisted non-PHI retention only after preflight  | mixed                  |
| `reports`, `profile_health_synthesis`, synthesis state                             | report route and synthesis service       | tombstone invalidation, whole-row purge             | PHI                    |

### Service-role readers, writers, and storage paths

- Readers: document detail/list/file/page/thumbnail/reprocess and biomarker
  routes; Biomarkers, Timeline, Health Profile, structured context, Reports,
  holistic synthesis, duplicate resolution, and the document worker.
- Mutations/finalizers: document reservation, storage intents, one-time broker
  tickets, job enqueue/claim/reclaim, lease-fenced worker writes,
  `request_document_deletion`, recursive cleanup, `finalize_document_deletion`,
  `create_validated_report`, `delete_owner_report`, and
  `persist_profile_health_synthesis`.
- Storage paths: owner original path; generation-scoped attempt thumbnail,
  page preview, OCR full-text/page JSON, and extraction JSON; plus every
  legacy `${profileId}/${documentId}` object discovered by recursive pagination.
- Expired pending/exchanged intents are failed and their exact registered
  objects are swept only after a live-intent recheck. Storage create credentials
  remain behind the app broker/cleanup boundary.

- Signed URL paths: document original, file, page preview, thumbnail, and list
  thumbnail helpers. Current TTL is 900 seconds; application revocation is not
  synchronous.

### Attributable findings and rollout gate

| Code       | Finding                                                                                                                         | Owner                  | Required evidence/boundary                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DDEL-001` | Durable code is statically covered, but no populated migrated target has supplied live retention/storage/FK-order evidence.     | Database/release owner | Apply migrations to a disposable populated target and run `pnpm preflight:document-deletion-data` before enabling owner deletion. |
| `DDEL-002` | The static inventory command does not inspect Docker, database, or storage, so it cannot produce target-specific live evidence. | Database/release owner | Preserve the database contract and retained-data/storage preflight results from the fully migrated target.                        |
| `DDEL-003` | Worker verification is blocked by the missing installed `@mistralai/mistralai` dependency in this checkout.                     | Worker/release owner   | Install worker dependencies and run `pnpm typecheck:worker` before deployment.                                                    |

### Retained-data preflight contract

- Command: `pnpm preflight:document-deletion-data`.
- The command is read-only, paginates every relation in 500-row pages, never
  prints report content, synthesis text, or raw telemetry values, and fails
  closed when the target cannot be initialized or queried.
- Reports are classified using `actual_source_document_ids` plus
  `source_scope_known`; empty/unknown/malformed scope is fail-closed.
  `content` and `summary_preview` are PHI-bearing columns; invalidation is
  whole-row, not field redaction.
- Current local disposable result: `READY_FOR_SCHEMA_PREFLIGHT` against the
  fully migrated empty Supabase target; all required reads returned zero rows
  and no findings. This proves the read-only query path only, not populated
  retained-data/storage evidence.

**Inventory result:** `BLOCKED`. The static inventory is executable through the
command above; deletion enablement is prohibited until all blocker boundaries
and the populated retained-data/storage/observability preflight are evidenced.

## Local / CI verification record

- [x] Static durable inventory: `pnpm preflight:document-deletion` emitted the
      redacted inventory and correctly exited non-zero because this static
      command cannot supply target-specific live evidence.
- [x] Retained-data preflight on the local disposable target:
      `pnpm preflight:document-deletion-data` emitted
      `READY_FOR_SCHEMA_PREFLIGHT`, with zero rows and no PHI output.
- [x] Root `pnpm typecheck`.
- [x] Root `pnpm test:eh104` / `check:no-legacy-promotion-rpc` (run during
      implementation).
- [x] `pnpm test:eh148-contract`, `pnpm test:document-worker`, and
      `pnpm test:document-persistence-boundaries`.
- [x] Targeted Prettier check and
      `openspec validate make-document-deletion-durable --strict`.
- [x] `pnpm test:eh104-durable-deletion-db` after `supabase db reset`; 36
      assertions passed, including tombstone idempotency, generation fencing,
      report/synthesis invalidation, grants, and writer rejection.
- [x] Focused DB regressions: `pnpm test:eh104-db` (42), `pnpm test:eh105-db`
      (16), `pnpm test:eh106-db` (38), `pnpm test:pr2-db` (45), plus
      `pnpm test:eh116-db` (42), `pnpm test:eh120-db` (50),
      `pnpm test:eh121-db` (37), `pnpm test:eh122-db` (19),
      `pnpm test:eh123-db` (21), `pnpm test:eh126-db` (26), and
      `pnpm test:eh130-db` (32).
- [x] `pnpm preflight:eh104` against the local disposable target returned
      `status: clean` with zero findings; unrelated app env keys were supplied
      as local-only placeholders.
- [ ] `pnpm typecheck:worker`; current checkout is blocked by missing
      `@mistralai/mistralai` and its dependent implicit-any diagnostic.
- [ ] Operator smoke after enforcement: delete, status/retry, accept resolved,
      accept partial, instrumental upload, and worker cancellation.

## Out of scope or not manually testable yet

- Internal field names (`verification_actor_type`, MATCH FULL, deferred
  constraints) are not required in the UI.
- Incomplete-outcome presentation polish remains EH-112.
- Record rejection workflow, batch idempotency, and auto-verify activation
  remain EH-120.
- Scoring eligibility is intentionally unchanged by EH-104.
- Do not mark manual checks passed until a tester records a result.
