## MODIFIED Requirements

### Requirement: Document type tabs

The Documents page SHALL include tabs for Lab results, Imaging studies, Consultations, Discharge summaries, Prescriptions, Referrals, and Medical images (DICOM).

#### Scenario: User selects Discharge tab with no documents

- **WHEN** the user selects the Discharge summaries tab and has no discharge documents
- **THEN** the system shows an empty state indicating no discharge summaries yet
- **AND** displays an upload CTA linking to `/app/upload?type=discharge_summary`

#### Scenario: User selects Prescriptions tab

- **WHEN** the user selects the Prescriptions tab and has no prescription documents
- **THEN** the system shows an empty state with an upload CTA linking to `/app/upload?type=prescription`

#### Scenario: User selects Referrals tab

- **WHEN** the user selects the Referrals tab and has no referral documents
- **THEN** the system shows an empty state with an upload CTA linking to `/app/upload?type=referral`

#### Scenario: User selects DICOM tab

- **WHEN** the user selects the Medical images (DICOM) tab
- **THEN** the system shows a "Coming soon" message in English
- **AND** does not allow DICOM file upload

## ADDED Requirements

### Requirement: Extended tab upload actions

Each new document type tab (Discharge summaries, Prescriptions, Referrals) SHALL display a type-appropriate upload action when the tab is selected.

#### Scenario: Upload from prescriptions tab

- **WHEN** the user is on the Prescriptions tab
- **THEN** a prominent upload action navigates to `/app/upload?type=prescription`
- **AND** the upload flow remains subject to x402 payment on submit
