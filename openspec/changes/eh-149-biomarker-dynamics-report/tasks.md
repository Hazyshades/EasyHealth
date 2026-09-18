# Tasks: eh-149-biomarker-dynamics-report

Domain: **health-profile / reports**

## 1. Health-profile — dynamics read model

- [ ] 1.1 Define `BiomarkerDynamicsReport`, series, point, statistics, direction, limitation, and incompatibility types in `src/lib/biomarker-dynamics.ts`.
- [ ] 1.2 Implement inclusive period filtering over `AuthorizedBiomarkerComparison`, preserving undated/non-numeric/ineligible/unsupported-unit exclusion reasons as explicit limitations.
- [ ] 1.3 Add the versioned per-definition/display-unit tolerance policy and attach the reviewed entry or explicit absence to each series.
- [ ] 1.4 Implement min/max/latest, point count, and approved numeric direction using that tolerance without improvement/deterioration wording.
- [ ] 1.5 Preserve exact measurement identity, native/display units, native ranges, conversion metadata, observation IDs, and document IDs for every point.
- [ ] 1.6 Emit separate series and warnings for incompatible definitions, specimens, modifiers, methods, scales, or units from retained candidate identity metadata.

## 2. Health-profile — Biomarkers surface

- [ ] 2.1 Add period controls and the dynamics summary to `/app/biomarkers` without changing stored observations or Registry data.
- [ ] 2.2 Render numeric direction, unavailable comparison states, reference ranges, conversion indicators, and incompatibility warnings with the existing medical disclaimer.
- [ ] 2.3 Keep the source ledger available for each chart/table point and ensure client code does not re-convert or merge series.

## 3. Reports — export handoff

- [ ] 3.1 Expose the authorized dynamics DTO plus schema version, direction-policy version, selected period, and generation metadata through the EH-148 server-side report-generation handoff required by EH-153.
- [ ] 3.2 Have EH-148 persist that frozen extension in the validated report payload; export code must read the persisted extension through EH-148's resolver and must not accept a client DTO or query raw observations independently.
- [ ] 3.3 Verify missing or tampered persisted dynamics metadata fails closed rather than rebuilding a different period or policy at export time.

## 4. Verification

- [ ] 4.1 Add focused fixtures for compatible history, one-point history, inclusive boundaries, undated/non-numeric/excluded candidates, unsafe conversion, and same-name differences across definition/specimen/modifier/method/scale/unit.
- [ ] 4.2 Verify the UI with synthetic observations and record the EH-149 QA checklist.
