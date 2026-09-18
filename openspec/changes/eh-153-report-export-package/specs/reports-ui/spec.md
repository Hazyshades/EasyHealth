# reports-ui

## MODIFIED Requirements

### Requirement: Report detail export actions

The report detail and approved share surfaces SHALL offer PDF, CSV, and JSON actions only when the current access context permits the format. The actions SHALL show pending and failure states without changing the report content or leaking token material.

#### Scenario: Owner sees export actions

- **WHEN** an owner opens a validated report
- **THEN** the page offers PDF, CSV, and JSON for the validated owner report
- **AND** the downloaded content matches the visible sections and limitations

#### Scenario: Share policy denies a format

- **WHEN** a recipient opens a report-only share whose policy does not permit raw document downloads
- **THEN** the page does not offer a raw document download
- **AND** a direct request for that resource is denied server-side
