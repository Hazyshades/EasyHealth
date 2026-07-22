## ADDED Requirements

### Requirement: Instrumental findings staging table

The system SHALL persist instrumental extractions in `document_extracted_findings` linked to `document_id` and `profile_id` with fields for modality, body region, findings text, impression, source page, confidence, extraction metadata, and status.

#### Scenario: Finding row created on process

- **WHEN** instrumental extraction completes with one or more findings
- **THEN** one or more rows are inserted into `document_extracted_findings`
- **AND** each row references the source document

### Requirement: Clinical notes staging table

The system SHALL persist consultation extractions in `document_extracted_clinical_notes` with structured fields for visit metadata, complaints, history, exam, documented diagnoses, recommendations, and follow-up plan.

#### Scenario: Clinical note row created on process

- **WHEN** consultation extraction completes
- **THEN** a row is inserted into `document_extracted_clinical_notes` for the document

### Requirement: Auto-accept non-lab structured data

Instrumental findings and clinical notes SHALL be stored with `status` of `accepted` immediately after successful extraction without a user accept step.

#### Scenario: Instrumental finding auto-accepted

- **WHEN** instrumental extraction succeeds
- **THEN** finding rows have status `accepted`
- **AND** no accept API call is required for them to appear in viewer and report context

#### Scenario: Lab biomarkers still require review

- **WHEN** lab biomarker extraction succeeds
- **THEN** biomarker rows remain `needs_review` until the user accepts them via the existing accept flow

### Requirement: Structured data APIs

Document detail APIs SHALL return type-appropriate structured extraction payloads for authenticated owners.

#### Scenario: Instrumental document detail

- **WHEN** a user requests `GET /api/documents/[id]` for an instrumental report with completed extraction
- **THEN** the response includes instrumental findings and `document_summary`

#### Scenario: Consultation document detail

- **WHEN** a user requests `GET /api/documents/[id]` for a consultation note with completed extraction
- **THEN** the response includes clinical note fields and `document_summary`
