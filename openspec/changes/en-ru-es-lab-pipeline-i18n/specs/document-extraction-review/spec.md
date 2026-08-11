## MODIFIED Requirements

### Requirement: Extracted biomarkers staging table

The system SHALL store pipeline extraction results in `document_extracted_biomarkers` with fields including: `biomarker_key`, `biomarker_name`, `raw_name`, `value_numeric`, `value_text`, `unit`, `reference_range`, `collected_at`, `reported_at`, `source_page`, `source_text`, `bounding_box` (nullable JSON), `confidence`, `extraction_method`, `status`, `processing_version`, `extraction_model`. For multilingual labs, `raw_name` SHALL hold the verbatim printed label and MUST be populated whenever a row is extracted from a visible label. `biomarker_key` remains a non-authoritative extraction hint when present.

#### Scenario: Worker writes extracted rows

- **WHEN** the extraction step completes
- **THEN** one row per detected biomarker exists linked to `document_id` and `profile_id`

#### Scenario: Verbatim label landed in raw_name

- **WHEN** the worker inserts a row extracted from a Russian or Spanish printed name
- **THEN** `raw_name` equals the printed label
- **AND** is not replaced by an English-only translation

### Requirement: Review shows provenance

The extraction review UI SHALL show source page and source text snippet when present on the extracted row. The review UI SHALL also show the original verbatim label, and when a concrete English measurement is resolved, the canonical English measurement display name, without translating the entire product chrome.

#### Scenario: Source snippet displayed

- **WHEN** an extracted biomarker includes `source_page` and `source_text`
- **THEN** the review UI surfaces page number and snippet for user verification

#### Scenario: Original label and English canonical both visible when resolved

- **WHEN** a reviewed RU or ES row resolves to a Registry 2.0 definition
- **THEN** the review row shows the original label from the document
- **AND** shows the canonical English measurement name
- **AND** shows the original value, unit, and reference range

#### Scenario: Unmapped row still shows original label

- **WHEN** a row remains unmapped
- **THEN** the review UI still shows the original label, value, unit, and reference range
- **AND** does not fabricate a canonical measurement name as confirmed identity

## ADDED Requirements

### Requirement: English UI shell with multilingual evidence

Document extraction review SHALL keep English product copy, outcome labels, and system messages. Multilingual support in this change is limited to preserving and displaying document-originated evidence (labels, values, units, reference ranges) and English canonical measurement names when known. Locale switchers and translated application chrome are out of scope.

#### Scenario: Outcome labels remain English

- **WHEN** a Russian lab row is partial or unmapped
- **THEN** guidance uses the existing English incomplete-outcome wording
- **AND** the raw Russian evidence remains visible above or beside that wording
