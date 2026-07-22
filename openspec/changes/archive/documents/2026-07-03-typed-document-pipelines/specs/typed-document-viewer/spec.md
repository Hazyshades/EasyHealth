## ADDED Requirements

### Requirement: Type-specific viewer panel

The document viewer at `/app/documents/[id]` SHALL render a right-side panel based on `document_type`.

#### Scenario: Lab viewer panel

- **WHEN** a user opens a processed `lab_result` document
- **THEN** the right panel shows extracted biomarkers with the existing review UI when applicable
- **AND** displays the document summary below or alongside the biomarker list

#### Scenario: Instrumental viewer panel

- **WHEN** a user opens a processed `instrumental_report` document
- **THEN** the right panel shows modality, body region, key findings, and impression
- **AND** displays the document summary

#### Scenario: Consultation viewer panel

- **WHEN** a user opens a processed `consultation_note` document
- **THEN** the right panel shows chief complaint, history, exam findings, documented diagnoses, recommendations, and follow-up plan when extracted
- **AND** displays the document summary

### Requirement: English panel labels

All viewer panel headings and empty states SHALL be in English.

#### Scenario: Empty instrumental extraction

- **WHEN** an instrumental document completed processing with zero findings
- **THEN** the panel shows an English message that no structured findings were detected

### Requirement: Medical disclaimer on viewer

The document viewer SHALL display the standard medical disclaimer.

#### Scenario: Disclaimer visible

- **WHEN** a user views any document detail page
- **THEN** the disclaimer "This is not medical advice. Consult a healthcare professional." is shown
