## ADDED Requirements

### Requirement: Show non-numeric observation values

The Biomarkers page table SHALL display `value_text` when `value_kind` is not numeric (or when numeric value is null and text is present).

#### Scenario: Qualitative row in table

- **WHEN** the user has a qualitative observation
- **THEN** the table value cell shows the text result rather than a blank or zero

### Requirement: Show specimen and modifier when non-default

The Biomarkers page SHALL indicate specimen and modifier when they differ from defaults (`unspecified` / `none`) so users can distinguish identities.

#### Scenario: Urine specimen chip

- **WHEN** an observation has specimen `urine`
- **THEN** the UI indicates urine specimen on the row or detail

### Requirement: Trend chart behavior for non-numeric

The trend chart SHALL only plot numeric series by default; for ordinal-only keys it MAY plot ordinal ranks or disable the chart with an explanatory empty state.

#### Scenario: Numeric chart unchanged

- **WHEN** the user selects a numeric biomarker with history
- **THEN** the chart plots numeric values over time as today

#### Scenario: Qualitative-only selection

- **WHEN** the user selects a qualitative-only biomarker without numeric history
- **THEN** the UI does not fabricate numeric points from free text without ordinal
- **AND** shows an empty or ordinal-capable state
