# EH-149: Biomarker Dynamics Report

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the report-ready dynamics view on the Biomarkers page: inclusive periods, deterministic statistics, numeric direction, incompatibility warnings, and point-level provenance. It does not test clinical improvement or deterioration claims because this change must not make them.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH149-COMPAT-01` | Three same-definition numeric observations, including both period boundaries | Statistics and direction |
| `EH149-INCOMPAT-01` | Same display name with different specimen or non-convertible unit | Separate-series warning |
| `EH149-SINGLE-01` | One numeric observation and one qualitative result | Not-available direction |
| `EH149-CONVERT-01` | Convertible native/display unit fixture with stored range | Conversion provenance |
| `EH149-EXCLUSION-01` | Authorized observations containing undated, qualitative, ineligible, unsupported-unit, and method/scale variants | Exclusion and reason ledger |
| `EH149-BIND-01` | Report-generation fixture selecting `biomarker_dynamics_period` and persisting the frozen dynamics extension | Server-owned report binding |
| `EH149-SCOPE-01` | Two owned eligible documents with only one included in the report's materialized scope | Scope-constrained dynamics |

## Interface checks

### EH149-UI-01: Apply an inclusive period

**Precondition:** The account has `EH149-COMPAT-01` and the Biomarkers page is available.

1. Go to **Biomarkers**.
2. Select the period containing the first and last boundary dates.
3. Open the dynamics view.

**Expected result:** Points on both boundaries are included. Points outside the period do not affect statistics or direction. The selected period is visible.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-149 delivery.`

### EH149-UI-02: Review deterministic statistics

**Precondition:** `EH149-COMPAT-01` contains at least two numeric points.

1. Select the compatible series.
2. Compare the displayed minimum, maximum, latest value, point count, and direction with the fixture.
3. Read the direction label and disclaimer.

**Expected result:** Statistics match the selected points. Direction uses only numeric movement wording (`increasing`, `decreasing`, `stable`, or unavailable) and never claims improvement, deterioration, treatment response, or diagnosis.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-149 delivery.`

### EH149-UI-03: Keep incompatible evidence separate

**Precondition:** `EH149-INCOMPAT-01` is loaded.

1. Open the dynamics view for the shared display name.
2. Inspect the series list and warning.
3. Compare each series' statistics.

**Expected result:** Incompatible observations are not merged. The warning states why they are separate, and each series has independent statistics and provenance.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-149 delivery.`

### EH149-UI-04: Inspect native value, range, and source

**Precondition:** `EH149-CONVERT-01` is loaded.

1. Open a converted point.
2. Inspect display and native values/units, reference range, observed date, and source document.
3. Select `EH149-SINGLE-01` and inspect its direction state.

**Expected result:** Native evidence and range remain visible beside any converted value. The one-point and qualitative cases show direction unavailable rather than fabricated numeric movement.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-149 delivery.`

## Developer evidence required

- [ ] Focused read-model verification covers date boundaries, empty/one-point series, tolerance-based direction, non-numeric values, and explicit exclusion limitations/reasons. *(Evidence provider: EH-149 dynamics owner.)*
- [ ] Identity fixtures prove specimen, modifier, method, scale, and non-convertible unit differences cannot merge and retain their warning reason. *(Evidence provider: EH-149 comparison/dynamics owner.)*
- [ ] API verification proves the profile authorization boundary precedes the dynamics projection. *(Evidence provider: EH-149 API owner.)*
- [ ] Export handoff evidence proves EH-153 consumes the frozen DTO and does not query raw observations independently. *(Evidence provider: EH-149 DTO owner; EH-153 export owner.)*
- [ ] Report-binding evidence proves EH-149 hands the DTO and schema/policy/period metadata to EH-148, EH-148 persists it, and EH-153 reads it through the EH-148 resolver without client DTO or raw-observation substitution. *(Evidence provider: EH-149 DTO owner; EH-148 persistence/read-resolver owner; EH-153 export owner.)*
- [ ] Scope-constrained evidence proves the selected report document UUIDs reach the comparison adapter and dynamics DTO, while another owned eligible document cannot appear in owner, share, or export output. *(Evidence provider: EH-149 comparison/dynamics owner; EH-148 report-scope/RPC owner; EH-151 public-read owner; EH-153 export owner.)*

## Out of scope or not manually testable yet

- Clinical interpretation rules and Registry changes are out of scope.
- PDF/CSV rendering is covered by EH-153; sharing/privacy controls are covered by EH-151 and EH-154.
- The checklist is planned; no row is evidence of an executed test until the implementation exists.
