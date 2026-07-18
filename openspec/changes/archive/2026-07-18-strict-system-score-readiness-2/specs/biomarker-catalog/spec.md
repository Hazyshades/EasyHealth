## ADDED Requirements

### Requirement: Measurement units use an explicit ontology

Each measurement definition SHALL declare accepted normalized units, compatible dimensions, canonical unit where conversion is supported, conversion policy, and missing-unit behavior. Raw aliases, normalized units, and dimensions MUST remain distinct.

#### Scenario: Percent conflicts with absolute count

- **WHEN** a differential result reports `%`
- **THEN** absolute cell-count definitions receive a hard unit conflict

### Requirement: Aliases retain source and match policy

Aliases SHALL record normalized form, source, match type, approval status, and locale/laboratory/fixture provenance when known. OCR variants MUST remain distinguishable from reviewed exact aliases.

#### Scenario: Fixture alias is added

- **WHEN** a parenthetical or abbreviated label is added from a launch document
- **THEN** the alias records that fixture source and its intended definition or analyte

### Requirement: Assessment eligibility is explicit and reviewed

Assessment participation SHALL come from versioned reviewed assessment bindings on concrete definitions, not from legacy storage keys or an independent unreviewed boolean.

#### Scenario: Display-only specialty test resolves

- **WHEN** a specialty serology definition is resolved for display
- **THEN** it does not affect assessment without an explicit reviewed binding
