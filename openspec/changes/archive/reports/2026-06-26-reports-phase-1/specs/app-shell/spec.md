## MODIFIED Requirements

### Requirement: Grouped sidebar navigation

The authenticated app shell SHALL display a sidebar with navigation groups MY HEALTH, MY DATA, and REPORTS containing links to Dashboard, Health Profile, Biomarkers, Documents, and Health reports respectively.

#### Scenario: Authenticated user sees sidebar

- **WHEN** a signed-in user opens any `/app/*` route
- **THEN** the sidebar displays grouped navigation links in English
- **AND** the current route is visually highlighted

#### Scenario: Unauthenticated user cannot access app shell

- **WHEN** a user without a session visits `/app/*`
- **THEN** the system redirects to the landing page with sign-in required

#### Scenario: Reports nav link

- **WHEN** a signed-in user views the sidebar REPORTS group
- **THEN** the link label is "Health reports"
- **AND** the link targets `/app/reports`

## MODIFIED Requirements

### Requirement: Dashboard landing page

The route `/app` SHALL render a dashboard with document count, link to upload, and shortcuts to Health Profile, Biomarkers, and Health reports.

#### Scenario: User opens dashboard with existing data

- **WHEN** a user with uploaded documents visits `/app`
- **THEN** the dashboard shows the count of completed documents
- **AND** provides navigation links to Documents, Health Profile, Biomarkers, and Health reports

#### Scenario: User opens dashboard with no data

- **WHEN** a user with no documents visits `/app`
- **THEN** the dashboard shows an empty state with a primary CTA to upload a lab
