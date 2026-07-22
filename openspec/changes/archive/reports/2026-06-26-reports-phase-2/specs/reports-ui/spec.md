## MODIFIED Requirements

### Requirement: Reports list page

The system SHALL provide a Health reports page at `/app/reports` listing saved reports for the signed-in user with search, time-range and type filters, month grouping, and a primary **Create report** action.

#### Scenario: User views reports list

- **WHEN** a signed-in user opens `/app/reports`
- **THEN** the page displays report cards grouped by calendar month in English
- **AND** each card shows title, summary preview, report type, detail level, date, and abnormal-only badge when applicable
- **AND** each card provides View and Delete actions

#### Scenario: User searches reports

- **WHEN** the user types in the search field
- **THEN** the list updates to show only matching reports (debounced server fetch)

#### Scenario: User filters by time range

- **WHEN** the user selects a time range preset
- **THEN** the list shows only reports within that range

#### Scenario: User filters by report type

- **WHEN** the user selects a report type from the filter dropdown
- **THEN** the list shows only reports of that type

#### Scenario: Empty filtered list

- **WHEN** filters yield no reports
- **THEN** the page shows an empty state in English with option to clear filters

#### Scenario: Empty reports list

- **WHEN** a signed-in user has no saved reports
- **THEN** the page shows an empty state in English
- **AND** displays a **Create report** button

### Requirement: Create report page

The system SHALL provide a create form at `/app/reports/create` with fields for report name, report type (eight specialties), detail level, and document selection.

#### Scenario: Report type options

- **WHEN** the user opens the report type selector
- **THEN** eight specialty options are available in English

### Requirement: Document selection modal

The create page SHALL provide a **Select documents** control opening a modal to choose which uploaded records to include, with an optional abnormal-only setting.

#### Scenario: Abnormal-only toggle

- **WHEN** the user opens the document selection modal
- **THEN** an **Additional settings** section offers **Include only out-of-range indicators**
- **AND** the chosen value is sent as `abnormal_only` on report creation

#### Scenario: User selects specific documents

- **WHEN** the user selects one or more documents in the modal and confirms
- **THEN** the form shows the selected count
- **AND** submission sends those document ids to `POST /api/reports`

### Requirement: Report detail page

The system SHALL provide `/app/reports/[id]` displaying the full report sections and metadata including abnormal-only when set.

#### Scenario: User views report with abnormal-only

- **WHEN** a report was generated with `abnormal_only` true
- **THEN** the detail page displays an indicator that only out-of-range indicators were included
