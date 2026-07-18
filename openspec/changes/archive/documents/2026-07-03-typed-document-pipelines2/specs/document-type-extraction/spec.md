## MODIFIED Requirements

### Requirement: Worker branches by document type

The document processing worker SHALL run type-specific LLM extraction after shared preview generation and content classification, based on `documents.document_type`.

#### Scenario: Lab document extraction

- **WHEN** a queued job processes a document with `document_type` of `lab_result`
- **THEN** the worker invokes laboratory biomarker extraction
- **AND** writes rows to `document_extracted_biomarkers`

#### Scenario: Instrumental document extraction

- **WHEN** a queued job processes a document with `document_type` of `instrumental_report`
- **THEN** the worker invokes instrumental report extraction
- **AND** writes rows to `document_extracted_findings`
- **AND** promotes numeric measures to observations when present

#### Scenario: Consultation document extraction

- **WHEN** a queued job processes a document with `document_type` of `consultation_note`
- **THEN** the worker invokes consultation note extraction
- **AND** writes rows to `document_extracted_clinical_notes` with `note_kind` consultation

#### Scenario: Discharge summary extraction

- **WHEN** a queued job processes a document with `document_type` of `discharge_summary`
- **THEN** the worker invokes discharge extraction
- **AND** writes rows to `document_extracted_clinical_notes` with `note_kind` discharge

#### Scenario: Prescription extraction

- **WHEN** a queued job processes a document with `document_type` of `prescription`
- **THEN** the worker invokes prescription extraction
- **AND** writes rows to `document_extracted_prescriptions`

#### Scenario: Referral extraction

- **WHEN** a queued job processes a document with `document_type` of `referral`
- **THEN** the worker invokes referral extraction
- **AND** writes rows to `document_extracted_referrals`

## ADDED Requirements

### Requirement: Lab extraction excludes vital signs

Laboratory biomarker extraction SHALL exclude vital signs and physical examination measurements unless the document is clearly a laboratory results panel.

#### Scenario: H&P processed as lab returns no biomarkers

- **WHEN** a History and Physical document is processed as `lab_result`
- **THEN** biomarker extraction returns an empty list or only true laboratory tests if any exist
- **AND** does not emit blood pressure, pulse, respirations, or temperature as biomarkers

### Requirement: Content classification before extraction

The worker SHALL run document content classification before type-specific extraction and persist detected type and mismatch metadata.

#### Scenario: Classification stored

- **WHEN** processing begins extraction phase
- **THEN** `detected_document_type` is stored on the document before type-specific extraction runs

### Requirement: Consultation problems field replaces diagnoses

Consultation extraction SHALL use `documented_problems` (not `documented_diagnoses`) for problem-list and assessment-style items explicitly written in the document.

#### Scenario: Problems exclude non-assessment items

- **WHEN** a History and Physical document is processed as `consultation_note`
- **THEN** `documented_problems` includes assessment-style items such as chest pain with angina features
- **AND** does not include past surgical history, allergies, family history, or isolated physical exam findings

#### Scenario: Exam findings include vital signs

- **WHEN** a consultation document lists blood pressure, pulse, respirations, and temperature in the physical examination
- **THEN** `exam_findings` text includes all four vital sign values when present in the source

### Requirement: Consultation summary cites specific plan items

Consultation document summaries SHALL reference specific plan or recommendation items from the extraction when present, avoiding overly generic cardiovascular monitoring language alone.

#### Scenario: H&P plan reflected in summary

- **WHEN** recommendations include telemetry, aspirin, catheterization, and baseline labs/EKG
- **THEN** the document summary mentions those specific plan elements in educational language
