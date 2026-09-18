# Tasks: eh-149-biomarker-dynamics-report

Domain: **health-profile / reports**

## 1. Health-profile — dynamics read model

- [ ] 1.1 Define `BiomarkerDynamicsReport`, series, point, statistics, direction, limitation, and incompatibility types in `src/lib/biomarker-dynamics.ts`.
- [ ] 1.2 Implement inclusive period filtering over `AuthorizedBiomarkerComparison`, preserving undated/non-numeric/ineligible/unsupported-unit exclusion reasons as explicit limitations.
- [ ] 1.3 Add the versioned per-definition/display-unit tolerance policy and attach the reviewed entry or explicit absence to each series.
- [ ] 1.4 Implement min/max/latest, point count, and approved numeric direction using that tolerance and the stable `observedAt`/canonical `observationId` ordering without improvement/deterioration wording; return `not_available` with a comparison-unavailable limitation before policy lookup when fewer than two numeric points remain.
- [ ] 1.5 Preserve exact measurement identity, native/display units, native ranges, conversion metadata, observation IDs, and document IDs for every point.
- [ ] 1.6 Emit separate series and warnings for incompatible definitions, specimens, modifiers, methods, scales, or units from retained candidate identity metadata.
- [ ] 1.7 Implement `src/lib/biomarker-dynamics-server.ts` and `GET /api/biomarkers/dynamics`: resolve the authenticated profile, build `AuthorizedBiomarkerComparison` for either `profile_current` or exact `report_immutable` scope, and call the pure projection without accepting client observations.

## 2. Health-profile — Biomarkers surface

- [ ] 2.1 Add period controls and the dynamics summary to `/app/biomarkers` without changing stored observations or Registry data; fetch the server-returned DTO from `/api/biomarkers/dynamics` rather than computing statistics in the browser.
- [ ] 2.2 Render numeric direction, unavailable comparison states, reference ranges, conversion indicators, and incompatibility warnings with the existing medical disclaimer.
- [ ] 2.3 Keep the source ledger available for each chart/table point; client code renders the server DTO and does not import comparison helpers, re-convert values, compute statistics, or merge series.

## 3. Reports — export handoff

- [ ] 3.1 Expose the authorized dynamics DTO plus schema version, direction-policy version, selected `biomarker_dynamics_period`, exact `report_scope_document_ids`, and generation metadata through the EH-149 server adapter used by EH-148 and required by EH-153; omitted period means no extension.
- [ ] 3.2 Have EH-148 persist that frozen extension in the validated report payload; export code must read the persisted extension through EH-148's resolver and must not accept a client DTO or query raw observations independently.
- [ ] 3.3 Verify missing or tampered persisted dynamics metadata fails closed rather than rebuilding a different period or policy at export time.

## 4. Verification
- [ ] 4.1 Add focused fixtures for compatible history, one-point history, equal observed timestamps with a canonical observation-ID tie-breaker, inclusive boundaries, undated/non-numeric/excluded candidates, unsafe conversion, same-name differences across definition/specimen/modifier/method/scale/unit, and a selected scope that excludes another owned document.
- [ ] 4.2 Verify both the `profile_current` page adapter and `report_immutable` report adapter with synthetic observations, prove client observations/out-of-scope documents are rejected, and record the EH-149 QA checklist.
