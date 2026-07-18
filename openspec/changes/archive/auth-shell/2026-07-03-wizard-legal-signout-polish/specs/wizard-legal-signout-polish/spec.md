## ADDED Requirements

### Requirement: Wizard step completes immediately on Go

The system SHALL mark a getting-started wizard step as completed when the user clicks **Go** on that step, before or as navigation to the step target route begins.

#### Scenario: Upload step marked on Go click

- **WHEN** the user clicks **Go** on the "Upload your first lab" wizard step
- **THEN** the step is marked as visited/completed in UI and persisted server-side
- **THEN** the user navigates to `/app/upload`

#### Scenario: Progress bar updates after Go

- **WHEN** the user completes a wizard step via **Go**
- **THEN** the wizard progress indicator (e.g. 1/3) updates to reflect the newly visited step

### Requirement: Wizard visited progress persists across navigation

The system SHALL persist visited wizard step identifiers so progress survives leaving and returning to the dashboard.

#### Scenario: Return to dashboard shows visited steps

- **WHEN** the user clicks **Go** on a wizard step, navigates away, and later returns to `/app` while the wizard is still open
- **THEN** previously visited steps display as completed

#### Scenario: Visited progress stored server-side

- **WHEN** a wizard step is marked visited via **Go**
- **THEN** the visited step id is stored in the user's profile preferences on the server

## ADDED Requirements

### Requirement: Legal pages display full document content

The system SHALL render the full Privacy Policy, Terms of Service, and Cookie Policy on `/legal/privacy`, `/legal/terms`, and `/legal/cookies` respectively.

#### Scenario: Privacy Policy page content

- **WHEN** a user opens `/legal/privacy`
- **THEN** the page displays the content from `Privacy Policy.md` with readable heading and body formatting

#### Scenario: Terms of Service page content

- **WHEN** a user opens `/legal/terms`
- **THEN** the page displays the content from `Terms of Service.MD`

#### Scenario: Cookie Policy page content

- **WHEN** a user opens `/legal/cookies`
- **THEN** the page displays the content from `COOCKE.MD`

### Requirement: Legal placeholders remain unchanged

The system SHALL display legal document bracket placeholders exactly as written in source files (e.g. `[Company Address]`, `[privacy@[domain].com]`) without auto-substitution.

#### Scenario: Placeholder visible in rendered legal page

- **WHEN** a legal document source contains `[Company Legal Name]`
- **THEN** the rendered page shows `[Company Legal Name]` verbatim

### Requirement: Legal pages are publicly accessible

Legal document routes MUST NOT require authentication.

#### Scenario: Unauthenticated access to legal pages

- **WHEN** a user without a session opens `/legal/terms`
- **THEN** the page loads successfully without redirect to sign-in

## ADDED Requirements

### Requirement: Sign out redirects to landing page

The system SHALL navigate the user to the landing page (`/`) after a successful sign out.

#### Scenario: Sign out from app dashboard

- **WHEN** an authenticated user clicks **Sign out** from the app
- **THEN** the session is cleared
- **THEN** the user is redirected to `/`

#### Scenario: Sign out does not leave user on protected route

- **WHEN** sign out completes while the user is on any `/app/*` route
- **THEN** the user is not left viewing the authenticated app shell

## ADDED Requirements

### Requirement: Profile registration button is visibly styled

The **Complete registration** button on `/onboarding/profile` MUST use a solid, high-contrast primary color with white label text so it is clearly visible on a white background.

#### Scenario: Button visible before submit

- **WHEN** the profile onboarding form is displayed with a valid first name entered
- **THEN** the **Complete registration** button appears as a solid colored button with readable white text
