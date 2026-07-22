## ADDED Requirements

### Requirement: Specialty marker catalog entries

The system SHALL catalog specialty laboratory markers for hormones, tumor markers, coagulation, acute cardiac enzymes/peptides, and common autoimmune serologies with canonical keys, aliases, and `scoreRole` of `display`.

#### Scenario: PSA is cataloged as display

- **WHEN** a lab result for PSA is extracted and normalized
- **THEN** it resolves to a canonical specialty key such as `psa`
- **AND** its catalog score role is `display`

#### Scenario: Hormone aliases resolve

- **WHEN** extraction yields names such as total testosterone or `эстрадиол`
- **THEN** keys resolve to cataloged hormone keys when aliases match
- **AND** score role remains `display`

### Requirement: No body-map wellness scoring for specialty markers

Specialty catalog markers (hormones, tumor markers, coagulation, acute cardiac, autoimmune) SHALL NOT contribute to body-map organ/system state scores or coverage, even when numeric values and lab reference ranges exist.

#### Scenario: Elevated PSA does not create a scored body system badge

- **WHEN** the user has an out-of-range PSA observation and no other markers for a system
- **THEN** the health profile does not treat PSA as a core scored system marker
- **AND** does not invent a disease-risk score from PSA alone

#### Scenario: Troponin excluded from cardiovascular wellness score

- **WHEN** troponin is present with a reference range
- **THEN** cardiovascular state_score does not include troponin as a core equal-weight wellness marker

### Requirement: Factual storage and listing

Specialty markers SHALL still be stored as observations and listed on the Biomarkers page with values, units, and lab reference ranges when provided.

#### Scenario: Specialty marker appears in biomarkers table

- **WHEN** the user has an accepted estradiol observation
- **THEN** `/app/biomarkers` lists it with value and unit
- **AND** educational UI does not label it with diagnostic conclusions

### Requirement: Optional factual use in reports

Specialty reports and general reports MAY include specialty marker values as factual inputs from observations but MUST NOT present them as body-map wellness scores.

#### Scenario: Report can cite PSA factually

- **WHEN** a report is generated and PSA observations exist
- **THEN** the report context may include the PSA values and dates
- **AND** does not claim a body-map organ score derived solely from PSA
