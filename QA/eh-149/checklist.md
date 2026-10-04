# EH-149: Biomarker Dynamics Report

**Roadmap status:** Implemented; manual execution pending
**Build / environment:** `Local source verification completed; configured authenticated UI environment required for manual checks`
**Test run date:** `2026-09-27`
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
| `EH149-BIND-01`      | Report-generation fixture selecting `biomarker_dynamics_period`; execution is blocked until the current EH-150 structured persistence seam is wired | Server-owned report binding          |
| `EH149-SCOPE-01`     | Two owned eligible documents with only one included in the report's materialized scope                                                              | Scope-constrained dynamics           |
| `EH149-TIE-01`       | Two compatible numeric observations with the same observed timestamp and distinct immutable observation IDs                                         | Stable statistics/direction ordering |

## Interface checks

### EH149-UI-01: Apply an inclusive period

**Precondition:** The account has `EH149-COMPAT-01` and the Biomarkers page is available.

1. Go to **Biomarkers**.
2. Select the period containing the first and last boundary dates.
3. Open the dynamics view.

**Expected result:** Points on both boundaries are included. Points outside the period do not affect statistics or direction. The selected period is visible.

**Result:** `N/A`
**Notes / evidence link:** Manual UI execution is pending an authenticated environment with synthetic fixtures.

### EH149-UI-02: Review deterministic statistics

**Precondition:** `EH149-COMPAT-01` contains at least two numeric points.

1. Select the compatible series.
2. Compare the displayed minimum, maximum, latest value, point count, and direction with the fixture.
3. Read the direction label and disclaimer.

**Expected result:** Statistics match the selected points. Direction uses only numeric movement wording (`increasing`, `decreasing`, `stable`, or unavailable) and never claims improvement, deterioration, treatment response, or diagnosis.

**Result:** `N/A`
**Notes / evidence link:** Manual UI execution is pending an authenticated environment with synthetic fixtures.

### EH149-UI-03: Keep incompatible evidence separate

**Precondition:** `EH149-INCOMPAT-01` is loaded.

1. Open the dynamics view for the shared display name.
2. Inspect the series list and warning.
3. Compare each series' statistics.

**Expected result:** Incompatible observations are not merged. The warning states why they are separate, and each series has independent statistics and provenance.

**Result:** `N/A`
**Notes / evidence link:** Manual UI execution is pending an authenticated environment with synthetic fixtures.

### EH149-UI-04: Inspect native value, range, and source

**Precondition:** `EH149-CONVERT-01` is loaded.

1. Open a converted point.
2. Inspect display and native values/units, reference range, observed date, and source document.
3. Select `EH149-SINGLE-01` and inspect its direction state.

**Expected result:** Native evidence and range remain visible beside any converted value. The one-point and qualitative cases show direction unavailable rather than fabricated numeric movement.

**Result:** `N/A`
**Notes / evidence link:** Manual UI execution is pending an authenticated environment with synthetic fixtures.

### EH149-UI-05: Freeze dynamics in a report

**Precondition:** The account has two or more synthetic eligible lab documents in the selected report scope and the **Create report** form exposes the reviewed dynamics-period controls. If the controls are unavailable, record `N/A`; do not substitute an API or browser-console check for this manual case.

1. Go to **Health reports** and choose **Create report**.
2. Enter canonical `From` and `To` dates that contain the synthetic observations.
3. Create the report and open the generated report.

**Expected result:** The generated report shows the selected period, numeric direction, native value and range, and source-document links. Reversing the dates shows validation and does not create a report.

**Result:** `PARTIAL`
**Notes / evidence link:** Executed 2026-10-02 with period 2026-09-01 → 2026-09-30. The generated report renders the "How your results changed" block with the selected period and the numeric-movement disclaimer, and a reversed period shows "The start date must not be after the end date." with **Create report** disabled. The series list is empty because the local smoke observations are not registry-resolved, so numeric direction and per-point values could not be observed; `pnpm test:eh149` covers those shapes.

## Developer evidence required

- [x] Focused read-model verification: `pnpm test:eh149` with `SKIP_ENV_VALIDATION=1` covers canonical `YYYY-MM-DD` UTC-calendar-date boundaries including a late end-date timestamp, invalid/reversed/non-canonical periods, one-point and no-policy cases, equal-timestamp canonical observation-ID ordering, tolerance-based direction, non-numeric limitations, and exclusion reasons.
- [x] Identity fixtures in `scripts/verify-eh149-biomarker-dynamics.ts` prove measurement definition, specimen, modifier, method, scale, and non-convertible unit differences remain separate with their warning reason.
- [x] Scope guard verification proves an observation outside the authorized document set is rejected before projection. Full authenticated API boundary execution remains pending configured Supabase services.
- [x] Report-binding evidence: `src/lib/report-generation.ts` calls the EH-149 frozen extension adapter with the exact materialized report document scope before persistence. The branch-local HMAC binding implementation remains out of scope for this reconciled runtime.
- [x] Scope-constrained synthetic evidence covers both `profile_current` and `report_immutable` projection scopes and rejects the second owned document from the selected report scope. Share/export isolation remains owned by EH-151/EH-153.
- [x] Server-adapter evidence: report creation passes the exact immutable scope to `getFrozenBiomarkerDynamicsForReport`; `pnpm test:eh149` and `pnpm exec tsc --noEmit --pretty false` pass. Full authenticated API boundary execution remains pending configured Supabase services.
- [x] `pnpm typecheck` and `pnpm build` pass with placeholder environment values. `pnpm test:eh129` passes after the client migration.

## Out of scope or not manually testable yet

- Clinical interpretation rules and Registry definition changes are out of scope. The direction policy is numeric movement only and is not a clinical cutoff.
- PDF/CSV rendering is covered by EH-153; sharing/privacy controls are covered by EH-151 and EH-154.
- Manual UI rows remain `N/A` until an authenticated environment with synthetic fixtures is available. The unauthenticated route was exercised and redirected to sign-in; the dynamics surface itself was not claimed as manually passed.
