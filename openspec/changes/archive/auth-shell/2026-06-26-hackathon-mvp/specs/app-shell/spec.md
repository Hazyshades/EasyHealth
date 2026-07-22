## ADDED Requirements

### Requirement: Grouped sidebar navigation

The authenticated app shell SHALL display a sidebar with navigation groups MY HEALTH, MY DATA, and REPORTS containing links to Dashboard, Health Profile, Biomarkers, Documents, and Doctor summary respectively.

#### Scenario: Authenticated user sees sidebar

- **WHEN** a signed-in user opens any `/app/*` route
- **THEN** the sidebar displays grouped navigation links in English
- **AND** the current route is visually highlighted

#### Scenario: Unauthenticated user cannot access app shell

- **WHEN** a user without a session visits `/app/*`
- **THEN** the system redirects to the landing page with sign-in required

### Requirement: Wallet context in app header

The app shell SHALL display the user's wallet address and USDC balances in a compact top bar above the main content area.

#### Scenario: Wallet info visible when signed in

- **WHEN** a signed-in user views the app shell
- **THEN** shortened wallet address and USDC balance are shown in the header area

### Requirement: Dashboard landing page

The route `/app` SHALL render a dashboard with document count, link to upload, and shortcuts to Health Profile and Biomarkers.

#### Scenario: User opens dashboard with existing data

- **WHEN** a user with uploaded documents visits `/app`
- **THEN** the dashboard shows the count of completed documents
- **AND** provides navigation links to Documents, Health Profile, and Biomarkers

#### Scenario: User opens dashboard with no data

- **WHEN** a user with no documents visits `/app`
- **THEN** the dashboard shows an empty state with a primary CTA to upload a lab
