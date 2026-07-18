## ADDED Requirements

### Requirement: Page OCR artifact contract

Document page OCR JSON stored by the pipeline SHALL conform to a versioned artifact schema including schema version, engine identifier, page number, full text, and optional text blocks with confidence and bounding boxes.

#### Scenario: Worker writes versioned OCR JSON

- **WHEN** OCR completes for a document page
- **THEN** the stored OCR JSON includes `schema_version` and `full_text`
- **AND** may include block-level `bbox` and `confidence` when the engine provides them

#### Scenario: Readers tolerate partial blocks

- **WHEN** OCR JSON has full text but no blocks array
- **THEN** downstream extraction and review still proceed using full text

### Requirement: Extracted biomarker provenance fields

Each extracted biomarker row SHALL capture provenance when available: raw name, numeric and/or text value, unit, reference range text, source page, source text snippet, bounding box, confidence, specimen, modifier, and optional alternate reported unit pair.

#### Scenario: Quantitative extract with page snippet

- **WHEN** a lab line is extracted with a visible page number and snippet
- **THEN** `source_page` and `source_text` are stored on the extracted biomarker row
- **AND** `value_numeric` is set for quantitative results

#### Scenario: Qualitative extract uses value_text

- **WHEN** a lab line is qualitative (for example `Negative`)
- **THEN** the extracted row stores `value_text` and does not require `value_numeric`

#### Scenario: Dual-unit line

- **WHEN** the lab prints both conventional and SI on one line
- **THEN** the system stores one primary value/unit and MAY store alternate reported value/unit fields
- **AND** does not create two extracted rows solely for dual-unit printing

### Requirement: Provenance copied on acceptance

When an extracted biomarker is accepted into observations, the system SHALL copy available provenance fields onto the observation (source page, source text, bounding box, confidence, raw name, specimen, modifier, alternate units, value kind/text).

#### Scenario: Accepted observation retains source page

- **WHEN** a user accepts an extracted biomarker that has `source_page` 2
- **THEN** the observation stores source page 2 (or equivalent provenance field)
- **AND** retains `source_extracted_biomarker_id` linkage

### Requirement: Extraction does not drop qualitative by policy

Lab extraction instructions and parsers SHALL extract qualitative laboratory lines as structured results rather than discarding them solely for being non-numeric.

#### Scenario: Dipstick line extracted

- **WHEN** a urinalysis report lists Ketones as Negative
- **THEN** extraction includes a structured biomarker with text value
- **AND** the row is available for review/acceptance
