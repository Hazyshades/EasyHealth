## MODIFIED Requirements

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
- **THEN** the right panel shows chief complaint, history, exam findings, problems noted in the record, recommendations, and follow-up plan when extracted
- **AND** displays the document summary

#### Scenario: Discharge viewer panel

- **WHEN** a user opens a processed `discharge_summary` document
- **THEN** the right panel shows admission and discharge dates, hospital course, discharge diagnoses, medications, and follow-up instructions when extracted
- **AND** displays the document summary

#### Scenario: Prescription viewer panel

- **WHEN** a user opens a processed `prescription` document
- **THEN** the right panel shows extracted medications with dose, frequency, and instructions when available
- **AND** displays the document summary

#### Scenario: Referral viewer panel

- **WHEN** a user opens a processed `referral` document
- **THEN** the right panel shows referral specialty, reason, referring provider, and clinical summary when extracted
- **AND** displays the document summary

## ADDED Requirements

### Requirement: Type mismatch banner in viewer

When `type_mismatch_warning` is true, the document viewer SHALL show a prominent banner above the panel with suggested document type and reprocess action.

#### Scenario: Mismatch banner visible

- **WHEN** a user opens a document with type mismatch flagged
- **THEN** an English banner explains the likely correct type
- **AND** provides a reprocess action without requiring re-upload

### Requirement: Consultation problems label uses health-literacy wording

The consultation panel SHALL label the problems list as "Problems noted in record (as written)" rather than "Documented diagnoses".

#### Scenario: Problems section label

- **WHEN** a user views a consultation document with extracted problems
- **THEN** the list heading reads "Problems noted in record (as written)" in English
- **AND** does not imply the application made a clinical diagnosis
