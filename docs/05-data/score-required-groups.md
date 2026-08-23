# Health Profile score-readiness policy

This reference defines the technical minimum evidence needed to render an EasyHealth current-state score for each named Body system. It is product policy for the Health Profile, not a diagnosis, risk model, clinical recommendation, or a request to order tests.

## Context

The Worker extracts candidates; an accepted, resolved laboratory Observation enters the Health Profile only through a reviewed compatible Registry 2.0 assessment binding. A marker satisfies a required group only when it is numeric, `core`, has its reviewed specimen, and has at least one document-provided numeric reference bound. One alternative satisfies its group; every group for the system must be satisfied.

Score role, Coverage flag, readiness group, and contribution group are independent policies. A context-only marker can remain useful display, coverage, or contribution evidence, but never replaces a missing readiness group.

## Approved groups

| Body system | Required groups (approved alternatives) | Technical rationale | Context-only for readiness |
| --- | --- | --- | --- |
| Cardiovascular | atherogenic cholesterol: `ldl` or `non_hdl_cholesterol`; `hdl`; `triglycerides` | Requires a minimum lipid profile across the atherogenic, HDL, and triglyceride axes before the product renders one current-state score. | `total_cholesterol` is supporting context; it cannot replace any required lipid axis. |
| Metabolic | glycemia: `fasting_glucose` or `hba1c` | Requires one reviewed long- or short-window glycemia input; unqualified glucose does not establish the fasting input. | `glucose` is context-only for readiness; post-prandial and urine glucose are not admitted as required inputs. |
| Thyroid | `tsh`; `free_t4` | Requires the two reviewed thyroid axes represented by the launch policy. | No additional reviewed thyroid assessment input is context-only at this time. |
| Liver | `alt`; `ast`; `alp`; `bilirubin`; `albumin` | Requires enzyme, biliary, bilirubin, and albumin axes represented by the reviewed launch policy. | `ggt` is supporting context and cannot replace any required liver axis. |
| Kidney | filtration: `egfr` or `creatinine`; albuminuria: `uacr` | Requires one reviewed filtration alternative plus urine albumin-to-creatinine evidence. | `bun`, `urea`, sodium, potassium, chloride, bicarbonate, and calcium are context-only for readiness. |
| Blood | red-cell mass: `hemoglobin` or `hematocrit`; `wbc`; `platelets`; `mcv` | Requires red-cell mass, white-cell, platelet, and red-cell-size axes from the reviewed CBC launch policy. | `rbc`, `rdw`, MCH, MCHC, platelet indices, and differentials are context-only for readiness. |
| Nutrients | `vitamin_d`; `b12`; `folate` | Requires the three reviewed nutrient inputs represented by the launch policy. | No additional reviewed nutrient assessment input is context-only at this time. |
| Inflammation | None — factual-only | Inflammation has no approved current-state scoring policy in this release. | `crp` remains display evidence only and can never unlock a numeric system score. |

## Exclusions and limits

- Empty required groups do not mean that a Body system is scoreable. Inflammation is explicitly `non_scoreable`.
- A missing document reference bound, nonnumeric value, non-core score role, or mismatched reviewed specimen leaves the group unsatisfied.
- Coverage completeness, contribution eligibility, and a marker's presence in the Health Profile do not imply score readiness.
- This policy does not infer fasting confirmation, pregnancy, age, assay interference, diagnoses, or any clinical threshold absent from the Observation.
- The numeric score uses only runtime-approved contribution groups after readiness passes. This document does not change that formula.

## Sign-off matrix

| Accountable role | Decision or evidence | Current state | Evidence |
| --- | --- | --- | --- |
| Clinical Product (functional owner) | Approve or reject the technical minimum groups and exclusions as product policy. | `PENDING` — no dated approval is present in Issue #41 or repository evidence. | Issue [#41](https://github.com/Hazyshades/EasyHealth/issues/41) acceptance and release-gate checklist. |
| Backend | Confirm reviewed Registry bindings derive the listed alternatives and block context-only inputs. | `IMPLEMENTED` | `pnpm test:eh141`; `src/lib/biomarkers/measurement-resolution.ts`; `src/lib/health-systems.ts`. |
| Clinical safety / release owner | Confirm release-gate disposition only after Clinical Product evidence exists. | `PENDING` | Issue #41 release gate: Clinical specification approved. |
| Documentation owner | Confirm canonical docs and generated catalog inventory are synchronized. | `IMPLEMENTED` locally; Wiki publication pending remote approval. | `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, `pnpm test:biomarker-docs`, rendered Wiki staging export. |

## Verification

Run `pnpm test:eh141` to verify approved groups, alternatives, strict completeness, context-only exclusions, usable references, and factual-only inflammation. Run the Registry documentation commands in the sign-off evidence before release; the generated catalog inventory is derived from the reviewed Registry and does not replace this rationale reference.
