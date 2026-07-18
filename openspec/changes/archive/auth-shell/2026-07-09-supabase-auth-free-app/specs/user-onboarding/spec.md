## MODIFIED Requirements

### Requirement: Profile gate blocks app until first name is provided

The system SHALL present a full-screen profile form after first Supabase Auth sign-in and BEFORE rendering the main app shell. The form MUST collect first name (required) and last name (optional). The main navigation shell MUST NOT be visible on this screen.

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

- **WHEN** Google OAuth via Supabase Auth provides a display name and the user opens the profile gate
- **THEN** the form pre-fills first and last name fields but still requires explicit submit

#### Scenario: Magic link user without name

- **WHEN** a user signs in with email magic link and has no name metadata
- **THEN** the profile gate shows empty name fields
- **AND** still requires first name before continuing

#### Scenario: Completed profile skips gate

- **WHEN** a user with `first_name` set navigates to `/onboarding/profile`
- **THEN** the system redirects them to the next incomplete onboarding step or `/app`

### Requirement: App layout enforces onboarding order

The system SHALL enforce onboarding gate order: Supabase session → profile → consent → app. Unauthenticated users MUST be redirected to the landing sign-in page.

#### Scenario: Unauthenticated app access

- **WHEN** a request hits `/app` without a valid Supabase session
- **THEN** the system redirects to `/?signin=required`

#### Scenario: Onboarding order profile before consent

- **WHEN** a user lacks `first_name` and attempts to access `/app` or `/onboarding/consent`
- **THEN** the system redirects to `/onboarding/profile`
