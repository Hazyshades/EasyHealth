# Issue 120: Accepting a result the system recognized but could not fully identify

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

When you accept results from a lab report, some rows are fully identified and
some are only partly identified — usually because the report never printed which
specimen the test was run on. Before this change, the partly identified rows were
silently refused: the page reported that some results were accepted and gave no
usable reason for the rest. After this change every selected row is accepted, and
the partly identified ones are stored as unverified.

The boundary matters: a partly identified result is accepted, but it is still not
treated as a confirmed measurement. It must not appear in trends, health scoring,
or the abnormal-results view, and it must not display a specific test name it was
never matched to.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check
  intentionally tests processing.
- [ ] Confirm with the developer that migration `046` has been applied to the
  environment you are testing. Without it every check below fails in the same way
  the bug describes, and the failure is not a new defect.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `DOC-120-A` | A synthetic lab report containing at least one result whose specimen is not printed anywhere on the page (for example a bare `ALT 28 U/L` line with no "serum" or "plasma" wording) | Mixed acceptance: some rows fully identified, at least one only partly identified |
| `DOC-120-B` | A synthetic lab report where every result prints its specimen | Control: full acceptance must keep working unchanged |
| `DOC-120-C` | A synthetic report containing a label the catalog does not know at all (for example `Zzz marker 4.1`) | Unrecognized rows must still accept as raw evidence |

## Interface checks

### 120-UI-01: A mixed document accepts completely

**Precondition:** `DOC-120-A` has finished processing and its review screen lists
both fully identified and partly identified results.

1. Open **Documents** and select `DOC-120-A`.
2. Select **all** extracted results, including the ones marked as needing review.
3. Click **Accept**.

**Expected result:** Every selected row is accepted. The screen reports no
failures and no partial-success state. No row is left behind with an error code
such as `incomplete_normalization_cannot_have_concrete_identity`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### 120-UI-02: Accepting the same rows twice changes nothing

**Precondition:** 120-UI-01 has passed and its rows are accepted.

1. Reopen `DOC-120-A`.
2. Select the same rows again and click **Accept**.

**Expected result:** The action succeeds. No duplicate results appear anywhere in
the profile, and no error is shown.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### 120-UI-03: A partly identified result stays unverified

**Precondition:** 120-UI-01 has passed.

1. Open the accepted partly identified result from `DOC-120-A`.

**Expected result:** The result is visible with its raw name, value, and unit, and
is presented as needing review or unverified. It does **not** display a specific
catalog test name (for example it must not read "ALT, serum"), and it offers no
indication that its identity is confirmed.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### 120-UI-04: A partly identified result stays out of trends and scoring

**Precondition:** 120-UI-01 has passed and the accepted partly identified result
has a value outside its printed reference range.

1. Open **Biomarkers** / **Health profile**.
2. Look for the partly identified result in the trend charts and in any abnormal
   or out-of-range summary.
3. Open a generated report for the same period.

**Expected result:** The result does not appear in trends, is not counted as
abnormal, and is not used as a scored finding — even though its value is outside
the printed range. It may still appear in raw history and in the document view.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### 120-UI-05: Fully identified acceptance is unchanged

**Precondition:** `DOC-120-B` has finished processing.

1. Open `DOC-120-B`, select all results, and click **Accept**.
2. Open **Biomarkers**.

**Expected result:** All rows accept. Each appears with its specific catalog test
name, counts toward trends, and is treated as verified. This check exists to prove
the change did not weaken full identification.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### 120-UI-06: Unrecognized results still accept as raw evidence

**Precondition:** `DOC-120-C` has finished processing.

1. Open `DOC-120-C`, select the unrecognized result, and click **Accept**.

**Expected result:** The row accepts and is stored with its raw name, value, and
unit, with no catalog identity of any kind.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

These contracts sit below the interface and cannot be judged by a tester.

- [ ] **Migration `046` is deployed.** `supabase/migrations/046_incomplete_analyte_identity_gate.sql`
  recreates `write_observation_normalization_revision_v2_legacy`. Verify against the
  target database that the function body no longer contains
  `or target_analyte_key is not null`, and that the EH-115 wrapper
  `write_observation_normalization_revision_v2` still exists with 13 arguments.
  Provided by: whoever runs the deployment.
- [ ] **The two-tier guard behaves in both directions.**
  `supabase/tests/writer_rpc_seam.sql` (12 assertions) proves an incomplete payload
  carrying only an analyte key commits with `verification_status = 'pending'`, and an
  incomplete payload carrying a measurement definition key is still rejected with
  `incomplete_normalization_cannot_have_concrete_identity` and commits nothing.
  Runs in CI as `pnpm test:writer-seam`.
- [ ] **The stored projection matches.**
  `QA-Db_tests/eh111_clinical_compatibility.sql` (14 assertions, row `…1134`) proves the
  `observations` projection carries the analyte with a null measurement definition key.
  Runs in CI as `pnpm test:eh111-db`.
- [ ] **A rejected candidate cannot supply an identity.**
  `scripts/verify-measurement-registry-runner.ts` asserts that `urine_glucose` carrying a
  numeric value stays `partial` with a null analyte key, because its only candidate
  `glucose_urine_dipstick` is ordinal-only and hard-conflicts on value kind. Runs in CI as
  part of `pnpm verify:registry`.
- [ ] **The candidate release is re-approved.** `MEASUREMENT_RESOLVER_VERSION` is `10`.
  The catalog is untouched — `digestMeasurementRegistryManifest()` still equals the
  recorded release digest `5341c12e…f7357` — but `candidateInputHash` covers the
  resolver version, so it moved `f00c0e6f…74efd1` → `1ef42fbe…08c03`, all seven
  approvals in `registry/candidate-release/v1/approvals.json` detached, and
  `launchable` is `false` until the named owners re-sign. Corpus report rows and
  `thresholdChecks` are byte-identical with and without the change, so this is a
  signature refresh, not a clinical re-review. Provided by: assessment-owner,
  registry-safety-reviewer, release-manager. **This gates the release, not the
  interface checks above** — the fix works in a deployed environment regardless.
- [ ] **No stored data needs backfill.** The previous guard rejected every incomplete
  revision carrying an analyte, so no persisted row violates the new rule.

## Out of scope or not manually testable yet

- **Checks 120-UI-01 through 120-UI-06 cannot be run until migration `046` is applied
  to the tested environment.** Mark them `Blocked` rather than `Fail` if the deployment
  has not happened; the observed failure would be the original bug, not a regression.
- The end-to-end acceptance on document `f1410a30-6b94-49d4-8555-877dd4324f12` named in
  the change tasks belongs to the reporter's own environment. Locally the equivalent path
  was proven against the deployed primitive: the real resolver and the real
  `buildNormalizationResolutionPayload` output for an ALT row with no printed specimen
  committed one observation and one active revision with `analyte_key = 'alt'`, a null
  measurement definition key, and `verification_status = 'pending'`.
- The reviewer-facing display rule is deliberately unchanged. The stored analyte is not
  exposed by the API; `incomplete-laboratory-outcomes.ts` continues to report a null
  analyte for any row that is not binding-ready. That boundary is covered by
  `pnpm test:eh112` and is not part of this change.
