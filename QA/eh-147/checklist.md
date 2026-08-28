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
| `EH147-UI-CORRECT` | Isolated Docker seed row with retained OCR-like source context (`Fasting glucose 5.4 mmol/l`, `Specimen: plasma`, `Collection timing: fasting`), then corrected through the live EH-119 form | Pending excluded; corrected admitted |
| `EH147-UI-04-UNRESOLVED` | Isolated Docker document `EH147-UI-04-UNRESOLVED-OCR.pdf` with one current unresolved row | Report found; raw value preserved; no score |
| `EH147-UI-04-MIXED` | Isolated Docker document `EH147-UI-04-MIXED-OCR.pdf` with 21 ready rows and one unresolved row | Notice counts unresolved data without changing scores |

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
**Notes / evidence link:** Live browser session on `localhost:3100`, account `eh147-ui03-correction-ready3@easyhealth.local`, document `cdfd5b13-444d-4c6a-8bc3-c57c393f1b60` (`EH147-UI-03-CORRECTION-READY3-OCR.pdf`). Before correction, the Health Profile showed Metabolic `—`, `Assessment unavailable`, and `Needed for this assessment: fasting_glucose or hba1c`; the document review showed `5.4 mmol/l`, `Plasma · Fasting · Automated`, `Not verified yet`, and the retained source snippet. The live correction changed the value to `5 mmol/l` with a reason; the review summary became `21 results · 20 matched · 1 incomplete · 0 not verified` during refresh and the fasting row showed `Corrected to 5 mmol/l`, `corrected by you`, `Active`, and `high mapping confidence`. After recalculation, Metabolic showed `95/100`, `Stable`, and the drawer displayed `fasting_glucose`, `5 mmol/l`, `Specimen: plasma`, `Within lab reference range`, with the raw source document link. No raw value was labeled invalid merely because it was pending.

### EH147-UI-04: Reported-results recovery notice

**Precondition:** A processed synthetic report contains at least one current extracted laboratory row with a safe non-score reason; for mixed coverage, the same account also has at least one ready observation.

1. Go to **Health Profile**.
2. Confirm the reported-results notice shows reported and ready-for-scoring counts plus the document-detail/catalog-review buckets.
3. Open **Review results** and confirm navigation stays on the authenticated documents surface.
4. On **Dashboard**, confirm an existing processed report does not produce the duplicate `Upload your lab` prompt.

**Expected result:** The notice preserves factual result context, explains why unresolved rows do not affect scores, and leaves any existing body-map scores/readiness unchanged.

**Result:** `Pass`
**Notes / evidence link:** Live browser sessions on `localhost:3100` covered both branches. Unresolved-only account `eh147-ui04-unresolved@easyhealth.local` showed `Report found, scoring not ready`, `Reported results 1`, `Ready for scoring 0`, `Await catalog review 1`, and `Review results`; the authenticated link opened Documents, where `Mystery analyte`, `7.2 unit`, `Measurement not recognized`, and `The raw result is preserved, but no authorized Registry 2.0 measurement matched` were visible. Dashboard showed `Add document` only and no duplicate `Upload your lab` prompt. Mixed account `eh147-ui04-mixed@easyhealth.local` showed `Reported results 22`, `Ready for scoring 21`, `Await catalog review 1`, all seven scoreable systems at `95`, and Inflammation `—`; Review results opened `EH147-UI-04-MIXED-OCR.pdf`, where `22 results · 21 matched · 1 incomplete · 1 not verified` and the same raw unresolved row were visible. Dashboard retained the existing assessment card and showed `Processed results are available. Review them before adding a clearer report`, with no `upload your lab` prompt.

## Developer evidence required

- [x] `pnpm test:eh147` — 22/22 golden cases passed on 2026-08-27 with pack hash `6fcbe8567c0173062bfbfce6a9c9f9469843ff49d02faba60369f51be506a7ed`.
- [x] `pnpm check:eh147` — passed on 2026-08-27; `QA/eh-147/approvals.json` contains the matching Clinical Product approval for the same pack hash.
- [x] `pnpm test:health-profile-reported-results` — zero, mixed, all-ready summaries and onboarding/no-recognized/reported-only/body-map display states passed on 2026-08-27.
- [x] Focused application contracts — `scripts/verify-document-review-runner.ts`, `scripts/verify-eh122-batch-service.ts`, and `scripts/verify-health-profile-drawer-status.ts` all passed on 2026-08-27 with the repository env file; the import-boundary client smoke on `localhost:3100` returned HTTP 200 without a Next build error.
- [x] `pnpm typecheck` — passed on 2026-08-27.
- [x] Local Docker Supabase database contracts — `pnpm test:eh119-db` 39/39, `pnpm test:eh122-db` 19/19, `pnpm test:eh123-db` 21/21, `pnpm test:eh142-db` 8/8, and `pnpm test:eh144-db` 14/14 passed on 2026-08-27.
- [x] CI registration — `pnpm check:ci-suite-coverage` reported `87 covered, 0 local-only, 0 orphaned, 0 partial, 0 invalid`; `pnpm check:ci-suite-coverage-contract` passed on 2026-08-27.
- [x] Existing EH-119 correction and EH-147 golden checks remain available for the pending/`manually_corrected` admission boundary; live UI-03 used a retained OCR-like source-context seed and completed the same admission path.
- [x] Registry documentation generate/check/test passed on 2026-08-27. Tracking issue [#185](https://github.com/Hazyshades/EasyHealth/issues/185) records Wiki status `PUBLISHED` at Wiki commit `6e610d83`; canonical documentation and generated mirror remain synchronized.

## Out of scope or not manually testable yet

- Deferred reviewed panel specimen policy remains owned by #111; scoped context confirmation and catalog promotion are not claimed because those options are not shipped in this change.
- Changing score formulas, Registry bindings, or adding a new Health Profile API.
- Diagnoses, disease-risk labels, or test-ordering advice.
