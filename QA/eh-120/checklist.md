# EH-120: Verification transitions for every resolver state

**Roadmap status:** Implemented; manual QA pending authenticated environment
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-120 keeps three independent facts visible for every laboratory result:
resolver outcome (`Resolved`, `More details needed`, `Multiple possible matches`,
or `Not recognized`), verification (`Not verified yet`, `Verified automatically`,
`Verified by you`, or `Corrected by you`), and record lifecycle (`Active`,
`Rejected`, or `Superseded`). A result may remain visible as raw evidence even
when it cannot enter Health Profile.

Owners may reject an active extracted source only after choosing a stable reason
and confirming the current source/revision snapshot. Rejected and superseded
sources remain available as read-only historical evidence; they cannot be
accepted, corrected, reversed, or batch-verified. Automatic verification is a
server-only state and has no reviewer control.

## Before you start

- [ ] Use a dedicated test account with no real patient data.
- [ ] Use only synthetic or de-identified laboratory reports.
- [ ] Confirm the listed test data has finished processing, unless the check
      intentionally tests processing.
- [ ] Keep a copy of each synthetic report and its expected result labels. Do
      not use a report containing real names, dates of birth, addresses, or
      medical-record identifiers.
- [ ] Run the build under test and record the commit or deployment identifier
      above.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH120-DOC-01` | Synthetic report with one reviewed, concrete result and one result with an explicitly printed incompatible/insufficient axis | Resolved versus incomplete resolver outcomes; active review actions |
| `EH120-DOC-02` | Synthetic report containing an unknown label and a label with two compatible candidate definitions | `Not recognized` and `Multiple possible matches` remain raw and unverified |
| `EH120-DOC-03` | Synthetic report with an active result that has been accepted, then reprocessed with a new extraction | Superseded historical evidence and replacement context |
| `EH120-DOC-04` | Synthetic report with an active extracted result that has never been accepted | Owner rejection, confirmation, and terminal read-only state |
| `EH120-ACCOUNT-02` | Second dedicated account with its own synthetic document | Ownership isolation; no cross-account lifecycle actions |

## Interface checks

### EH120-UI-01: Resolver, verification, and lifecycle axes stay independent

**Precondition:** `EH120-DOC-01` has finished processing. Its concrete result is
active and has not been accepted; its incomplete result is also active and
awaiting review.

1. Go to **Documents** and open `EH120-DOC-01`.
2. Find the concrete result and the incomplete result in the review list.
3. Read the status chips on each row and open **Technical details** if needed.

**Expected result:** Each row shows resolver outcome, verification status, and
record-lifecycle status as separate labels. The concrete active row can show
`Resolved`, `Not verified yet`, and `Active` together; `Resolved` does not imply
verified. The incomplete row shows its specific incomplete outcome and
`Not verified yet`, not `Rejected` or `Superseded`. No row is silently promoted
to a concrete definition because it has a numeric value.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-02: Incomplete raw evidence can be kept without verification

**Precondition:** The incomplete result in `EH120-DOC-01` has a resolver outcome
of `partial`, `ambiguous`, or `unmapped`, remains active, and has raw evidence.

1. Select only that incomplete result.
2. Click **Accept** (or the existing raw-acceptance control for the review
   workspace).
3. Wait for the document to refresh and reopen the result.

**Expected result:** The raw result is retained and visible with its original
reported value/evidence. It remains `Not verified yet` and is not presented as a
verified concrete measurement. The result does not enter Health Profile merely
because it was retained. No error claims that incomplete raw acceptance requires
concrete identity.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-03: Owner rejection requires a reason and explicit confirmation

**Precondition:** `EH120-DOC-04` has finished processing; its active extracted
source has not been rejected or superseded.

1. Open `EH120-DOC-04` in **Documents**.
2. Locate the target result and open the **Reject source** reason selector.
3. Confirm that the selector contains only safe reason labels, including
   **The result was extracted incorrectly**, **The result is a duplicate
   source**, **The result belongs to another document**, **Removed at the
   owner's request**, and **Other allowed reason**.
4. Choose **The result was extracted incorrectly** and click **Reject source**.
5. If a confirmation dialog or confirmation step appears, confirm the rejection.
6. Wait for the page to refresh.

**Expected result:** A reason is required; the reject control is disabled while
no reason is selected. The successful transition gives explicit feedback and
the row changes to `Rejected` / retained for audit history. Its original raw
evidence remains visible. No free-form document text is displayed as the stored
lifecycle reason.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-04: Rejected sources expose no current-result actions

**Precondition:** The target row from EH120-UI-03 is shown as `Rejected`.

1. Reopen `EH120-DOC-04` and select the rejected row.
2. Inspect the row controls, Technical details, and any acceptance/batch
   controls.
3. Try to select the row for acceptance or batch verification, if a control is
   still rendered.

**Expected result:** The row is visibly historical/read-only. Accept, reject,
correct, reverse, and batch-verify actions are absent or disabled. The row's raw
value and lifecycle reason remain available for audit context. The UI does not
change its verification status when the row is rejected.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-05: Superseded evidence remains visible with replacement context

**Precondition:** `EH120-DOC-03` has an accepted result, then document
reprocessing has completed and produced a replacement extraction.

1. Open `EH120-DOC-03`.
2. Find the result that existed before reprocessing.
3. Inspect its lifecycle and source text, then compare it with the replacement
   current result.

**Expected result:** The prior row remains visible as historical evidence and is
labelled `Superseded` / replaced during reprocessing. Replacement date and
processing-attempt context are shown when available. The old raw evidence is
unchanged. The superseded row is read-only and cannot be selected for acceptance,
correction, reversal, rejection, or batch verification. The replacement row is
the only current row eligible for review actions.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-06: Automatic verification is informational and read-only

**Precondition:** A service-controlled test fixture or seeded synthetic result
has an approved automatic quality-gate decision and shows `auto_verified`.
There must be no active human correction on that result.

1. Open the document containing the fixture.
2. Inspect the result's verification chip and Technical details.
3. Look for any reviewer control that would claim to perform automatic
   verification.

**Expected result:** The row says **Verified automatically** while retaining a
separate resolver outcome and `Active` lifecycle label. No user can forge,
select, or repeat the automatic-verification action from the product interface.
The persisted decision is attributed to the automatic/system actor in audit
read models, not to the signed-in owner.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-07: Correction and reversal keep their existing semantics

**Precondition:** An active, reviewable result in `EH120-DOC-01` has a compatible
manual mapping option and, after correction, exposes a **Restore** control.

1. Open **Technical details** for the result.
2. Choose a compatible mapping, enter a synthetic reason, and click **Use
   mapping**.
3. Confirm the row now shows **Corrected by you** without replacing the raw
   reported evidence.
4. Click **Restore** for the prior revision.
5. Wait for the refresh and inspect the result again.

**Expected result:** Correction and reversal use the existing controls and keep
the row active. The reported raw evidence remains unchanged; the corrected
measurement is presented as a separate derived value. Reversal returns to the
selected prior revision without deleting history or changing the row to
`Rejected`/`Superseded`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-08: Batch verification keeps its eligibility boundary

**Precondition:** `EH120-DOC-01` contains at least one eligible exact match, one
incomplete/ambiguous result, and (after EH120-UI-05) one superseded result.

1. Enable the document's batch-verification mode.
2. Inspect each row's batch checkbox or exclusion message.
3. Select only the eligible exact match and run batch verification.
4. Reopen the incomplete and superseded rows.

**Expected result:** Only the eligible active exact match can be selected. The
incomplete/ambiguous row explains that individual review is required, and the
superseded row is excluded because it is not current. Batch verification changes
only the selected active row and does not bypass source ownership, lifecycle,
or revision checks.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH120-UI-09: Lifecycle actions are owner-scoped

**Precondition:** `EH120-ACCOUNT-02` owns a different synthetic document. The
first account owns `EH120-DOC-04`.

1. Sign in as the second account and try to open the first account's document
   by URL.
2. If the document is not accessible, sign back in as the first account and
   continue with the next step.
3. As the first account, open `EH120-DOC-04` and confirm its own rejection
   control works only for its own active source.

**Expected result:** The second account receives the normal not-found/ownership
boundary and cannot view or mutate the first account's source. No rejection,
correction, acceptance, or lifecycle feedback reveals another owner's data.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

These contracts cannot be proven reliably through the product interface alone.
Attach command output, migration evidence, or a review link rather than marking
an unavailable UI as tested.

- [ ] **Transition policy:** `pnpm test:eh120` covers raw retention,
  user verification, automatic verification, correction, reversal, rejection,
  supersession, incomplete outcomes, protected human decisions, stable error
  codes, and deterministic lifecycle projections.
- [ ] **Database lifecycle contract:** `pnpm test:eh120-db`
  (`supabase/tests/eh120_verification_transitions.sql`) covers backfill and
  preflight, grants, row locks, owner/source checks, expected snapshots,
  request-hash idempotency, terminal-state guards, source lineage, automatic
  actor/status guards, append-only event capture, and direct-write denial.
- [ ] **API/service protection:** `pnpm test:eh120` verifies forged
  status/actor payloads, foreign ownership, stale source/revision snapshots,
  rejection reason validation, supersession, automatic-promotion quality gates,
  and protection of active human decisions. The route seam is
  `src/app/api/documents/[id]/biomarkers/reject/route.ts`; the service seam is
  `src/lib/documents/observation-lifecycle.ts`.
- [ ] **Document projection:** `pnpm test:eh120` verifies bootstrap and
  biomarker responses expose `recordStatus`, `sourceIsCurrent`, trace state,
  action availability, and stable exclusion reasons; rejected sources are not
  offered in current projections.
- [ ] **Health Profile boundary:** `pnpm test:eh120` plus
  `pnpm test:health-profile-lab-input` verify rejected/superseded sources,
  incomplete outcomes, non-laboratory observations, provisional definitions,
  missing active revisions, and incompatible bindings cannot enter scoring.
  Only a current laboratory observation with an active resolved trace, matching
  selected candidate/definition, reviewed Registry v2 provenance, and a reviewed
  compatible assessment binding is admitted.
- [ ] **Regression safety:** `pnpm test:eh104 && pnpm test:eh111 && pnpm
  test:eh116 && pnpm test:eh119 && pnpm test:eh121 && pnpm test:eh122`,
  `pnpm typecheck`, and `pnpm build` pass. Metadata-base warnings in a local
  build are non-blocking if the build still completes.
- [ ] **EH-123 handoff:** The downstream assessment recalculation owner
  confirms that lifecycle events carry a stable transition identity, prior and
  next resolver/verification/lifecycle state, request hash, reason code,
  source/observation identity, actor, timestamps, and processing/revision
  versions. Recalculation is idempotent by event/transition identity; failures
  retain retryable status and error detail without deleting the prior assessment
  version.

## Local verification record

- [x] `pnpm test:eh120` — focused transition, projection, UI seam, and audit
      read-model verifier passed.
- [x] `pnpm test:eh120-db` — 47/47 local pgTAP assertions passed after applying
      the migration to the local database. The initial local trigger test
      required restoring the migration's full `BEFORE INSERT OR UPDATE` event
      scope; the source migration is correct.
- [x] EH-104, EH-111, EH-116, EH-119, EH-121, and EH-122 regression suites —
      passed locally.
- [x] `pnpm typecheck` — clean.
- [x] `pnpm build` — completed successfully; Next.js emitted only the existing
      local `metadataBase` warning.
- [ ] Manual interface checks EH120-UI-01 … EH120-UI-09 — **not executed** in
      this workspace. Local Supabase verification is available, but no signed-in
      application session/test deployment is available. A tester must run the
      checks against an authenticated environment and record each result.

## Out of scope or not manually testable yet

- **Authenticated owner and concurrency races.** Stale snapshot, foreign-owner,
  duplicate-request, and simultaneous rejection/reprocessing checks require two
  authenticated sessions or direct service-role/database evidence. Use the
  automated API/database checks above; do not claim these as manual passes here.
- **Automatic-verification initiation.** Automatic verification is intentionally
  service-only. A tester may inspect a seeded result, but cannot initiate it from
  the UI; use the policy and database evidence for forged actor/status coverage.
- **Assessment invalidation/recalculation.** EH-123 owns downstream recalculation
  and failure recovery. EH-120 records the event contract and preserves the
  source/revision/lifecycle facts consumed by EH-123; it does not add an
  assessment-management screen.
- **Registry catalog growth, admin promotion, and automatic historical
  reprocessing** remain outside this change. Unknown labels stay raw/unmapped;
  no patient or LLM upload creates a definition or alias.
