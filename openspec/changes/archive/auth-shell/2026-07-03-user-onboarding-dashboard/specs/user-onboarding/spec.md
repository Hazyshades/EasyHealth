## ADDED Requirements

### Requirement: Profile gate blocks app until first name is provided

The system SHALL present a full-screen profile form after first wallet sign-in and BEFORE rendering the main app shell. The form MUST collect first name (required) and last name (optional). The main navigation shell MUST NOT be visible on this screen.

#### Scenario: New user sees profile gate

- **WHEN** a user signs in for the first time and has no `first_name` on their profile
- **THEN** the system redirects them to `/onboarding/profile` with a full-screen form

#### Scenario: First name is required

- **WHEN** the user submits the profile form with an empty first name
- **THEN** the system shows a validation error and does not advance to the next step

#### Scenario: Last name is optional

- **WHEN** the user submits the profile form with a valid first name and an empty last name
- **THEN** the system saves the profile and advances to the consent step

#### Scenario: Profile gate pre-fills from OAuth

- **WHEN** Google OAuth provides a display name and the user opens the profile gate
- **THEN** the form pre-fills first and last name fields but still requires explicit submit

#### Scenario: Completed profile skips gate

- **WHEN** a user with `first_name` set navigates to `/onboarding/profile`
- **THEN** the system redirects them to the next incomplete onboarding step or `/app`

### Requirement: Consent gate blocks app until required consents are recorded

The system SHALL present a full-screen consent screen after profile completion and BEFORE rendering the main app shell. The screen MUST include four separate required checkboxes (Terms of Service, Privacy Policy, health data processing, AI-assisted processing) and optional preference checkboxes. All checkboxes MUST default to unchecked.

#### Scenario: New user sees consent gate

- **WHEN** a user has `first_name` set but `terms_accepted_at` is null
- **THEN** the system redirects them to `/onboarding/consent`

#### Scenario: Continue disabled until required consents checked

- **WHEN** fewer than four required consent checkboxes are checked
- **THEN** the Continue button is disabled

#### Scenario: Successful consent submission

- **WHEN** the user checks all four required consents and clicks Continue
- **THEN** the system records `terms_accepted_at`, `health_data_consent_at`, `ai_consent_at`, `terms_version`, and optional preferences server-side and redirects to `/app`

#### Scenario: Consent timestamps are server-authoritative

- **WHEN** a client submits consent with required flags true
- **THEN** the server sets consent timestamps; the client cannot set timestamps directly

#### Scenario: Completed consent skips gate

- **WHEN** a user with `terms_accepted_at` set navigates to `/onboarding/consent`
- **THEN** the system redirects them to `/app`

### Requirement: App layout enforces onboarding order

The system SHALL enforce onboarding gate order: session → profile → consent → app. Unauthenticated users MUST be redirected to the landing sign-in page.

#### Scenario: Unauthenticated app access

- **WHEN** a request hits `/app` without a valid session
- **THEN** the system redirects to `/?signin=required`

#### Scenario: Onboarding order profile before consent

- **WHEN** a user lacks `first_name` and attempts to access `/app` or `/onboarding/consent`
- **THEN** the system redirects to `/onboarding/profile`

### Requirement: Getting-started wizard overlays dashboard

After onboarding gates are complete, the system SHALL show a skippable getting-started wizard as a modal overlay on the dashboard. The app shell (sidebar and top bar) MUST remain visible behind the overlay.

#### Scenario: Wizard shown for new users

- **WHEN** a user has completed consent gates and both `onboarding_dismissed_at` and `onboarding_completed_at` are null
- **THEN** the getting-started wizard is displayed on `/app`

#### Scenario: Wizard can be skipped

- **WHEN** the user clicks Skip on the wizard
- **THEN** the system sets `onboarding_dismissed_at` and hides the wizard

#### Scenario: Wizard can be completed via Done

- **WHEN** the user clicks Done on the wizard
- **THEN** the system sets `onboarding_completed_at` and hides the wizard

#### Scenario: Wizard not shown after skip or complete

- **WHEN** `onboarding_dismissed_at` or `onboarding_completed_at` is set
- **THEN** the wizard is not shown on subsequent visits

#### Scenario: Wizard steps reflect MVP flows

- **WHEN** the wizard is displayed
- **THEN** it presents three steps: upload first lab, view biomarkers, and generate a health report, with progress indicator and links to the corresponding app routes

### Requirement: Success banner after wizard completion

The system SHALL show a dismissible success banner on the dashboard after the user completes the wizard via Done.

#### Scenario: Banner shown after Done

- **WHEN** the user completes the wizard with Done and has not dismissed the banner
- **THEN** a success banner is shown on the dashboard explaining setup is complete

#### Scenario: Banner can be dismissed

- **WHEN** the user dismisses the success banner
- **THEN** the banner is not shown again for that user

### Requirement: Onboarding UI is English-only

All user-facing strings in onboarding flows MUST be in English, including labels, errors, consent copy, wizard text, and disclaimers.

#### Scenario: Profile and consent copy language

- **WHEN** any onboarding screen is rendered
- **THEN** all visible text is in English
