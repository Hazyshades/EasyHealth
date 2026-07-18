## ADDED Requirements

### Requirement: Extract qualitative laboratory lines

Document lab extraction SHALL emit structured biomarker candidates for qualitative and semi-quantitative laboratory results, not only quantitative numbers.

#### Scenario: Pipeline returns qualitative biomarker

- **WHEN** the lab PDF contains a dipstick result such as Leukocyte esterase Negative
- **THEN** the extraction pipeline produces a structured biomarker with text value and canonicalizable key/name
- **AND** does not drop the line solely because it is non-numeric

### Requirement: Emit provenance on extraction

The extraction pipeline SHALL populate provenance fields on extracted biomarkers when the model or OCR context provides them (page, snippet, confidence) and SHALL write page OCR artifacts using the versioned schema.

#### Scenario: Extracted row includes confidence and page

- **WHEN** extraction succeeds for a lab page with OCR context
- **THEN** extracted biomarkers include confidence when available
- **AND** include source_page when page context is known

### Requirement: Specimen and modifier on extract rows

Extraction SHALL set specimen and modifier on extracted biomarkers when stated or implied by panel context (for example urine panel, free hormone, fasting glucose).

#### Scenario: Urine panel specimen

- **WHEN** markers are extracted from a urinalysis section
- **THEN** extracted rows for those markers use specimen `urine` when context is clear
