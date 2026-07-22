## MODIFIED Requirements

### Requirement: Account page

The system SHALL provide an Account page at `/app/account` showing the signed-in user's email, auth identity context, and profile metadata (not wallet address as primary identity).

#### Scenario: User views account page

- **WHEN** a signed-in user opens `/app/account`
- **THEN** the page displays the account email when available
- **AND** displays the stored first name when available
- **AND** displays profile creation date or equivalent metadata in English
- **AND** does not require a wallet address to render the page

#### Scenario: Unauthenticated access

- **WHEN** an unauthenticated user attempts to open `/app/account`
- **THEN** the app redirects to sign-in per existing app layout rules

### Requirement: Persist Google first name on login

The system SHALL capture the user's Google display name (when present) during Supabase Google sign-in for onboarding prefill and MAY persist a display name on the profile after onboarding or ensure-profile defaults.

#### Scenario: First Google login exposes name for onboarding

- **WHEN** a user completes Google sign-in via Supabase Auth for the first time and Google provides a name
- **THEN** the onboarding profile gate can pre-fill name fields from that metadata
- **AND** subsequent sessions expose the saved profile name via profile API for the menu label after the user completes profile onboarding

#### Scenario: Returning user retains first name

- **WHEN** a returning user loads the app with an existing session
- **THEN** the user menu displays the previously stored first name without requiring re-entry

### Requirement: Profile read API

The system SHALL expose `GET /api/profile` returning session-scoped profile fields including `display_name`, `email`, and `ai_provider`.

#### Scenario: Authenticated profile fetch

- **WHEN** a signed-in user calls `GET /api/profile`
- **THEN** the response includes `display_name`, `email`, `ai_provider`, and `created_at`
- **AND** returns HTTP 401 when unauthenticated
- **AND** does not require `wallet_address` as a mandatory response field
