## ADDED Requirements

### Requirement: Review qualitative extracted biomarkers

The document extraction review experience SHALL display extracted biomarkers that have text-only values and allow the user to accept or reject them.

#### Scenario: Text result visible in review

- **WHEN** a document has an extracted biomarker with `value_text` and null numeric value
- **THEN** the review UI shows the text result
- **AND** accept/reject actions are available for that row

### Requirement: Review shows provenance

The extraction review UI SHALL show source page and source text snippet when present on the extracted row.

#### Scenario: Source snippet displayed

- **WHEN** an extracted biomarker includes `source_page` and `source_text`
- **THEN** the review UI surfaces page number and snippet for user verification
