## MODIFIED Requirements

### Requirement: Documents hub page

The system SHALL provide a Documents page at `/app/documents` listing the user's uploaded medical documents with filtering by document type.

#### Scenario: User views lab documents tab

- **WHEN** a signed-in user opens `/app/documents` with the Lab results tab selected
- **THEN** the system displays only documents with `document_type` of `lab_result`
- **AND** each row shows filename, status, observed date, and lab name when available

#### Scenario: User views empty lab tab

- **WHEN** a signed-in user has no lab documents
- **THEN** the Lab results tab shows an empty state message in English
- **AND** displays a primary "Upload lab results" button linking to `/app/upload?type=lab_result`

### Requirement: Document type tabs

The Documents page SHALL include tabs for Lab results, Imaging studies, Consultations, and Medical images (DICOM).

#### Scenario: User selects Imaging tab with no imaging documents

- **WHEN** the user selects the Imaging studies tab and has no instrumental documents
- **THEN** the system shows an empty state indicating no imaging reports yet
- **AND** displays an upload CTA linking to `/app/upload?type=instrumental_report`

#### Scenario: User selects Consultations tab with no consultations

- **WHEN** the user selects the Consultations tab and has no consultation documents
- **THEN** the system shows an empty state with an upload CTA linking to `/app/upload?type=consultation_note`

#### Scenario: User selects DICOM tab

- **WHEN** the user selects the Medical images (DICOM) tab
- **THEN** the system shows a "Coming soon" message in English
- **AND** does not allow DICOM file upload

### Requirement: Upload CTA from Documents

The Documents page SHALL include upload actions for lab results, imaging studies, and consultations linking to the corresponding typed upload flow.

#### Scenario: User clicks upload from Documents lab tab

- **WHEN** the user clicks upload from the Lab results tab
- **THEN** the system navigates to `/app/upload?type=lab_result`
- **AND** the upload flow remains subject to x402 payment on submit

## ADDED Requirements

### Requirement: Per-tab upload actions

Each active document type tab (Lab results, Imaging studies, Consultations) SHALL display a type-appropriate upload action when the tab is selected.

#### Scenario: Upload from imaging tab

- **WHEN** the user is on the Imaging studies tab
- **THEN** a prominent upload action navigates to `/app/upload?type=instrumental_report`
- **AND** the upload flow remains subject to x402 payment on submit
