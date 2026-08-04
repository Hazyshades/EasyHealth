## ADDED Requirements

### Requirement: Differential absolute and percent identities stay distinct

For neutrophils, lymphocytes, monocytes, eosinophils, and basophils, percentage and absolute cell-count forms SHALL remain distinct measurement identities. Unit evidence that selects one form SHALL NOT map to the other form's concrete key.

#### Scenario: Neutrophil percent does not resolve as absolute
- **WHEN** a fixture supplies a neutrophil percent label such as `Neutrophils (NEU%)` with unit `%`
- **THEN** the resolver MUST NOT select an absolute neutrophil concrete key
- **AND** if a percent concrete key is selected, it MUST be the percent definition only

#### Scenario: Neutrophil absolute does not resolve as percent
- **WHEN** a fixture supplies an absolute neutrophil label with a cell-count unit such as `x10^9/L`
- **THEN** the resolver MUST NOT select a percent neutrophil concrete key

#### Scenario: Five-part differential pairs are all guarded
- **WHEN** the suite evaluates lymphocyte, monocyte, eosinophil, and basophil absolute versus percent pairs
- **THEN** each pair is subject to the same cross-mapping prohibition as neutrophils

### Requirement: RDW-CV and RDW-SD stay distinct

RDW coefficient-of-variation and RDW standard-deviation forms SHALL remain distinct. A percent-shaped RDW input MUST NOT select the SD concrete key; a volume-shaped RDW-SD input MUST NOT select the CV concrete key.

#### Scenario: RDW percent cannot become RDW-SD
- **WHEN** a fixture supplies RDW with unit `%` or an explicit RDW-CV label
- **THEN** the resolver MUST NOT select `rdw_sd`

#### Scenario: RDW-SD volume cannot become RDW-CV
- **WHEN** a fixture supplies RDW-SD with a volume unit such as `fL`
- **THEN** the resolver MUST NOT select `rdw_cv`

#### Scenario: Bare RDW without enough evidence stays non-concrete or correctly typed
- **WHEN** a fixture supplies a bare `RDW` label without variant-discriminating evidence
- **THEN** the outcome remains `partial` or `ambiguous` rather than an arbitrary concrete RDW variant
- **OR** if policy later resolves it, the suite expectation is updated explicitly and still forbids the opposite variant

### Requirement: Reticulocyte absolute and percent stay distinct

Reticulocyte percentage and absolute count forms SHALL remain distinct measurement identities under the same unit-driven separation rules as the white-cell differential.

#### Scenario: Reticulocyte percent rejects absolute key
- **WHEN** a fixture supplies reticulocytes with unit `%`
- **THEN** the resolver MUST NOT select the absolute reticulocyte concrete key

#### Scenario: Reticulocyte absolute rejects percent key
- **WHEN** a fixture supplies absolute reticulocytes with a cell-count unit
- **THEN** the resolver MUST NOT select the percent reticulocyte concrete key

### Requirement: Segmented, band, and manual differential variants stay distinct from total forms

Segmented neutrophils, band neutrophils, and manual differential rows SHALL NOT collapse into the automated total differential concrete keys without explicit reviewed evidence that those identities are the same measurement.

#### Scenario: Band neutrophils do not become total neutrophils percent
- **WHEN** a fixture supplies `Band neutrophils` with unit `%`
- **THEN** the resolver MUST NOT select `neutrophils_percent` as the concrete key

#### Scenario: Segmented neutrophils do not become band neutrophils
- **WHEN** a fixture supplies `Segmented neutrophils` with unit `%`
- **THEN** the resolver MUST NOT select `band_neutrophils_percent`

#### Scenario: Manual differential label does not silently equal automated twin
- **WHEN** a fixture supplies a manual differential label such as `Lymphocytes, manual differential`
- **THEN** the outcome either stays non-concrete or selects a manual-specific identity
- **AND** MUST NOT silently claim the automated lymphocyte percent concrete key unless a reviewed equivalence is explicitly fixture-approved

### Requirement: Exact CBC sample labels are recognized safely

Exact launch-sample CBC labels, including parenthetical abbreviations for RBC, HGB, HCT, MCV, MCH, MCHC, platelets, MPV, PDW, and plateletcrit, SHALL be recognized without becoming `unmapped` solely due to punctuation or abbreviation form. Recognition MAY be `partial` when concrete axes are incomplete.

#### Scenario: Hemoglobin parenthetical label is not unmapped
- **WHEN** the resolver receives `Hemoglobin (HGB)` with `g/L` in CBC context
- **THEN** the result is not `unmapped`
- **AND** if a concrete key is selected, it is a hemoglobin definition rather than another red-cell index

#### Scenario: Platelet index labels remain in the platelet family
- **WHEN** fixtures supply `Mean platelet volume (MPV)`, `Platelet distribution width (PDW)`, or `Plateletcrit (PCT)` with their sample units
- **THEN** each result is not `unmapped`
- **AND** none selects a non-platelet CBC concrete key such as MCV or RDW

### Requirement: Invalid units cannot force the wrong concrete measurement

Incompatible unit tokens SHALL hard-reject or keep the outcome non-concrete. They MUST NOT produce a concrete CBC measurement definition that contradicts the unit family.

#### Scenario: Percent unit cannot select absolute cell-count definition
- **WHEN** a differential or reticulocyte absolute-oriented label is paired with unit `%`
- **THEN** the resolver MUST NOT return the absolute cell-count concrete key as `resolved`

#### Scenario: Cell-count unit cannot select percent definition
- **WHEN** a percent-oriented differential label is paired with unit `x10^9/L`
- **THEN** the resolver MUST NOT return the percent concrete key as `resolved`

#### Scenario: Compatible unit cases remain allowed
- **WHEN** a fixture pairs a reviewed definition with a compatible unit and required context
- **THEN** the suite allows the expected `resolved` or documented non-concrete outcome
- **AND** does not treat valid units as failures
