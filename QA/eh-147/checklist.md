# EH-147: Assessment golden dataset and release gate

**Roadmap status:** In progress
**Build / environment:** local `corepack pnpm` on the EH-147 worktree; EasyHealth Next on `localhost:3001`; Docker Supabase (`127.0.0.1:54321` API, `54322` DB, Mailpit `54324`)
**Test run date:** 2026-08-26
**Tester:** local EH-147 UI+backend run (synthetic accounts only)

## What this checklist covers

The Health Profile already scores eight named body systems when every required group is usable. This change does not add a new screen. It locks those scores, readiness reasons, unit presentation, and correction admission behind a synthetic golden pack so Health Profile v1 cannot silently drift.

## Before you start

- [x] Use a dedicated test account if you also walk the Health Profile UI.
- [x] Use only synthetic or de-identified documents.
- [x] Do not treat Clinical Product sign-off as passed unless `QA/eh-147/approvals.json` contains a hash-bound approval for the current pack.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH147-GOLDEN` | Committed pack in `QA/eh-147/fixtures/` (`eh147-golden-v1`) | Technical expected outputs for all eight systems |
| `EH147-UI-COMPLETE` | Synthetic lab PDF covering LDL or non-HDL, HDL, triglycerides, fasting glucose or HbA1c, TSH, free T4, ALT, AST, ALP, bilirubin, albumin, eGFR or creatinine, UACR, hemoglobin or hematocrit, WBC, platelets, MCV, vitamin D, B12, folate | Complete in-range Health Profile |
| `EH147-UI-MISSING` | Same pack minus one required group (for example no TSH) | Null score and missing-group copy |
| `EH147-UI-CORRECT` | One resolved glucose row left `pending`, then marked `manually_corrected` | Pending excluded; corrected admitted |

## Interface checks

### EH147-UI-01: Complete in-range current-state scores

**Precondition:** `EH147-UI-COMPLETE` is accepted, resolved, verified, and has document-native ranges. Assessment job has finished.

1. Go to **Health Profile**.
2. Open each named system on the body map: Cardiovascular, Metabolic, Thyroid, Liver, Kidney, Blood, Nutrients, Inflammation.

**Expected result:** The seven scoreable systems show a numeric current-state score, not a zero placeholder. Inflammation remains factual-only with no numeric score. Copy does not call the scores a diagnosis.

**Result:** `Pass`
**Notes / evidence link:** Browser session `eh147-complete@easyhealth.local` on `/app/profile` (account EH147 C.). Heart/Metabolic/Thyroid/Liver/Kidney/Blood/Nutrients drawers each showed `95/100` current-state assessment, not `0`. Inflammation showed em dash, `Assessment unavailable`, and `Not scored - individual markers only` with CRP `1.2 mg/l` still visible. Page copy: `This is not a diagnosis or disease-risk score.` Source: `EH147-UI-COMPLETE.pdf`. Smoke: `pnpm smoke:eh147` UI-01/UI-02 copy checks passed.

### EH147-UI-02: Missing required group stays unscored

**Precondition:** `EH147-UI-MISSING` is the only current evidence for that system.

1. Go to **Health Profile**.
2. Open the incomplete system.

**Expected result:** That system shows insufficient evidence / assessment unavailable, not `0`. Source markers that are present remain visible. Other complete systems may still score.

**Result:** `Pass`
**Notes / evidence link:** Browser session `eh147-missing@easyhealth.local` (EH147 M.). Thyroid map control: `insufficient data; assessment unavailable`. Drawer: em dash, `Assessment unavailable`, `Not scored - incomplete core`, needed `tsh`; `free_t4` `15 pmol/l` remained visible. Other complete systems still `95/100`. Source: `EH147-UI-MISSING.pdf`.

### EH147-UI-03: Pending correction is not scored; manually corrected is

**Precondition:** `EH147-UI-CORRECT` glucose is visible on **Biomarkers**.

1. Confirm the pending row shows assessment-exclusion guidance and does not change Metabolic readiness.
2. Apply the existing observation correction path so verification becomes `manually_corrected`.
3. Wait for Health Profile recalculation.

**Expected result:** After correction, a usable fasting/glycemia input can satisfy Metabolic readiness when the rest of the group policy is met. The raw laboratory value is never labeled invalid merely because it was pending.

**Result:** `Pass`
**Notes / evidence link:** Session `eh147-correct@easyhealth.local` (`EH147 C.`). Before correction: Biomarkers `fasting_glucose` `5 mmol/l` Normal with `Not used in assessment: This result is not verified yet.`; Metabolic `insufficient data; assessment unavailable`. After EH-119 `PATCH /api/documents/{id}/biomarkers` `edit-value` on extracted row `26b9e2c6-…`, revision `3d96439a-…` is `manually_corrected` + `resolved` `fasting_glucose`. Recalculation via `complete_assessment_recalculation_job`. Health Profile Metabolic `95/100` with `fasting_glucose` `5 mmol/l` in the drawer. Biomarkers still `5 mmol/l` Normal and no longer shows `not verified yet`. Seed script now stores extracted measurement fields so this path can be re-run.

## Developer evidence required

- [x] `pnpm test:eh147` — committed golden cases match production admission, readiness, scores, and SI/US presentation. Owner: implementer. Result: passed locally on 2026-08-26, pack hash `6fcbe8567c0173062bfbfce6a9c9f9469843ff49d02faba60369f51be506a7ed`, 22/22 cases.
- [x] `pnpm check:eh147` — fail-closed without Clinical Product hash-bound approval. Owner: implementer. Result: failed as required on 2026-08-26 (`PENDING` sign-off).
- [x] Database tests — EH-147 itself does not persist rows. Related local Docker DB gates on 2026-08-26: `pnpm test:eh144-db` 14/14; `pnpm test:eh123-db` 21/21; `pnpm test:eh119-db` 39/39.
- [x] `pnpm test:eh141`, `pnpm test:eh142`, `pnpm test:eh143`, `pnpm test:eh145`, `pnpm test:eh119`, `pnpm test:eh144`, `pnpm test:health-profile-lab-input`, `pnpm test:health-profile-drawer-status` passed on 2026-08-26. `pnpm typecheck`, `pnpm check:ci-suite-coverage`, `pnpm check:ci-suite-coverage-contract`, and `openspec validate eh-147-create-assessment-golden-dataset-and-release-gate --strict` passed on 2026-08-26 (implementer run).
- [x] Registry documentation generate/check/test passed on 2026-08-26. Wiki remote publication is `PENDING` on tracking issue [#185](https://github.com/Hazyshades/EasyHealth/issues/185); local staging export is under `tmp/eh147-wiki-staging`.

## Out of scope or not manually testable yet

- Clinical Product hash-bound acceptance of Health Profile v1. Recorded as `PENDING` until `QA/eh-147/approvals.json` matches the current pack hash.
- Changing score formulas, Registry bindings, or adding a new Health Profile API.
- Diagnoses, disease-risk labels, or test-ordering advice.
