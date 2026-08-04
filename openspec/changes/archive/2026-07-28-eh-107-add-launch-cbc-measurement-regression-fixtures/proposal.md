## Why

High-risk CBC identity distinctions (absolute vs percent differentials, RDW-CV vs RDW-SD, reticulocyte forms, exact sample labels, invalid units) can still collapse under later resolver work even though EH-102/EH-106 already ship sample labels and a general 44-row launch corpus. Most CBC sample rows intentionally stay `partial`, and the candidate corpus only checks expected classification — it does not lock antipair identity. EH-107 adds a dedicated, non-mutating CBC regression suite so those distinctions fail hard before EH-109/EH-111/EH-113 change resolution behavior.

## What Changes

- Add a versioned CBC measurement regression fixture pack covering the EH-107 checklist: five-part differential abs vs %, RDW-CV vs RDW-SD, reticulocytes abs vs %, exact RBC/HGB/HCT/MCV/MCH/MCHC labels, platelets/MPV/PDW/plateletcrit, segmented/band/manual differential variants, and compatible vs invalid unit cases.
- Encode positive, negative, ambiguous, and partial expectations so a wrong concrete `measurementDefinitionKey` fails the suite even when the expected state is intentionally non-resolved.
- Add a pure CBC regression runner and CI gate that evaluates fixtures against the current Registry 2.0 resolver without writing observations, revisions, trends, readiness, scores, or manual decisions.
- Reuse exact printed forms from the launch sample (`Hemoglobin (HGB)`, `NEU%`, manual differential labels, etc.) and add synthetic fixtures for distinctions absent from the sample (reticulocytes, RDW-CV/RDW-SD pairs, invalid units).
- Record QA evidence in `QA/eh-107/checklist.md`. Do **not** promote incomplete CBC definitions to reviewed concrete identity, finish multilingual/OCR matrices, or implement EH-113 resolver rules.

## Capabilities

### New Capabilities

- `cbc-measurement-regression-suite`: Dedicated CBC fixture matrix, identity antipair guards, unit compatibility cases, pure runner, and release-gate evidence for launch CBC distinctions.
- `cbc-identity-protection`: Contracts that high-risk CBC measurement families remain distinct under resolution — wrong concrete keys are hard failures; missing context stays non-concrete.

### Modified Capabilities

- None. This repository has no primary `openspec/specs/` capability baseline; EH-107 records its contracts as change-local specifications. The EH-106 candidate corpus remains the general 44-row launch gate and is not replaced.

## Impact

- Affected domains: health-profile (biomarker/registry verification) and documents (resolver consumers only via shared library tests).
- Affected code: `src/lib/biomarkers/` fixture modules, new CBC regression fixture/runner scripts under `scripts/` (and/or `registry/`), measurement-registry CI workflow, QA checklist.
- Affected data and operations: none at runtime — fixtures and verification only; no schema, observation, or assessment behavior change.
- Downstream consumers of the green suite: EH-109 (depends on EH-107), EH-111 unit rules, EH-113 CBC rule implementation, EH-108 launch documentation evidence.
- Explicit non-owners: EH-110 alias provenance model, EH-112 partial/ambiguous UI, EH-114 glucose variants, catalog promotion of mono/eos/bas/MPV/MCH reviewed definitions (EH-113 / later catalog work).
