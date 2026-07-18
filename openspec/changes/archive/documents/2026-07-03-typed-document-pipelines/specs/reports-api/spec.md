## MODIFIED Requirements

### Requirement: Report generation request body

The `POST /api/reports` body SHALL accept `title`, `report_type`, `detail_level`, optional `document_ids`, and optional `abnormal_only` (boolean, default `false`). Report context SHALL include biomarkers, instrumental findings, consultation notes, and document summaries for documents in scope.

#### Scenario: Default document scope

- **WHEN** `document_ids` is omitted or null
- **THEN** the system uses structured data from all eligible documents for the profile

#### Scenario: Explicit document scope

- **WHEN** `document_ids` contains valid eligible document UUIDs owned by the profile
- **THEN** the system uses structured data only from those documents

#### Scenario: Invalid document ids

- **WHEN** `document_ids` contains ids not owned by the profile or not eligible
- **THEN** the system returns HTTP 400 with an English error message

#### Scenario: Abnormal-only generation

- **WHEN** `abnormal_only` is `true`
- **THEN** the system includes only observations where value is below `ref_low` or above `ref_high`
- **AND** still includes non-lab structured content from selected documents
- **AND** persists `abnormal_only` as `true` on the saved report

#### Scenario: No abnormal indicators with labs in scope

- **WHEN** `abnormal_only` is `true` and no observations match the out-of-range filter but non-lab structured data exists in scope
- **THEN** generation proceeds using non-lab structured content

### Requirement: Eligible documents for reports

A document SHALL be eligible for report generation when its processing completed successfully and it has at least one linked observation or accepted structured extraction row (instrumental findings or clinical notes).

#### Scenario: Eligible documents query

- **WHEN** `GET /api/documents?eligible_for_report=1` is called by an authenticated user
- **THEN** the response includes completed lab documents with observations
- **AND** includes instrumental and consultation documents with accepted structured extractions

### Requirement: No observations available

The system SHALL return HTTP 400 when no structured content (observations, instrumental findings, or clinical notes) matches the resolved document scope after payment validation.

#### Scenario: No structured data for scope

- **WHEN** paid generation is requested but zero structured content matches the document scope
- **THEN** the system returns HTTP 400 with an English message instructing the user to upload and process documents first

### Requirement: Specialty prompts

The system SHALL use distinct system prompts for all eight report types: `general_practice`, `cardiology`, `endocrinology`, `gastroenterology`, `hematology`, `nephrology`, `neurology`, and `pulmonology`, while sharing the same output schema and medical safety rules. Prompts SHALL instruct the model to synthesize biomarkers together with instrumental and consultation record content when present.

#### Scenario: Cardiology report type with imaging

- **WHEN** `report_type` is `cardiology` and scope includes an ECG instrumental report
- **THEN** the LLM system prompt emphasizes cardiovascular-related literacy across biomarkers and instrumental content

## ADDED Requirements

### Requirement: Multi-source prompt context

Report generation SHALL pass a structured JSON context containing `biomarkers`, `instrumental_findings`, `consultation_notes`, and `document_summaries` arrays to the LLM.

#### Scenario: Context includes consultation notes

- **WHEN** a report is generated with consultation documents in scope
- **THEN** the prompt includes consultation structured fields with source document filenames and dates
