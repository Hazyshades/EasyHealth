## ADDED Requirements

### Requirement: Lab unit toggle on biomarkers page

The Biomarkers page SHALL provide a control to switch between US conventional and SI unit presentation consistent with the profile lab unit preference.

#### Scenario: User toggles units on biomarkers page

- **WHEN** a signed-in user with observations switches the unit system on `/app/biomarkers`
- **THEN** table values, units, and reference ranges update for convertible markers
- **AND** the preference is persisted for the profile when the control saves preference
- **AND** stored observations are not rewritten

### Requirement: Preferred-unit table and chart

The biomarker table and trend chart SHALL use preferred display units for the selected biomarker when conversion is safe.

#### Scenario: Chart uses converted series consistently

- **WHEN** the user views a trend for glucose with SI preference and historical points stored in mg/dL
- **THEN** all chart points for that series are presented in mmol/L
- **AND** no mixed-unit series is plotted without conversion

#### Scenario: Non-convertible marker unchanged

- **WHEN** the user views a marker with do-not-convert or unrecognized units (for example Lp(a) across mass/molar or eGFR)
- **THEN** the table and chart show lab-native units

### Requirement: Conversion indicator on biomarkers UI

When a row or chart series is unit-converted for display, the Biomarkers page SHALL indicate conversion and expose original lab-native value and unit.

#### Scenario: Converted row shows original

- **WHEN** a table row is shown in preferred units different from storage
- **THEN** the UI indicates conversion for display
- **AND** original lab value/unit remains accessible (tooltip, secondary text, or detail)
