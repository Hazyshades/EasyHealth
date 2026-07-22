## ADDED Requirements

### Requirement: Documents hub page

The system SHALL provide a Documents page at `/app/documents` listing the user's uploaded medical documents with filtering by document type.

#### Scenario: User views lab documents tab

- **WHEN** a signed-in user opens `/app/documents` with the Lab results tab selected
- **THEN** the system displays only documents with `document_type` of `lab`
- **AND** each row shows filename, status, observed date, and lab name when available

#### Scenario: User views empty lab tab

- **WHEN** a signed-in user has no lab documents
- **THEN** the Lab results tab shows an empty state message in English
- **AND** displays a primary "Upload your lab" button

### Requirement: Document type tabs

The Documents page SHALL include tabs for Lab results, Imaging reports, Consultations, and DICOM.

#### Scenario: User selects Imaging tab with no imaging documents

- **WHEN** the user selects the Imaging reports tab and has no imaging documents
- **THEN** the system shows an empty state indicating no imaging reports yet

#### Scenario: User selects DICOM tab

- **WHEN** the user selects the DICOM tab
- **THEN** the system shows a "Coming soon" message
- **AND** does not allow DICOM file upload in the hackathon MVP

### Requirement: Upload CTA from Documents

The Documents page SHALL include a prominent "Upload your lab" action linking to the upload flow.

#### Scenario: User clicks upload from Documents

- **WHEN** the user clicks "Upload your lab"
- **THEN** the system navigates to `/app/upload`
- **AND** the upload flow remains subject to x402 payment on submit

### Requirement: Document status display

Each document card SHALL display processing status as one of processing, completed, or failed.

#### Scenario: Failed document shown in list

- **WHEN** a document has status `failed`
- **THEN** the list shows a failed indicator
- **AND** displays a user-friendly error message when `error_message` is present
