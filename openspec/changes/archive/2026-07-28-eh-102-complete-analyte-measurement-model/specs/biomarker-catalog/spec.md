## ADDED Requirements

### Requirement: Registry v1 knowledge is migrated without runtime adapters

The launch catalog SHALL contain an explicit migration disposition for every one of the 113 frozen Registry v1 concepts. Established terminology, aliases, unit conversions, system membership, and assessment policy SHALL be migrated when valid. Unknown clinical identity axes SHALL remain explicit and provisional. Runtime adapter generation and fallback to Registry v1 SHALL be prohibited after cutover.

#### Scenario: Existing concept is not fully reviewed

- **WHEN** a Registry v1 concept lacks enough evidence for a reviewed concrete measurement
- **THEN** migration creates or links an explicit provisional Registry 2.0 record with source provenance
- **AND** does not emit a runtime legacy adapter or claim clinical equivalence

#### Scenario: All source concepts are dispositioned

- **WHEN** the launch catalog migration report is generated
- **THEN** every Registry v1 concept is marked reviewed, provisional, merged, or retired
- **AND** no source concept depends on runtime fallback for representability

### Requirement: The supplied laboratory sample is a launch fixture

The launch catalog SHALL include exact resolver fixtures for all 44 result row types in `lab_data/sample_newest.pdf`, covering raw labels, abbreviations, units, value kinds, section/method context, and missing context. Every expected row SHALL be recognized as resolved, ambiguous, or partial; no expected row MAY remain unmapped at the launch gate.

#### Scenario: Parenthetical CBC label is processed

- **WHEN** the resolver receives `Hemoglobin (HGB)` with `g/L` in CBC context
- **THEN** the hemoglobin analyte is recognized through a reviewed fixture alias
- **AND** punctuation and the parenthetical abbreviation do not cause an unmapped result

#### Scenario: Percent and absolute abbreviations differ

- **WHEN** `NEU%` and an absolute `NEU` row are processed with their printed units
- **THEN** percent and cell-count candidates remain distinct
- **AND** unit evidence prevents cross-mapping

#### Scenario: Qualitative ELISA result is processed

- **WHEN** a sample parasite IgG ELISA row reports `Negative` without a unit
- **THEN** the nominal value kind and stated method are retained
- **AND** absence of a numeric unit is not treated as extraction failure

### Requirement: Launch catalog includes sample-specific gaps

The catalog SHALL include safe launch records for ASO; MPV, PDW, plateletcrit; segmented/band and manual differential variants; Giardia and helminth antibody tests in the sample; total IgE; and eosinophilic cationic protein. Specialty serology/parasitology records SHALL default to display-only without assessment bindings.

#### Scenario: Anti-Opisthorchis is no longer unknown

- **WHEN** the exact sample label for Anti-Opisthorchis felineus IgG qualitative ELISA is extracted
- **THEN** the launch catalog recognizes its analyte/test family and nominal result
- **AND** it remains display-only unless a separate reviewed assessment policy is introduced

### Requirement: Structured aliases preserve provenance

Every non-canonical alias SHALL record normalized form, language when known, source, match type, approval status, and fixture references when applicable. OCR/fuzzy aliases MUST NOT silently receive the same authority as reviewed exact aliases.

#### Scenario: Sample-specific abbreviation is added

- **WHEN** `LYMF%` is registered from the sample corpus
- **THEN** the alias records its fixture source and percent measurement target
- **AND** cannot match the absolute lymphocyte definition through an untyped shared string

### Requirement: Launch coverage is multidimensional

The launch report SHALL separately report raw preservation, analyte recognition, concrete resolution, ambiguity, partial recognition, unmapped rows, alias source, unit compatibility, value-kind parsing, maturity, and assessment eligibility. It MUST NOT present imported concept count as equivalent to reviewed clinical coverage.

#### Scenario: Provisional count is high

- **WHEN** many imported concepts are provisional
- **THEN** the report shows them separately from reviewed definitions
- **AND** the launch gate cannot claim full concrete resolution solely from catalog size
