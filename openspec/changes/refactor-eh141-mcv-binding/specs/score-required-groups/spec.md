## ADDED Requirements

The Health Profile score-readiness contract SHALL verify, for every named Body system with required groups that declares context-only inputs, that replacing any single required group's marker in an otherwise complete set with a context-only input leaves the system `incomplete` and unscored. The existing isolation check (a context-only input alone cannot unlock readiness) SHALL be retained. Inflammation declares context-only inputs but has no required groups; its factual-only boundary is pinned by the dedicated non-scoreable assertions.


#### Scenario: Complete cardiovascular set with HDL replaced by total cholesterol

- **WHEN** the contract runner builds the complete cardiovascular marker set (atherogenic cholesterol, HDL, triglycerides) and replaces the HDL marker with a usable `total_cholesterol` marker
- **THEN** `evaluateSystemScoreReadiness` returns `incomplete` and `computeSystemStateScore` returns `null`

#### Scenario: Complete blood set with MCV replaced by RBC

- **WHEN** the contract runner builds the complete Blood marker set (hemoglobin, WBC, platelets, MCV) and replaces the MCV marker with a usable `rbc` marker
- **THEN** `evaluateSystemScoreReadiness` returns `incomplete` and `computeSystemStateScore` returns `null`

### Requirement: MCV binding is a first-class reviewed definition

The Registry SHALL define `mcv_whole_blood` as a standalone reviewed measurement definition with an explicit Blood assessment binding (`core` score role, `mcv` readiness and contribution group), consistent with the other bound Blood markers. The CBC tuple-mapping loop SHALL contain only binding-less provisional indices. The generated catalog output, alias keys (`mcv_whole_blood:registry:1`, fixture aliases), unit policy, and manifest digest SHALL be identical to the pre-refactor output.

#### Scenario: Catalog output is unchanged after the extraction

- **WHEN** `pnpm test:biomarkers` and `pnpm check:biomarker-docs` run after the refactor
- **THEN** both pass with no changes to generated documentation, `documentation-baseline.json`, or the catalog manifest digest
