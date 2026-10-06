# EH-149: Biomarker Dynamics Report

**Roadmap status:** Implemented; manual execution pending
**Build / environment:** `Local source verification completed; configured authenticated UI environment required for manual checks`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the report-ready dynamics view on the Biomarkers page: inclusive periods, deterministic statistics, numeric direction, incompatibility warnings, and point-level provenance. It does not test clinical improvement or deterioration claims because this change must not make them.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID                   | Test document or setup                                                                                                                              | Purpose                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `EH149-COMPAT-01`    | Three same-definition numeric observations, including both period boundaries and a timestamp late on the end boundary date                          | Statistics and direction             |
| `EH149-INCOMPAT-01`  | Same display name with different specimen or non-convertible unit                                                                                   | Separate-series warning              |
| `EH149-SINGLE-01`    | One numeric observation and one qualitative result                                                                                                  | Not-available direction              |
| `EH149-CONVERT-01`   | Convertible native/display unit fixture with stored range                                                                                           | Conversion provenance                |
| `EH149-EXCLUSION-01` | Authorized observations containing undated, qualitative, ineligible, unsupported-unit, and method/scale variants                                    | Exclusion and reason ledger          |
| `EH149-BIND-01`      | Report-generation fixture selecting `biomarker_dynamics_period`                                                                           | Server-owned report binding          |
| `EH149-SCOPE-01`     | Two owned eligible documents with only one included in the report's materialized scope                                                              | Scope-constrained dynamics           |
| `EH149-TIE-01`       | Two compatible numeric observations with the same observed timestamp and distinct immutable observation IDs                                         | Stable statistics/direction ordering |

## Interface checks

### EH149-UI-01: Apply an inclusive period

**Precondition:** The account has `EH149-COMPAT-01` and the Biomarkers page is available.

1. Go to **Biomarkers**.
2. Select the period containing the first and last boundary dates.
3. Open the dynamics view.

**Expected result:** Points on both boundaries are included. Points outside the period do not affect statistics or direction. The selected period is visible.

**Result:** `BLOCKED`
**Notes / evidence link:** The Sprint 7 run covered compatible-series range filtering and included the end-date observation, but the complete first-and-last boundary fixture assertion was not separately evidenced.

### EH149-UI-02: Review deterministic statistics

**Precondition:** `EH149-COMPAT-01` contains at least two numeric points.

1. Select the compatible series.
2. Compare the displayed minimum, maximum, latest value, point count, and direction with the fixture.
3. Read the direction label and disclaimer.

**Expected result:** Statistics match the selected points. Direction uses only numeric movement wording (`increasing`, `decreasing`, `stable`, or unavailable) and never claims improvement, deterioration, treatment response, or diagnosis.

**Result:** `PASS`
**Notes / evidence link:** The Sprint 7 run matched the compatible-series minimum, maximum, latest value, point count, and numeric direction limitation. The disclaimer did not claim improvement, deterioration, treatment response, or diagnosis.

### EH149-UI-03: Keep incompatible evidence separate

**Precondition:** `EH149-INCOMPAT-01` is loaded.

1. Open the dynamics view for the shared display name.
2. Inspect the series list and warning.
3. Compare each series' statistics.

**Expected result:** Incompatible observations are not merged. The warning states why they are separate, and each series has independent statistics and provenance.

**Result:** `BLOCKED`
**Notes / evidence link:** Incompatible specimen/unit separation and the separate-series warning were not executed in the authenticated UI run.

### EH149-UI-04: Inspect native value, range, and source

**Precondition:** `EH149-CONVERT-01` is loaded.

1. Open a converted point.
2. Inspect display and native values/units, reference range, observed date, and source document.
3. Select `EH149-SINGLE-01` and inspect its direction state.

**Expected result:** Native evidence and range remain visible beside any converted value. The one-point and qualitative cases show direction unavailable rather than fabricated numeric movement.

**Result:** `BLOCKED`
**Notes / evidence link:** The run captured native value, range, date, and source for the available compatible series, but the conversion-specific and one-point/qualitative fixture paths were not executed.

### EH149-UI-05: Freeze dynamics in a report

**Precondition:** The account has two or more synthetic eligible lab documents in the selected report scope.

1. Go to **Health reports** and choose **Create report**.
2. Enable the dynamics-period control.
3. Enter canonical `From` and `To` dates that contain the synthetic observations.
4. Create the report and open the generated report.

**Expected result:** The report shows the selected period, numeric direction, native value and range, and each point's source document and date. Reversing the dates shows validation and does not create a report.

**Result:** `BLOCKED`
**Notes / evidence link:** The Sprint 7 run did not execute this report-frozen UI scenario. The current report endpoint validates and persists the selected dynamics extension, so a dedicated authenticated fixture run is still required.

## Developer evidence required

- [x] Focused read-model verification: `pnpm test:eh149` with `SKIP_ENV_VALIDATION=1` covers canonical `YYYY-MM-DD` UTC-calendar-date boundaries including a late end-date timestamp, invalid/reversed/non-canonical periods, one-point and no-policy cases, equal-timestamp canonical observation-ID ordering, tolerance-based direction, non-numeric limitations, and exclusion reasons.
- [x] Identity fixtures in `scripts/verify-eh149-biomarker-dynamics.ts` prove measurement definition, specimen, modifier, method, scale, and non-convertible unit differences remain separate with their warning reason.
- [x] Scope guard verification proves an observation outside the authorized document set is rejected before projection. Full authenticated API boundary execution remains pending configured Supabase services.
- [ ] Report-binding evidence remains pending a dedicated authenticated report fixture run. The current implementation persists the server-owned dynamics extension through the validated report-generation path.
- [x] Scope-constrained synthetic evidence covers both `profile_current` and `report_immutable` projection scopes and rejects the second owned document from the selected report scope. Share/export isolation remains owned by EH-151/EH-153.
- [ ] A dedicated authenticated server-adapter fixture remains pending for exact immutable report scope and persisted dynamics binding. The profile-current dynamics API remains covered by `pnpm test:eh149`.
- [x] `pnpm typecheck` and `pnpm build` pass with placeholder environment values. `pnpm test:eh129` passes after the client migration.

## Out of scope or not manually testable yet

- Clinical interpretation rules and Registry definition changes are out of scope. The direction policy is numeric movement only and is not a clinical cutoff.
- PDF/CSV rendering is covered by EH-153; sharing/privacy controls are covered by EH-151 and EH-154.
- The Sprint 7 run provides partial authenticated evidence for compatible-series statistics and provenance. Exact boundary inclusion, incompatible-series separation, conversion and qualitative cases, and report-frozen dynamics remain blocked or unexecuted.

## Sprint 7 integration run: 2026-10-06

- **Environment:** Local Supabase, local Next.js at `http://localhost:3000`, authenticated synthetic owner account, and three same-definition Glucose observations from `Synthetic QA Lab`.
- **UI period and statistics:** `PASS` for the available compatible series. Setting `2026-09-01` through `2026-10-01` reduced the series from 3 to 2 points, showing dates `2026-09-10` and `2026-10-01`; **Clear range** restored all 3 points. The UI showed min `97.308 mg/dL`, max `109.922 mg/dL`, latest `109.922 mg/dL`, and `Direction: Not available` with the approved-threshold limitation.
- **UI provenance:** `PASS` for the available source path. Each point showed its laboratory-native value and range, synthetic lab, date, and **Open source** control.
- **Backend:** `PASS`. Authenticated `/api/biomarkers` returned 3 registry-ready, trend-eligible observations. `/api/biomarkers/dynamics` returned HTTP 200 with 3 points, and the ranged request returned 2 points. `pnpm test:eh149` passed.
- **Not executed:** incompatible specimen/unit separation, qualitative-only direction, conversion-specific provenance, tie ordering, and frozen report dynamics binding. No pass is claimed for those cases.
