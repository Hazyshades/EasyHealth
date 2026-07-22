## ADDED Requirements

### Requirement: Reports list page

The system SHALL provide a Health reports page at `/app/reports` listing saved reports for the signed-in user with a primary **Create report** action.

#### Scenario: User views reports list

- **WHEN** a signed-in user opens `/app/reports`
- **THEN** the page displays report cards with title, summary preview, report type, detail level, and date
- **AND** each card provides View and Delete actions in English

#### Scenario: Empty reports list

- **WHEN** a signed-in user has no saved reports
- **THEN** the page shows an empty state in English
- **AND** displays a **Create report** button

### Requirement: Create report page

The system SHALL provide a create form at `/app/reports/create` with fields for report name, report type, detail level, and document selection.

#### Scenario: Default report name

- **WHEN** the user opens `/app/reports/create`
- **THEN** the name field is pre-filled with a default such as "Report from {today's date}" in English locale format

#### Scenario: Report type options

- **WHEN** the user opens the report type selector
- **THEN** exactly three options are available: Primary care (general practice), Cardiology, and Endocrinology

#### Scenario: Detail level options

- **WHEN** the user opens the detail level selector
- **THEN** four options are available: Compact, Standard, Detailed, and Full
- **AND** Standard shows a hint such as "2–3 pages"

### Requirement: Document selection modal

The create page SHALL provide a **Select documents** control opening a modal to choose which uploaded records to include.

#### Scenario: No eligible documents

- **WHEN** the user has no eligible documents (completed labs with observations)
- **THEN** the Select documents control is disabled
- **AND** the Create report submit button is disabled

#### Scenario: User selects specific documents

- **WHEN** the user selects one or more documents in the modal and confirms
- **THEN** the form shows the selected count
- **AND** submission sends those document ids to `POST /api/reports`

#### Scenario: User does not open document modal

- **WHEN** the user submits without opening the document modal
- **THEN** submission sends `document_ids` as null
- **AND** all eligible documents are used server-side

#### Scenario: Select all and clear

- **WHEN** the document modal is open
- **THEN** the user can Select all or Clear selection

### Requirement: Paid report submission

Submitting the create form SHALL trigger x402 payment of $0.05 USDC before report generation.

#### Scenario: Successful create flow

- **WHEN** the user submits the form with valid data and sufficient USDC
- **THEN** the client pays via Arc Gateway
- **AND** redirects to `/app/reports/[id]` for the new report

#### Scenario: Payment or generation failure

- **WHEN** payment or generation fails
- **THEN** the user sees an English error message on the create page
- **AND** remains on `/app/reports/create`

### Requirement: Report detail page

The system SHALL provide `/app/reports/[id]` displaying the full report sections (overview, key findings, changes, questions, when to seek care, disclaimer).

#### Scenario: User views saved report

- **WHEN** a signed-in user opens `/app/reports/[id]` for their report
- **THEN** all report sections render from persisted content

#### Scenario: Back navigation

- **WHEN** the user is on `/app/reports/[id]`
- **THEN** a **Back to reports** control navigates to `/app/reports`

#### Scenario: Create another report

- **WHEN** the user is on `/app/reports/[id]`
- **THEN** a link or button to create another report navigates to `/app/reports/create`

### Requirement: Delete report from list

The reports list SHALL allow deleting a report with confirmation.

#### Scenario: User deletes a report

- **WHEN** the user confirms delete on a report card
- **THEN** the client calls `DELETE /api/reports/[id]`
- **AND** removes the card from the list on success

### Requirement: Remove legacy summary page

The system SHALL NOT serve `/app/summary` after this change.

#### Scenario: Legacy summary route removed

- **WHEN** a user navigates to `/app/summary`
- **THEN** the page does not exist (HTTP 404)

### Requirement: English UI strings

All user-facing labels, errors, and disclaimers on reports pages SHALL be in English.

#### Scenario: Reports UI language

- **WHEN** any reports page is rendered
- **THEN** all visible strings are English
