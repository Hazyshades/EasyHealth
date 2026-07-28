# EH-106: Registry 2.0 runtime hard cutover

**Roadmap status:** Ready for manual QA; DB fixture is enforced in CI, with local execution pending Docker availability
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-106 moves the product from legacy Registry v1 semantics to Registry 2.0
identity. In the product, testers should see resolved lab results behave as
concrete reviewed measurements while incomplete results remain visible as raw
evidence without an invented specimen, conversion, trend, or score. It also
checks that instrumental observations remain separate from laboratory data.

## Before you start

- [ ] Use a dedicated test account and a disposable test profile.
- [ ] Use only synthetic or de-identified documents; never upload real health
  records.
- [ ] Confirm the listed test documents have finished processing, except where
  the check explicitly exercises a retry/reprocess flow.
- [ ] Sign in as the owner of the test profile in a supported browser.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH106-LAB-RESOLVED` | De-identified lab with ALT `21 U/L` and explicit serum or plasma evidence | Reviewed/resolved acceptance and downstream concrete behavior |
| `EH106-LAB-PARTIAL` | De-identified ALT `21 U/L` with no specimen evidence | Incomplete raw acceptance; no inferred concrete mapping |
| `EH106-LAB-AMBIGUOUS` | Seeded fixture with an ambiguous label or incompatible unit | Explicit ambiguous/unmapped behavior |
| `EH106-INSTRUMENTAL` | De-identified instrumental report with a numeric measure and source locator | Regression: not a laboratory trend or assessment input |

## Interface checks

### EH106-UI-01: Accept a reviewed resolved laboratory result

**Precondition:** `EH106-LAB-RESOLVED` is processed and appears in
**Documents** → **Extracted biomarkers**.

1. Open **Documents** and select `EH106-LAB-RESOLVED`.
2. In **Extracted biomarkers**, verify that the result is shown as a resolved
   mapping with a Registry 2.0 measurement definition.
3. Select the result and click **Accept selected**.
4. Refresh the page and reopen the same document.

**Expected result:** The result remains resolved and user-verified with the
same measurement identity. No legacy Registry v1/fallback label is shown.

**Result:** `________`  
**Notes / evidence link:** `________`

### EH106-UI-02: Accept incomplete raw evidence without inventing a mapping

**Precondition:** `EH106-LAB-PARTIAL` is processed and its ALT result is shown
as a recognized mapping with details pending.

1. Open **Documents** and select `EH106-LAB-PARTIAL`.
2. In **Extracted biomarkers**, read the mapping guidance.
3. Accept the raw result without choosing serum, plasma, or another concrete
   definition.
4. Refresh the document and open **Biomarkers**.

**Expected result:** The raw result remains visible as pending/incomplete.
The interface does not invent a specimen or concrete definition, and the item
does not appear in the trend selector as a concrete measurement.

**Result:** `________`  
**Notes / evidence link:** `________`

### EH106-UI-03: Preserve ambiguous or unmapped evidence

**Precondition:** `EH106-LAB-AMBIGUOUS` is processed and appears in
**Extracted biomarkers**.

1. Open the document in **Documents**.
2. Inspect the mapping status for the fixture result.
3. Accept the result only as raw evidence, if the review screen makes that
   action available.
4. Open **Biomarkers** and search for the result.

**Expected result:** The status stays explicitly ambiguous or unmapped. The
value is not represented as a verified concrete measurement, converted value,
or assessment input.

**Result:** `________`  
**Notes / evidence link:** `________`

### EH106-UI-04: Correct a result to a reviewed Registry 2.0 definition

**Precondition:** A processed test laboratory result has an available reviewed
manual definition in **Extracted biomarkers**.

1. Open the document in **Documents**.
2. Select a reviewed manual definition for the result.
3. Click the correction action and refresh the page after it completes.
4. Reopen the document and then open **Biomarkers**.

**Expected result:** The corrected definition is retained as a user decision
and is shown consistently in document review and Biomarkers. A retry does not
create a duplicate row.

**Result:** `________`  
**Notes / evidence link:** `________`

### EH106-UI-05: Keep incomplete and instrumental data outside concrete trends

**Precondition:** The profile contains accepted `EH106-LAB-RESOLVED`,
`EH106-LAB-PARTIAL`, and `EH106-INSTRUMENTAL` data.

1. Open **Biomarkers**.
2. Use **Needs mapping** and the trend selector.
3. Open **Health Profile**.
4. Compare the result/trend/assessment presentation with the source document.

**Expected result:** Reviewed resolved laboratory data can form a trend and
assessment-relevant input. Pending/incomplete and instrumental records do not
appear as concrete laboratory trends or assessment inputs.

**Result:** `________`  
**Notes / evidence link:** `________`

### EH106-UI-06: Generate a report without mislabeling data

**Precondition:** The same profile contains the test documents above and
**Reports** is available in the build under test.

1. Open **Reports** and create or preview a report for the test documents.
2. Inspect the lab facts and any instrumental findings in the generated
content.

**Expected result:** Resolved lab facts use Registry 2.0 identity. Incomplete
lab evidence is non-concrete, and instrumental records are not presented as
laboratory biomarkers.

**Result:** `________`  
**Notes / evidence link:** `________`

### EH106-UI-07: Safe retry after an accepted result

**Precondition:** Complete EH106-UI-01 or EH106-UI-04 successfully.

1. Refresh the document immediately after the action completes.
2. Repeat the same available accept/correction action, or reopen the result.
3. Check the result list and Biomarkers view.

**Expected result:** The product shows the existing completed state or a safe
conflict. It does not duplicate the observation or change unrelated results.

**Result:** `________`  
**Notes / evidence link:** `________`

## Developer evidence required

- [x] **Engineering / CI:** `pnpm check:no-registry-v1-runtime` rejects both
  direct and generated-v1 runtime dependencies while allowlisted audit and
  migration tooling remains usable.
- [x] **Engineering:** focused resolver, extraction, unit/assessment, API,
  report, structured-context, document-review, and active Registry 2.0
  revision-projection regressions pass.
- [x] **Engineering:** `test:eh106-writer` exercises the real independent
  batch helper: duplicate ids, a missing row, stale-row failure, and a
  succeeding sibling. The static boundary also verifies routing through the
  v2 writer primitive.
- [ ] **Database owner:** where a local Supabase stack is available, database
  fixtures cover service-only grants, v2 no-op/retry, resolved
  `user_verified` decision metadata, raw `partial`/`ambiguous`/`unmapped`
  `pending` states, reviewed correction `manually_corrected` decision
  metadata, expected-active CAS, ownership rollback, and direct-client denial.
- [x] **Engineering / CI configuration:** the `database` workflow job starts
  local Supabase and runs `pnpm test:eh106-db` on every pull request and main
  push; it stops the stack even after a test failure.
- [x] **Release owner:** candidate-corpus evidence records all 44 rows,
  fixed launch-size policy, required fixture/document coverage and raw
  document rows represented in the candidate corpus, deterministic input
  hashes, segmented outcome/coverage/error/assessment report, thresholds,
  named approvals, and reset/rollback notes.
- [x] **Engineering / CI:** candidate-corpus tests prove it does not call
  patient-state mutation paths or change observations, revisions, trends,
  readiness, scores, or manual decisions.
- [x] **Engineering / CI:** the published candidate-release artifact contains
  the combined report plus raw approvals and reset/rollback evidence.
- [x] **Engineering / CI:** typecheck and production build pass.

## Automated regression coverage (2026-07-20)

| EH-106 boundary | Automated evidence |
| --- | --- |
| Atomic acceptance and correction writer | `verify-eh106-writer-boundary`, `verify-eh106-acceptance-batch`, and the pgTAP `eh106_atomic_observation_normalization_writer.sql` contract (CI) |
| Consumer reads, conversions, assessment, reports | `verify-eh106-consumer-cutover`: active reviewed/resolved, partial/ambiguous/unmapped, provisional, inactive revision, instrumental, and key-only Health Profile rejection |
| Registry v1 removal and v2 runtime | `verify-registry-v2-runtime-cutover`, `check:no-registry-v1-runtime`, and `verify:registry` |
| Candidate-release governance | `verify-registry-v2-candidate-corpus-runner` validates the fixed 44 rows, coverage, raw-row integrity, approvals, thresholds, segments, processing errors, and artifact paths |
| Database execution | CI `database` job uses Supabase CLI 2.109.0 and runs `test:eh106-db`; not executed on this Docker-less workstation |

## Local verification record (2026-07-20)

- [x] `corepack pnpm test:eh106` passed with non-secret CI placeholder
  environment values: static writer boundary, independent acceptance batch,
  consumer cutover, Registry 2.0 runtime, and the non-mutating candidate-
  corpus gate.
- [x] `corepack pnpm verify:registry` passed with non-secret placeholder
  environment values; it includes the static v1-runtime ban and candidate
  corpus checks.
- [x] `corepack pnpm test:document-review`, `corepack pnpm test:document-worker`,
  and `corepack pnpm test:eh105` passed.
- [x] `corepack pnpm typecheck` and the production `corepack pnpm build` passed.
- [x] Candidate evidence is launchable: 44 rows, input hash
  `b4489a7cae9ab40cef27e308f1fe64fb45eca55cfe612d806a5c4370e0116b13`,
  manifest hash `a092449de73056b17b600dc6b9d2e5e141509ab362cb6e32ad73f8104045d754`.
- [ ] `corepack pnpm test:eh106-db` could not run locally because the Docker
  CLI is unavailable (`supabase --version` is `2.109.0`). The CI `database`
  job now runs it in a Docker-enabled environment; its fixture covers
  service-only access, CAS, ownership rollback, idempotency, resolved and
  incomplete acceptance, correction, and direct-client denial.

## Out of scope or not manually testable yet

- Candidate-release corpus execution, threshold evaluation, approval evidence,
  manifest hashing, and CI gates have no end-user UI. Validate them through the
  developer evidence and published release artifacts, not by inventing a
  screen.
- EH-104 Phase B is out of scope for EH-106: final actor/cross-axis guards,
  `MATCH FULL`, controlled purge enforcement, and legacy promotion-RPC removal
  remain deferred until compatible writers are deployed and the populated-data
  preflight passes.
- Persistent-environment preflight/reset decisions are operational work, not a
  tester UI action. The database/release owner must supply the diagnostics and
  approved reset or abort evidence.
- There is no existing browser E2E harness in this repository. The interface
  scenarios above remain manual QA until one is deliberately introduced.
- No checks above are marked passed until a tester records a result and
  supporting evidence.
