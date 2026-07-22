## ADDED Requirements

### Requirement: Biomarkers overview page

The system SHALL provide a Biomarkers page at `/app/biomarkers` displaying a table of all extracted observations and a trend chart for a selected biomarker.

#### Scenario: User views biomarker table

- **WHEN** a signed-in user with observations opens `/app/biomarkers`
- **THEN** the page displays a table with biomarker name, value, unit, reference range, and observed date

#### Scenario: User selects biomarker for trend chart

- **WHEN** the user selects a biomarker from the dropdown
- **THEN** the trend chart updates to show historical values for that biomarker key ordered by observed date

### Requirement: Biomarkers page relocated from legacy route

The biomarker table and chart functionality previously at `/app` SHALL be served from `/app/biomarkers` only.

#### Scenario: Legacy health card route no longer shows biomarker table

- **WHEN** a user visits `/app`
- **THEN** the biomarker table is not the primary content
- **AND** the dashboard or navigation directs users to `/app/biomarkers` for detailed biomarker views

### Requirement: Medical disclaimer on biomarkers page

The Biomarkers page SHALL display the standard medical disclaimer.

#### Scenario: Disclaimer on biomarkers page

- **WHEN** a user views `/app/biomarkers`
- **THEN** the medical disclaimer is visible on the page
