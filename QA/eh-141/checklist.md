# EH-141: Finalize Health Profile score-required groups

**Roadmap status:** Implemented; Clinical Product release-gate approved
**Build / environment:** Windows 11; local Next.js dev server; disposable Supabase Docker stack; synthetic EH-141 fixture
**Test run date:** `2026-08-23`
**Tester:** Codex verification session

## What this checklist covers

EH-141 makes the Health Profile show a numeric current-state score only after every approved required group for that Body system is represented by a usable laboratory Observation. It does not diagnose a condition or recommend tests; markers that are useful context remain visible but cannot turn an incomplete Body system into a scored one.

## Before you start

- [ ] Use a dedicated test account.
- [ ] Use only synthetic or de-identified laboratory documents; never upload patient data.
- [ ] Confirm every listed Document has Processing status **ready** and its extracted biomarkers were accepted.
- [ ] Use Documents whose reported laboratory reference ranges are present for the normal-path markers.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH141-CV-COMPLETE` | Synthetic lipid result containing LDL or non-HDL cholesterol, HDL, and triglycerides, each numeric with a laboratory reference range. | Cardiovascular normal path and approved alternative. |
| `EH141-CV-CONTEXT` | Synthetic result containing only total cholesterol with a laboratory reference range. | Context-only negative path. |
| `EH141-BLOOD-COMPLETE` | Synthetic CBC containing hemoglobin or hematocrit, WBC, platelets, and MCV, each numeric with laboratory reference ranges. | Blood completeness regression. |
| `EH141-MISSING-REF` | Synthetic result with a required marker whose numeric value is present but no laboratory reference range. | Required-reference negative path. |
| `EH141-CRP` | Synthetic CRP result with a laboratory reference range. | Factual-only inflammation path. |

## Interface checks

### EH141-UI-01: Complete required groups unlock a current-state score

**Precondition:** `EH141-CV-COMPLETE` is accepted for the dedicated test account and no earlier data is required.

1. Open **Health Profile**.
2. Select **Cardiovascular** on the body-system map.
3. Confirm the listed markers include LDL or non-HDL cholesterol, HDL, and triglycerides.

**Expected result:** Cardiovascular shows a numeric current-state score rather than `—`. The drawer shows the recorded markers and a separate data-confidence value; it does not describe the score as diagnosis or disease risk.

**Result:** `Pass` (Health Profile rendering with a synthetic accepted local fixture)
**Notes / evidence link:** Authenticated `/app/profile?system=cardiovascular` rendered `Heart: 95`, `Data confidence 85%`, LDL/HDL/triglycerides, the current-state disclaimer, and source record `EH141-CV-COMPLETE.pdf`. The accepted rows were loaded directly into the disposable local database; upload and worker acceptance were not exercised.

### EH141-UI-02: Context-only marker does not unlock readiness

**Precondition:** Use a clean dedicated test account, or remove/supersede any accepted cardiovascular required markers so only `EH141-CV-CONTEXT` remains current.

1. Open **Health Profile**.
2. Select **Cardiovascular**.
3. Review the score state and listed available marker.

**Expected result:** Cardiovascular shows `—` or **Not scored · incomplete core**, not a numeric score. Total cholesterol remains visible as supporting evidence and does not replace the missing required groups.

**Result:** `Blocked`
**Notes / evidence link:** The current product UI has no control to remove or supersede accepted observations, so a clean context-only account could not be prepared through product interfaces. The negative path is covered by the passing `pnpm test:eh141` contract runner.

### EH141-UI-03: Required marker without a laboratory range remains incomplete

**Precondition:** Use a clean dedicated test account, or remove/supersede complete required inputs; accept `EH141-MISSING-REF` for one otherwise required group.

1. Open **Health Profile**.
2. Select the affected Body system.
3. Review the score state and the missing-reference explanation.

**Expected result:** The system remains unscored and identifies the required marker as present without a usable laboratory reference range. It does not render `0/100` or calculate a soft fallback score.

**Result:** `Blocked`
**Notes / evidence link:** The current product UI has no control to create a required marker with its laboratory reference range omitted. The usable-reference rejection is covered by the passing `pnpm test:eh141` contract runner.

### EH141-UI-04: Blood requires MCV in addition to the other approved groups

**Precondition:** `EH141-BLOOD-COMPLETE` is accepted. Repeat with an otherwise identical synthetic CBC that omits MCV.

1. Open **Health Profile** and select **Blood** with the complete CBC.
2. Confirm that Blood has a numeric current-state score.
3. Remove/supersede the MCV Observation or use the CBC without MCV.
4. Refresh **Health Profile** and select **Blood** again.

**Expected result:** Blood becomes unscored when MCV is absent, while hemoglobin/hematocrit, WBC, and platelets remain visible. Re-accepting a usable MCV from the synthetic CBC restores score readiness after the Health Profile refreshes.

**Result:** `Blocked`
**Notes / evidence link:** A blood CBC fixture and observation supersession control were not available through product interfaces in this local session. The MCV-required regression is covered by the passing `pnpm test:eh141` contract runner.

### EH141-UI-05: Inflammation remains factual-only

**Precondition:** `EH141-CRP` is accepted for the dedicated test account.

1. Open **Health Profile**.
2. Select **Inflammation**.
3. Review the current-state score and CRP marker display.

**Expected result:** CRP is visible as factual evidence, but Inflammation has no numeric current-state score. It is not treated as scoreable merely because no required groups are configured.

**Result:** `Blocked`
**Notes / evidence link:** A CRP acceptance fixture was not available through product interfaces in this local session. The factual-only inflammation path is covered by the passing `pnpm test:eh141` contract runner; the rendered map showed Inflammation without a numeric score.

## Developer evidence required

- [x] **Backend owner:** `pnpm test:eh141` passes. It proves the exact approved alternatives for all eight Body systems, strict all-group completeness, usable-reference enforcement, context-only exclusions — including that a context-only input cannot replace a required group in an otherwise complete set — and factual-only inflammation.
- [x] **Registry owner:** `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` pass. They prove the reviewed MCV assessment binding is reflected in the manifest baseline and generated catalog inventory (45 assessment-bound definitions).
- [x] **Backend owner:** `pnpm test:biomarkers`, `pnpm test:health-profile-lab-input`, and `pnpm typecheck` pass. They cover the Health Profile regression path, laboratory projection, and TypeScript integration.
- [x] **Documentation owner:** rendered Wiki staging was reviewed at `.tmp/eh141-wiki`; the seven generated pages were published at Wiki commit [`03e0e728`](https://github.com/Hazyshades/EasyHealth.wiki/commit/03e0e7287ad760eb6b1535aed7440c5e4bcf9cb2); Issue #41 records the publication evidence.
- [x] **Clinical Product / release owner:** requester-authorized dated approval of the group policy and release-gate disposition is recorded on Issue #41 in [the sign-off comment](https://github.com/Hazyshades/EasyHealth/issues/41#issuecomment-5385443051).

## Executed verification record

- Authenticated `GET /api/health-profile` returned HTTP 200 after the synthetic fixture was loaded. It reported `cardiovascular.scoreability = scoreable`, `state_score = 95`, all three cardiovascular required groups satisfied, `scoreable_named_system_count = 1` of `8`, and `inflammation.scoreability = non_scoreable`.
- The initial empty-account Health Profile rendered the onboarding empty state. After the fixture, the page rendered one numeric system and `-` for the seven incomplete/non-scoreable systems; it correctly withheld an overall numeric assessment until three named systems were complete.
- Local schema readiness required applying pending migrations `070`–`073` before the API smoke test; this was completed with `supabase migration up --local --yes`.

## Out of scope or not manually testable yet

- This item does not provide an interface for editing score-required groups; groups are reviewed Registry policy.
- This checklist does not ask testers to verify raw Registry bindings, manifest digest changes, or context-only exclusion logic with browser developer tools; the developer evidence above covers those contracts.
- The current Wiki publication and Clinical Product sign-off are complete. This checklist records the local rendering, runtime contract, authenticated API smoke, score-detail rendering, and the explicit non-diagnostic product boundary; it does not claim that the score is a diagnosis or a substitute for clinical judgment.
