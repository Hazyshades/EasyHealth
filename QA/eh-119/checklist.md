# EH-119: Observation edit and correction flow

**Roadmap status:** Implementation complete; manual QA pending
**Build / environment:** Windows local workspace; CI/deployed review route required for UI execution
**Test run date:** `2026-08-10` (developer evidence)
**Tester:** Implementation agent (automated evidence only)

## What this checklist covers

This checklist covers correcting a laboratory result in the Documents review workspace without replacing the extracted source evidence. A reviewer can restate the reported value, unit, reference range, or date, must provide a reason, and can undo a correction by restoring an earlier append-only revision. Mapping changes remain constrained to compatible, evidence-supported definitions; incomplete results can remain raw or partial.

The correction form is available only for laboratory extraction rows in the current document review workspace. Batch reprocessing, verification-state transitions, dependent assessment invalidation, and history views belong to EH-116, EH-120, EH-121, and EH-123 and are listed as out of scope below.

## Before you start

- [ ] Use a dedicated test account with access to **Documents**.
- [ ] Use only synthetic or de-identified laboratory documents.
- [ ] Confirm the document has finished processing and is in **Needs review** or another state that exposes extracted laboratory rows.
- [ ] Use a document with a clearly printed numeric result, unit, reference range, and report date.
- [ ] Keep the original test document unchanged so raw-vs-corrected evidence can be compared.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH119-NUMERIC-01` | Synthetic laboratory report containing `ALT 32 U/L`, reference range `0–41`, and a report date no later than today; use a fixture whose initial extraction records `31` to exercise a safe correction | Normal value, range, unit, and date correction |
| `EH119-INCOMPLETE-01` | Synthetic laboratory row with a recognized analyte but no stated specimen or method | Confirm no missing clinical axis is guessed and raw/partial acceptance remains available |
| `EH119-INVALID-01` | The same synthetic numeric row, used with an inverted range, future date, blank/unknown unit, and an empty reason | Validation and actionable error checks |

## Interface checks

### EH119-UI-01: Correct a reported value and range

**Precondition:** `EH119-NUMERIC-01` is open in **Documents** and its extracted laboratory row is visible in the review workspace.

1. Open the row's correction controls.
2. Change the reported value from `31` to the value printed in the synthetic fixture, `32`.
3. Change the upper reference bound from `41` to `42`.
4. Enter the reason `The printed result is 32, not 31.`
5. Select **Save correction**.
6. Reload the document review workspace.

**Expected result:** The correction is saved and the row indicates that it was corrected. The correction form shows `32` and the updated range. The original extraction remains available as the raw reported evidence; it is not silently replaced.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH119-UI-02: Correct the unit and report date

**Precondition:** `EH119-NUMERIC-01` is open and the correction form is available.

1. Change the unit to the unit printed in the fixture.
2. Set the report date to a past date printed by the fixture.
3. Enter a reason explaining the correction.
4. Select **Save correction** and reload the workspace.

**Expected result:** The corrected unit and date persist in the correction form and the row remains tied to the same source extraction. No raw unit, source text, provenance, or source-page field is presented as overwritten.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH119-UI-03: Reject invalid corrections with an actionable message

**Precondition:** `EH119-INVALID-01` is open with the correction form visible.

1. Enter an upper reference bound below the lower bound.
2. Try to save without a reason.
3. Enter a future report date and try again.
4. Enter a blank or unsupported unit and try again.

**Expected result:** Each invalid submission is blocked. The form displays an actionable message naming the failed correction (range, reason, date, or unit). No new correction is shown as saved after a rejected submission.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH119-UI-04: Keep an incomplete result raw or partial

**Precondition:** `EH119-INCOMPLETE-01` is open and the row is recognized but lacks a specimen or method stated in the document.

1. Open the row's mapping choices.
2. Review the available compatible definitions.
3. Do not select a definition that requires an unstated specimen or method.
4. Choose the workspace's raw/incomplete acceptance action, if exposed.
5. Confirm the result.

**Expected result:** The reviewer is not forced to guess a specimen or method. The row remains partial, ambiguous, unmapped, or raw as appropriate, and no incompatible definition is presented as active identity.

**Result:** `Not run`
**Notes / evidence link:** `________`

### EH119-UI-05: Undo a saved correction

**Precondition:** `EH119-UI-01` has passed and the corrected row exposes its revision controls.

1. Open the row's revision or undo controls.
2. Select the earlier revision that contains the original measurement.
3. Enter `The correction was reverted after checking the source.` when a reason is requested.
4. Select **Undo** or **Restore**.
5. Reload the document review workspace.

**Expected result:** The earlier measurement override is restored through a new append-only mutation. The raw extraction remains unchanged, the restored row no longer shows the superseded correction as active, and the correction history does not lose the prior revision.

**Result:** `Not run`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:eh119` passes. This proves override allowlisting, value/range/date/unit validation, comparator preservation, acknowledged definition loss, and raw-vs-corrected review projection. Evidence owner: implementation author or CI.
- [x] `pnpm typecheck` passes. This proves the API, writer, review model, and correction form agree on the correction contract. Evidence owner: implementation author or CI.
- [x] A local Supabase migration run applies `supabase/migrations/047_eh119_observation_measurement_correction.sql` successfully. Direct `docker exec ... psql` evidence shows the override guard, append-only revision path, raw-column protection, and service-only writer execution. Evidence owner: database reviewer or CI.
- [x] A pgTAP/SQL test proves two correction writes produce two revisions, only the latest revision is active, the observation projection reflects the latest override, raw extraction columns remain unchanged, and an invalid override is rejected. `QA-Db_tests/eh119_observation_measurement_correction.sql` passed 39/39 through the local Postgres container. Evidence owner: database reviewer or CI.
- [ ] An API check proves correction requests require a reason, use the document owner's profile, reject incompatible units/ranges/dates, and return the field-specific error without creating a revision on failure. Live authenticated HTTP execution was not available; route and validation contracts are covered by `pnpm test:eh119`.
- [x] An RPC-level check proves the correction request hash is idempotent and concurrent stale expected-active revisions are rejected rather than silently overwriting the active revision. The 39-case SQL contract passed; HTTP concurrency remains for CI/API QA. Evidence owner: database/API reviewer or CI.

## Out of scope or not manually testable yet

- EH-120 verification transitions for every resolver state; correction writes preserve the existing verification policy but do not implement that roadmap item.
- EH-121 history endpoint and dedicated history UI; this checklist verifies append-only behavior through developer evidence until that interface exists.
- EH-123 dependent assessment invalidation and recalculation.
- EH-116 batch reprocessing protection and batch UI.
- Corrected `partial`, `ambiguous`, and `unmapped` rows remain excluded from trends, reports, context, conversion, and assessment by the existing `baseExclusion` consumer gate. This is intentional and is not an EH-119 defect.
- EH-125 source-region hover highlighting.
- Local UI execution is unavailable in this workspace: the review route fails before rendering because Turbopack cannot resolve the declared Radix package link and webpack rejects a transitive `node:crypto` import. Run EH119-UI-01…05 in CI or a deployed build; do not claim these checks passed from the public shell smoke.
- If the current deployed build does not expose revision restore controls, mark **EH119-UI-05** as `Blocked` and provide the API/database evidence above; do not claim the unavailable control was tested.


## Automated regression coverage (2026-08-10)

| EH-119 contract | Automated evidence |
| --- | --- |
| Override allowlist, immutable raw-vs-corrected projection, censored text, validation codes | `scripts/verify-eh119-measurement-override.ts` via `pnpm test:eh119` — passed |
| Corrected-input review projection, picker inputs, request-hash idempotency, reprocessing protection | `scripts/verify-eh119-correction-flow.ts` via `pnpm test:eh119` — passed |
| Correction form has no specimen, modifier, timing, or method control; row renders correction outside technical details | Static assertions in `scripts/verify-eh119-correction-flow.ts` — passed |
| EH-117/EH-118/EH-116 regressions | `pnpm test:eh117`, `pnpm test:eh118`, `pnpm test:eh116` — passed |
| EH-106 atomic writer and existing acceptance/CAS/lineage paths | `pnpm test:eh106` with CI placeholders plus direct `eh106_atomic_observation_normalization_writer.sql` — passed |
| Registry-wide compatibility, candidate corpus and approval gate | `pnpm verify:registry` with CI placeholders — passed; `launchable: true`, `approvalErrors: []`, resolver `10`, catalog `2026-08-03.0` |
| Database override shape, append-only correction, partial pending outcome, replay, CAS, raw write-once trigger | `QA-Db_tests/eh119_observation_measurement_correction.sql` via direct local Postgres — passed 39/39; `pnpm test:eh119-db` wrapper remains blocked by the Windows Docker mount |
| Real writer-to-RPC override seam | `supabase/tests/writer_rpc_seam.sql` via direct local Postgres — passed 15/15; `pnpm test:writer-seam` wrapper remains blocked by the same Docker mount |
| EH-111 clinical compatibility baseline | `pnpm test:eh111` — pre-existing failure at `verify-eh111-clinical-compatibility.ts:184`; not changed or masked by EH-119 |
## Local verification record (2026-08-10)

Run from the EH-119 branch root after the fast-forward to `origin/master` at
`d7548d3`.

- [x] `pnpm typecheck`
- [x] `pnpm test:eh119`
- [x] `pnpm test:eh117`
- [x] `pnpm test:eh118`
- [x] `pnpm test:eh116`
- [x] `pnpm test:eh106` with the four CI placeholder environment variables
- [x] `pnpm verify:registry` with the four CI placeholder environment variables
- [x] `openspec validate eh-119-implement-observation-edit-and-correction --strict`
- [x] `supabase migration up --local` reports no pending migrations; direct Postgres execution passed both EH-119 SQL files.
- [ ] `pnpm test:eh119-db` — Supabase CLI is blocked before SQL execution by the Windows Docker host-mount error; equivalent direct `psql` evidence passed 39/39.
- [ ] `pnpm test:writer-seam` — same Docker host-mount limitation; equivalent direct `psql` evidence passed 15/15.
- [ ] `pnpm test:eh111` — pre-existing failure at
  `percentAgainstAbsolute.conflicts.includes("unit_dimension_conflict")`; recorded for
  EH-119 without masking or changing that baseline.

The local review route could not be browser-smoked because of the documented Next
build errors. The public application shell rendered, but no authenticated review
controls were claimed as tested. CI/deployed manual QA must execute EH119-UI-01…05.