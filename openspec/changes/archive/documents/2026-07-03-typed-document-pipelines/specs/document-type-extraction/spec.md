## ADDED Requirements

### Requirement: Worker branches by document type

The document processing worker SHALL run type-specific LLM extraction after shared preview generation, based on `documents.document_type`.

#### Scenario: Lab document extraction

- **WHEN** a queued job processes a document with `document_type` of `lab_result`
- **THEN** the worker invokes laboratory biomarker extraction
- **AND** writes rows to `document_extracted_biomarkers`

#### Scenario: Instrumental document extraction

- **WHEN** a queued job processes a document with `document_type` of `instrumental_report`
- **THEN** the worker invokes instrumental report extraction
- **AND** writes rows to `document_extracted_findings`

#### Scenario: Consultation document extraction

- **WHEN** a queued job processes a document with `document_type` of `consultation_note`
- **THEN** the worker invokes consultation note extraction
- **AND** writes rows to `document_extracted_clinical_notes`

### Requirement: Document-level summary

Each successful extraction SHALL produce a short English `document_summary` (educational, non-diagnostic) stored on the `documents` row.

#### Scenario: Summary stored after processing

- **WHEN** extraction completes successfully for any active document type
- **THEN** `documents.document_summary` is populated with a brief summary
- **AND** processing status reflects completion per existing pipeline rules

### Requirement: Instrumental extraction schema

Instrumental extraction SHALL capture modality, body region, study date when visible, descriptive findings with source page references, an impression field quoting the report conclusion style, and optional numeric measures.

#### Scenario: Ultrasound report processed

- **WHEN** an instrumental PDF contains ultrasound findings
- **THEN** extracted data includes modality and findings text cited from the document
- **AND** does not invent findings not present in the source

### Requirement: Consultation extraction schema

Consultation extraction SHALL capture visit metadata, chief complaint, history summary, exam findings, documented diagnoses as stated in the document, recommendations, and follow-up plan.

#### Scenario: Consultation diagnoses quoted

- **WHEN** a consultation document lists diagnoses in the source text
- **THEN** `documented_diagnoses` contains strings derived from the document wording
- **AND** the extraction does not add diagnoses not present in the source

### Requirement: Medical safety in extraction prompts

All extraction system prompts SHALL instruct the model to use educational language, cite source document dates and values, and avoid generating new clinical diagnoses or treatment plans.

#### Scenario: Extraction output safety

- **WHEN** any type-specific extraction completes
- **THEN** stored structured fields reflect document content only
- **AND** processing does not write PHI on-chain
