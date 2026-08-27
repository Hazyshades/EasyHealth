# EH-147: Assessment golden dataset and release gate

**Roadmap status:** Done
**Build / environment:** local `corepack pnpm` on the EH-147 worktree; baseline EasyHealth Next on `localhost:3001` and worktree UI smoke on `localhost:3100`; Docker Supabase (`127.0.0.1:54321` API, `54322` DB, Mailpit `54324`)
**Test run date:** 2026-08-27
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

**Result:** `Blocked`
**Notes / evidence link:** Session `eh147-correct@easyhealth.local` (`EH147 C.`). The pending row and exclusion guidance were visible, but the live EH-119 `edit-value` correction on the OCR-less synthetic document did not retain the reviewed `fasting_glucose` identity: the row became `partial`/`unmapped` because specimen/timing evidence was absent. This is a seed/provenance limitation, not a scoring defect. The correction admission remains covered by the EH-147 golden pack plus `pnpm test:eh119` and `pnpm test:eh119-db`.

### EH147-UI-04: Reported-results recovery notice

**Precondition:** A processed synthetic report contains at least one current extracted laboratory row with a safe non-score reason; for mixed coverage, the same account also has at least one ready observation.

1. Go to **Health Profile**.
2. Confirm the reported-results notice shows reported and ready-for-scoring counts plus the document-detail/catalog-review buckets.
3. Open **Review results** and confirm navigation stays on the authenticated documents surface.
4. On **Dashboard**, confirm an existing processed report does not produce the duplicate `Upload your lab` prompt.

**Expected result:** The notice preserves factual result context, explains why unresolved rows do not affect scores, and leaves any existing body-map scores/readiness unchanged.

**Result:** `Blocked`
**Notes / evidence link:** Local browser smoke on `localhost:3100` authenticated as `EH147 M.` reached the mixed-capability `body_map` route and `GET /api/health-profile` returned `reported_count: 20`, `ready_for_scoring_count: 20`, and `source_document_count: 1`; no build error occurred. The local seed did not provide a current unresolved extracted row for the notice branch, so the notice/review-link interaction was not claimed as manually passed. Pure contract coverage is recorded below; a prepared unresolved-row fixture is required for a manual Pass.

## Developer evidence required

- [x] `pnpm test:eh147` — 22/22 golden cases passed on 2026-08-27 with pack hash `6fcbe8567c0173062bfbfce6a9c9f9469843ff49d02faba60369f51be506a7ed`.
- [x] `pnpm check:eh147` — passed on 2026-08-27; `QA/eh-147/approvals.json` contains the matching Clinical Product approval for the same pack hash.
- [x] `pnpm test:health-profile-reported-results` — zero, mixed, all-ready summaries and onboarding/no-recognized/reported-only/body-map display states passed on 2026-08-27.
- [x] Focused application contracts — `scripts/verify-document-review-runner.ts`, `scripts/verify-eh122-batch-service.ts`, and `scripts/verify-health-profile-drawer-status.ts` all passed on 2026-08-27 with the repository env file; the import-boundary client smoke on `localhost:3100` returned HTTP 200 without a Next build error.
- [x] `pnpm typecheck` — passed on 2026-08-27.
- [x] Local Docker Supabase database contracts — `pnpm test:eh119-db` 39/39, `pnpm test:eh122-db` 19/19, `pnpm test:eh123-db` 21/21, `pnpm test:eh142-db` 8/8, and `pnpm test:eh144-db` 14/14 passed on 2026-08-27.
- [x] CI registration — `pnpm check:ci-suite-coverage` reported `85 covered, 0 local-only, 0 orphaned, 0 partial, 0 invalid`; `pnpm check:ci-suite-coverage-contract` passed on 2026-08-27.
- [x] Existing EH-119 correction and EH-147 golden checks remain available for the pending/`manually_corrected` admission boundary; the blocked UI correction is not replaced by an OCR-less shortcut.
- [x] Registry documentation generate/check/test passed on 2026-08-26. Tracking issue [#185](https://github.com/Hazyshades/EasyHealth/issues/185) records Wiki status `PUBLISHED` at Wiki commit `6e610d83`; canonical documentation and generated mirror remain synchronized.

## Out of scope or not manually testable yet

- The manual `EH147-UI-03` correction transition and `EH147-UI-04` unresolved-results notice interaction remain blocked by the available synthetic fixture/provenance; use a real OCR-like document or a seed row with retained source context, then rerun the interface steps.
- Deferred reviewed panel specimen policy remains owned by #111; reported-results product ownership remains tracked by #127. Neither is described here as implemented.
- Changing score formulas, Registry bindings, or adding a new Health Profile API.
- Diagnoses, disease-risk labels, or test-ordering advice.
