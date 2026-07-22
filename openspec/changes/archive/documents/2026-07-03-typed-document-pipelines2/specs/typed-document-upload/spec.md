## MODIFIED Requirements

### Requirement: Explicit document type on upload

The upload flow SHALL require the user to select one of `lab_result`, `instrumental_report`, `consultation_note`, `discharge_summary`, `prescription`, or `referral` before file submission. The selected value SHALL be sent as `document_type` in the upload form data.

#### Scenario: User uploads discharge summary

- **WHEN** a signed-in user opens `/app/upload?type=discharge_summary` and submits a paid PDF upload
- **THEN** the created document row has `document_type` equal to `discharge_summary`
- **AND** a processing job is enqueued

#### Scenario: User uploads prescription

- **WHEN** a signed-in user opens `/app/upload?type=prescription` and submits a paid image upload
- **THEN** the created document row has `document_type` equal to `prescription`

#### Scenario: User uploads referral

- **WHEN** a signed-in user opens `/app/upload?type=referral` and submits a paid upload
- **THEN** the created document row has `document_type` equal to `referral`

### Requirement: Per-type upload pages

The system SHALL provide upload entry points for lab results, imaging studies, consultations, discharge summaries, prescriptions, and referrals with English type-specific titles and helper copy.

#### Scenario: Discharge upload page

- **WHEN** a user opens `/app/upload?type=discharge_summary`
- **THEN** the page title and helper text describe hospital discharge summary upload

#### Scenario: Prescription upload page

- **WHEN** a user opens `/app/upload?type=prescription`
- **THEN** the page title and helper text describe prescription document upload

## ADDED Requirements

### Requirement: Mismatch warning after processing

After processing completes, the upload result or document detail flow SHALL surface `type_mismatch_warning` when the worker detected a likely wrong document type.

#### Scenario: Upload completes with mismatch

- **WHEN** a document finishes processing with `type_mismatch_warning` true
- **THEN** the user is directed to document detail where the mismatch banner is visible
