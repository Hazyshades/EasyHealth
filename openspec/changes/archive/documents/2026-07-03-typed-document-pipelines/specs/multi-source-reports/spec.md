## ADDED Requirements

### Requirement: Multi-source report context

Paid report generation SHALL build LLM context from biomarkers, instrumental findings, consultation notes, and document summaries for documents in scope.

#### Scenario: Report with labs and imaging

- **WHEN** a user generates a paid report including a lab document and an instrumental report
- **THEN** the LLM prompt includes biomarker observations and instrumental findings from both documents
- **AND** the generated report references information from both sources

#### Scenario: Report with consultation only

- **WHEN** a user generates a report scoped to consultation documents that have accepted clinical note extractions but no biomarkers
- **THEN** generation succeeds using consultation structured data
- **AND** does not return HTTP 400 solely for missing observations

### Requirement: Eligibility includes non-lab documents

A document SHALL be eligible for report selection when processing completed successfully and it has accepted structured extraction rows or linked observations.

#### Scenario: Eligible instrumental document

- **WHEN** `GET /api/documents?eligible_for_report=1` is called
- **THEN** completed instrumental reports with accepted findings are included
- **AND** consultation notes with accepted clinical notes are included

### Requirement: Abnormal-only scope for biomarkers

When `abnormal_only` is true, the system SHALL filter biomarker observations to out-of-range values only while still including non-lab structured content from selected documents.

#### Scenario: Abnormal-only with mixed types

- **WHEN** `abnormal_only` is true and scope includes lab and consultation documents
- **THEN** only out-of-range biomarkers are included
- **AND** consultation structured fields from selected documents are still included in context

### Requirement: No observations-only gate

Report generation SHALL return HTTP 400 only when zero structured content (biomarkers, findings, and clinical notes combined) exists for the resolved document scope.

#### Scenario: No data in scope

- **WHEN** paid generation is requested but selected documents have no observations, findings, or clinical notes
- **THEN** the system returns HTTP 400 with an English message instructing the user to upload and process documents first

### Requirement: Report safety unchanged

Multi-source reports SHALL conform to `doctorSummarySchema`, use educational language, and include the mandatory disclaimer.

#### Scenario: Multi-source report disclaimer

- **WHEN** a multi-source report is generated successfully
- **THEN** stored content includes the standard medical disclaimer
