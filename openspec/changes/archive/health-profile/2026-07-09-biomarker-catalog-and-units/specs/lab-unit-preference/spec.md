## ADDED Requirements

### Requirement: Lab unit system preference

The system SHALL persist a per-profile lab unit system preference of `us` (conventional) or `si` with default `si`.

#### Scenario: Default preference

- **WHEN** a profile has no explicit lab unit preference set
- **THEN** the effective preference is `si`

#### Scenario: User updates preference

- **WHEN** a signed-in user sets lab unit system to `us` or `si`
- **THEN** the preference is stored on the profile
- **AND** subsequent biomarker and health profile presentations use that preference

### Requirement: Display-only unit conversion

The system SHALL convert observation values and reference bounds for display according to the user preference without rewriting stored lab-native `value`, `unit`, `ref_low`, or `ref_high`.

#### Scenario: Toggle does not mutate observations

- **WHEN** the user switches between `us` and `si`
- **THEN** stored observation rows remain unchanged
- **AND** only presented values and units change

#### Scenario: Value and refs convert together

- **WHEN** a glucose observation stored as `90 mg/dL` with ref `70–99 mg/dL` is presented in SI mode
- **THEN** the displayed value and both reference bounds use mmol/L via the glucose conversion factor
- **AND** in-range / out-of-range status is evaluated consistently (native-to-native or converted-to-converted), never mixed units

### Requirement: Analyte-specific conversion registry

The system SHALL convert using analyte-specific rules from the biomarker catalog (linear factor, numeric-equal label swap, special formula, or do-not-convert), not a generic unit-name transform.

#### Scenario: Triglycerides use distinct factor from cholesterol

- **WHEN** converting triglycerides between mg/dL and mmol/L
- **THEN** the system uses the triglyceride factor, not the cholesterol factor

#### Scenario: Unrecognized unit stays native

- **WHEN** an observation unit cannot be classified for a known conversion rule
- **THEN** the system presents the lab-native value and unit
- **AND** does not apply a guessed conversion

### Requirement: Special-case conversions

The system SHALL implement special handling for HbA1c NGSP↔IFCC formulas and BUN/urea nitrogen equivalence presentation.

#### Scenario: HbA1c formula conversion

- **WHEN** presenting HbA1c between % NGSP and mmol/mol IFCC
- **THEN** the system uses the NGSP/IFCC linear equations
- **AND** does not multiply percent by 10

#### Scenario: BUN urea equivalence display

- **WHEN** preference is `us` and the stored key is `urea` in mmol/L
- **THEN** the UI MAY present a BUN-equivalent mg/dL using the approved equivalence formula
- **AND** indicates the value was converted from the lab-reported urea

#### Scenario: Lp(a) never fixed-factor converted

- **WHEN** Lp(a) is stored in mg/dL or nmol/L
- **THEN** the unit toggle does not apply a fixed mg/dL↔nmol/L factor
- **AND** the native unit remains displayed

#### Scenario: eGFR not unit-toggled

- **WHEN** presenting eGFR
- **THEN** the unit remains mL/min/1.73 m² regardless of preference

### Requirement: Conversion transparency badge

When a presented value differs from lab-native units due to preference conversion, the UI SHALL indicate that the value was converted for display and make the original lab value/unit available.

#### Scenario: Converted glucose shows original

- **WHEN** glucose is converted from mg/dL to mmol/L for display
- **THEN** the user can see that display was converted
- **AND** can see the original lab-reported value and unit

### Requirement: Preference controls surface

The system SHALL expose lab unit preference on Settings and a quick control on the Biomarkers page.

#### Scenario: Settings control

- **WHEN** a signed-in user opens Settings
- **THEN** they can view and change lab unit system between US conventional and SI

#### Scenario: Biomarkers quick toggle

- **WHEN** a signed-in user opens `/app/biomarkers`
- **THEN** they can switch unit system without leaving the page
- **AND** the table and chart update to the preferred presentation
