# Tasks: eh-149-biomarker-dynamics-report

Domain: **health-profile / reports**

## 1. Dynamics read model

- [ ] 1.1 Define `BiomarkerDynamicsReport`, series, point, statistics, direction, limitation, and incompatibility types in `src/lib/biomarker-dynamics.ts`.
- [ ] 1.2 Implement inclusive period filtering over the authorized comparison result, excluding undated points from statistics with an explicit limitation.
- [ ] 1.3 Implement min/max/latest, point count, and approved numeric direction without improvement/deterioration wording.
- [ ] 1.4 Preserve exact measurement identity, native/display units, native ranges, conversion metadata, observation IDs, and document IDs for every point.
- [ ] 1.5 Emit separate series and a warning for incompatible definitions, specimens, modifiers, methods, scales, or units.

## 2. Biomarkers surface

- [ ] 2.1 Add period controls and the dynamics summary to `/app/biomarkers` without changing stored observations or Registry data.
- [ ] 2.2 Render numeric direction, unavailable comparison states, reference ranges, conversion indicators, and incompatibility warnings with the existing medical disclaimer.
- [ ] 2.3 Keep the source ledger available for each chart/table point and ensure client code does not re-convert or merge series.
- [ ] 2.4 Expose the same dynamics DTO through the report-facing adapter required by EH-153.

## 3. Verification and handoff

- [ ] 3.1 Add focused fixtures for compatible history, one-point history, inclusive boundaries, non-numeric values, unsafe conversion, and same-name incompatible definitions.
- [ ] 3.2 Verify the UI with synthetic observations and record the EH-149 QA checklist.
- [ ] 3.3 Hand off the immutable DTO to EH-153; export code must not query raw observations independently.
