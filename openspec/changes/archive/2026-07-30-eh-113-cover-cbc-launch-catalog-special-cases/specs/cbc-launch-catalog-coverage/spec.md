## ADDED Requirements

### Requirement: CBC definitions distinguish clinically different measurement identities

The Registry 2.0 launch catalog SHALL represent CBC measurements with distinct reviewed definition identities for five-part differential percentage and absolute results, segmented and band neutrophils, automated and manual differential variants, RDW-CV and RDW-SD, reticulocyte percentage and absolute variants, MPV, PDW, and plateletcrit. A shared analyte family or display label SHALL NOT establish equivalence.

#### Scenario: Differential percent and absolute rows resolve separately

- **WHEN** a neutrophil, lymphocyte, monocyte, eosinophil, or basophil row includes a ratio unit
- **THEN** it resolves only to the corresponding reviewed percentage definition
- **AND** the absolute cell-count definition is not a candidate with compatible evidence

#### Scenario: Absolute differential rows resolve separately

- **WHEN** a differential row includes a reviewed cell-concentration unit such as `10^9/L` or `10^3/µL`
- **THEN** it resolves only to the corresponding reviewed absolute definition
- **AND** a percentage definition is rejected with unit-family conflict evidence

#### Scenario: RDW variants remain distinct

- **WHEN** a row explicitly identifies RDW-CV or RDW-SD
- **THEN** the resolver selects the matching reviewed distribution-width definition and unit policy
- **AND** a bare `RDW` row without enough unit or modifier context remains partial or ambiguous

### Requirement: CBC method and population variants require compatible context

CBC definitions SHALL preserve segmented versus band population and automated versus manual differential distinctions when those axes are part of the reviewed identity. Missing required method or modifier context SHALL prevent concrete selection.

#### Scenario: Segmented and band neutrophils do not cross-map

- **WHEN** a row identifies segmented neutrophils
- **THEN** it does not resolve to the band-neutrophil definition
- **AND** a row identifying band neutrophils does not resolve to the segmented definition

#### Scenario: Manual differential is not treated as automated

- **WHEN** a row explicitly states manual differential
- **THEN** it resolves only to a reviewed manual variant when one exists
- **AND** it never silently selects an automated definition

#### Scenario: Required method is missing

- **WHEN** multiple reviewed CBC candidates differ by method and the input lacks method evidence
- **THEN** the outcome is partial or ambiguous
- **AND** no concrete measurement definition key is returned

### Requirement: CBC aliases preserve provenance and language

Every non-canonical CBC alias SHALL record normalized form, source, match type, approval status, and known locale/laboratory/fixture provenance. OCR aliases SHALL be explicitly marked as OCR variants and SHALL NOT receive reviewed exact-alias authority by default.

#### Scenario: Parenthetical abbreviation is recognized

- **WHEN** a CBC row contains a reviewed parenthetical label such as `Hemoglobin (HGB)` or `Platelets (PLT)`
- **THEN** punctuation and the abbreviation are normalized through a fixture-backed alias
- **AND** the row resolves only when unit, value kind, and specimen evidence are compatible

#### Scenario: Multilingual alias is recognized safely

- **WHEN** a supported-language CBC label such as a Russian differential label is extracted
- **THEN** its locale and source provenance are retained in the evidence/alias record
- **AND** it maps only to the explicitly reviewed target definition

#### Scenario: OCR negative remains incomplete or unmapped

- **WHEN** an OCR-corrupted label is not an explicitly reviewed OCR alias or produces conflicting unit/semantic evidence
- **THEN** the outcome is partial, ambiguous, or unmapped according to the shared resolver contract
- **AND** no concrete CBC key is inferred from the nearest label

### Requirement: CBC launch fixtures cover missing context and conflicts

The launch corpus SHALL include exact fixtures for the EH-113 checklist and SHALL declare expected resolver outcomes for normal, multilingual, sample-specific, OCR-corrupted, missing-context, and conflict rows. The corpus runner SHALL report resolved, partial, ambiguous, and unmapped CBC outcomes separately.

#### Scenario: Missing specimen does not become compatibility

- **WHEN** a CBC row matches a reviewed definition but specimen evidence is absent
- **THEN** the row is recognized with a specimen missing-axis and structured missing-specimen evidence
- **AND** it is not treated as a compatible specimen or resolved concrete identity

#### Scenario: Unit-family conflict is rejected

- **WHEN** a percentage CBC definition receives a cell-concentration or volume unit, or an absolute definition receives `%`
- **THEN** the candidate has hard unit conflict evidence
- **AND** it cannot be selected as concrete

#### Scenario: Missing value kind is represented

- **WHEN** a numeric CBC definition receives no value kind
- **THEN** `value_kind` is included in `missingAxes` and the result is incomplete
- **AND** a qualitative or ordinal value kind conflicting with a numeric definition is a hard conflict

### Requirement: CBC definitions are eligible for consumers only when concrete and reviewed

Only an active, resolved, reviewed Registry 2.0 definition may reach unit conversion, reviewed assessment bindings, or other concrete consumer projections. Candidate keys present only in decision evidence SHALL NOT be treated as active identity.

#### Scenario: Partial CBC result cannot convert

- **WHEN** a CBC resolution is partial or ambiguous, or its definition is provisional
- **THEN** conversion and reviewed assessment lookup return no usable policy/binding
- **AND** raw evidence remains available for later completion

#### Scenario: Active reviewed CBC result reaches conversion

- **WHEN** the read boundary provides an active revision with `resolved` status and a reviewed CBC definition
- **THEN** conversion may use the definition's reviewed policy
- **AND** the observation projection and active revision identity agree
