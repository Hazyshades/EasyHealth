## ADDED Requirements

### Requirement: Extended document type enum

The system SHALL support `discharge_summary`, `prescription`, and `referral` as valid `document_type` values in addition to existing active types.

#### Scenario: Discharge document created

- **WHEN** a user uploads with `document_type=discharge_summary`
- **THEN** the document row stores `discharge_summary`
- **AND** a processing job is enqueued

#### Scenario: Prescription document created

- **WHEN** a user uploads with `document_type=prescription`
- **THEN** the document row stores `prescription`

#### Scenario: Referral document created

- **WHEN** a user uploads with `document_type=referral`
- **THEN** the document row stores `referral`

### Requirement: Discharge summary extraction

The worker SHALL extract discharge-specific fields for `discharge_summary` documents into `document_extracted_clinical_notes` with `note_kind` of `discharge`.

#### Scenario: Discharge fields captured

- **WHEN** a discharge summary PDF is processed
- **THEN** extracted data includes admission date, discharge date, hospital course, discharge diagnoses, discharge medications, and follow-up instructions when present in the source
- **AND** rows are auto-accepted

### Requirement: Prescription extraction

The worker SHALL extract prescription data into `document_extracted_prescriptions` with medication name, dose, frequency, duration, and instructions per line item when visible.

#### Scenario: Multi-medication prescription

- **WHEN** a prescription lists multiple medications
- **THEN** each medication is stored as a separate row or structured array entry linked to the document
- **AND** extraction does not invent medications not in the source

### Requirement: Referral extraction

The worker SHALL extract referral data into `document_extracted_referrals` including referring provider, specialty, referral date, reason, and clinical summary when visible.

#### Scenario: Specialist referral processed

- **WHEN** a referral letter PDF is processed
- **THEN** `referred_to_specialty` and `reason_for_referral` are populated from document text
- **AND** rows are auto-accepted

### Requirement: Document summary for extended types

Each extended type extraction SHALL produce an educational `document_summary` on the document row.

#### Scenario: Prescription summary generated

- **WHEN** prescription extraction completes successfully
- **THEN** `documents.document_summary` describes the prescription in educational English without treatment advice

### Requirement: DICOM remains blocked

Extended document types SHALL NOT enable DICOM upload or viewer functionality.

#### Scenario: DICOM still rejected

- **WHEN** a client attempts upload with `document_type=dicom`
- **THEN** the API returns HTTP 400
