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

#### Scenario: Owner downloads a report export

- **WHEN** an authenticated owner requests `GET /api/reports/{id}/export` with a supported format for a report they own
- **THEN** the response carries the exported bytes with the report's content type and an attachment filename
- **AND** the response is marked private, no-store, and nosniff

#### Scenario: Anonymous export request is rejected

- **WHEN** a request without an owner session reaches the export route
- **THEN** the server returns a generic authorization failure
- **AND** no report content, format availability, or filename is disclosed

#### Scenario: Legacy report offers no export

- **WHEN** an owner opens a legacy report that cannot be revalidated
- **THEN** the page renders no export actions
- **AND** the existing legacy presentation and navigation remain unchanged

#### Scenario: Export failure stays generic

- **WHEN** an export fails because the report is unavailable, its validation envelope is invalid, its persisted dynamics are rejected, it is too large, or serialization fails
- **THEN** the server returns a fixed public message with the matching export status code
- **AND** the response contains no internal exception text, validation issue code, storage path, or partial file

#### Scenario: Download filename cannot escape the download folder

- **WHEN** an export response supplies a `Content-Disposition` filename
- **THEN** the saved file uses that name with path separators and control characters removed
- **AND** an unparseable or empty name falls back to a safe default instead of failing the download
