## MODIFIED Requirements

### Requirement: Store qualitative and ordinal lab results

The system SHALL store laboratory results that are non-numeric (qualitative, semi-quantitative, or free text) on observations using `value_kind` and `value_text`, with optional `ordinal` for graded dipstick-style results. `value_text` SHALL preserve the laboratory’s verbatim wording, including Russian and Spanish qualitative phrases. A normalized interpretation (for example English `Negative` / `Positive` or an ordinal rank) MAY be derived and stored separately for kind/ordinal handling but MUST NOT erase the verbatim text.

#### Scenario: Negative urine protein stored

- **WHEN** a lab reports urine protein as `Negative` and the user accepts the extraction
- **THEN** an observation is stored with `value_kind` of `qualitative` or `ordinal`, non-empty `value_text`, and without requiring a numeric `value`

#### Scenario: Graded dipstick stores ordinal

- **WHEN** a lab reports urine blood as `2+` or `++` and the result is accepted
- **THEN** the observation includes `value_text` preserving the lab wording
- **AND** includes an ordinal rank when the grade is recognized

#### Scenario: Spanish qualitative verbatim retained

- **WHEN** a lab reports a qualitative result as `Negativo` and the row is accepted
- **THEN** `value_text` remains `Negativo`
- **AND** any derived normalized negative marker does not replace that text

#### Scenario: Russian qualitative verbatim retained

- **WHEN** a lab reports a qualitative result as `Отрицательно` and the row is accepted
- **THEN** `value_text` remains `Отрицательно`
