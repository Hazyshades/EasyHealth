# EH-107: Launch CBC measurement regression fixtures

**Roadmap status:** In progress  
**Build / environment:** `________`  
**Test run date:** `________`  
**Tester:** `________`

## What this checklist covers

EH-107 adds a dedicated, non-mutating CBC measurement regression suite. It
protects high-risk CBC identity distinctions and exact launch-sample printed
forms. It does not change a user-facing screen: evidence is developer/CI only.

This suite is **complementary** to the EH-106 44-row candidate corpus. The
corpus remains the general launchability gate. The CBC suite is required for
the EH-107 release gate ("CBC regression suite green") and must stay green
under later EH-109/EH-111/EH-113 resolver work.

## Before you start

- [ ] No dedicated test account is required for EH-107.
- [ ] Do not upload real health records for this item.
- [ ] Confirm `pnpm test:cbc-regression` is available in the checked-out build.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `CBC-PACK` | In-repo fixture pack `CBC_MEASUREMENT_REGRESSION_FIXTURES` | Identity, exact-label, and unit cases |
| `CORPUS-44` | `registry/candidate-release/v1` 44-row corpus | Confirm general launch gate still passes |

## Interface checks

**Not manually testable yet.** EH-107 does not add or change a user interface.
Do not invent Documents/Biomarkers clicks for this checklist. Use developer
evidence below.

## Developer evidence required

- [ ] Run `pnpm test:cbc-regression` and attach the JSON summary showing
  `ok: true` with all checklist families present.
- [ ] Confirm CI job **Measurement Registry** runs
  `pnpm test:cbc-regression` (workflow step
  "Verify CBC measurement regression suite").
- [ ] Confirm `pnpm check:registry-v2-candidate-corpus` (or
  `pnpm test:registry-v2-candidate-corpus`) still passes — the CBC suite does
  not replace the 44-row corpus.
- [ ] Confirm the following issue #7 checklist families each have at least one
  passing fixture id in the suite output:
  - `differential-abs-pct` — five-part abs vs percent, including `NEU%` /
    `LYMF%` / `MON%` / `EOS%` / `BAS%`
  - `rdw-variants` — RDW-CV vs RDW-SD plus bare/generic RDW
  - `reticulocytes` — synthetic abs vs percent
  - `red-cell-exact` — RBC, HGB (`Hemoglobin (HGB)`), HCT, MCV, MCH, MCHC
  - `platelets` — platelets, MPV, PDW, plateletcrit
  - `diff-variants` — segmented, band, manual differential
  - `units` — compatible and invalid unit cases
- [ ] Note the minimal identity fix shipped with EH-107 if present:
  `snakeCaseToken` preserves `%` as `_percent` so aliases like `neu%` cannot
  collapse onto absolute `neu`.

## Out of scope or not manually testable yet

- Promoting mono/eos/bas, MCH/MCHC, MPV/PDW/PCT, segmented, ESR, or manual
  differentials to reviewed concrete definitions (EH-113 / later catalog work).
- Multilingual and OCR-negative CBC matrices (EH-113).
- Alias provenance model (EH-110), partial/ambiguous UI (EH-112), glucose
  specimen/timing variants (EH-114).
- Any Documents or Biomarkers UI walkthrough for this change.
