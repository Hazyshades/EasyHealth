## ADDED Requirements

### Requirement: Store qualitative and ordinal lab results

The system SHALL store laboratory results that are non-numeric (qualitative, semi-quantitative, or free text) on observations using `value_kind` and `value_text`, with optional `ordinal` for graded dipstick-style results.

#### Scenario: Negative urine protein stored

- **WHEN** a lab reports urine protein as `Negative` and the user accepts the extraction
- **THEN** an observation is stored with `value_kind` of `qualitative` or `ordinal`, non-empty `value_text`, and without requiring a numeric `value`

#### Scenario: Graded dipstick stores ordinal

- **WHEN** a lab reports urine blood as `2+` or `++` and the result is accepted
- **THEN** the observation includes `value_text` preserving the lab wording
- **AND** includes an ordinal rank when the grade is recognized

### Requirement: Accept qualitative extractions biomarkers

Document biomarker acceptance SHALL accept rows that have `value_text` (or equivalent) even when `value_numeric` is null, for qualitative/ordinal kinds.

#### Scenario: Accept without numeric value

- **WHEN** a reviewer accepts an extracted row with `value_text` `Trace` and null `value_numeric`
- **THEN** the system creates or upserts an observation for that result
- **AND** marks the extracted row accepted

#### Scenario: Numeric-only path unchanged

- **WHEN** a reviewer accepts a row with numeric value only
- **THEN** the observation is stored as `value_kind` `numeric` with `value` set

### Requirement: Qualitative results excluded from body-map scores

Qualitative, ordinal, and free-text observations SHALL NOT contribute to health profile body-system state scores or data-confidence coverage denominators.

#### Scenario: Dipstick does not change kidney score

- **WHEN** the only new kidney-related data is qualitative urine protein
- **THEN** kidney state score and coverage are not computed from that qualitative row as a numeric core marker

### Requirement: Display qualitative results on biomarkers page

The Biomarkers overview SHALL list qualitative observations with their text result and unit (if any).

#### Scenario: User sees dipstick row

- **WHEN** a user with a qualitative urine observation opens `/app/biomarkers`
- **THEN** the table shows the biomarker name, text result, date, and source when available
