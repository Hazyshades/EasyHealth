## ADDED Requirements

### Requirement: Account page

The system SHALL provide an Account page at `/app/account` showing the signed-in user's wallet and profile metadata.

#### Scenario: User views account page

- **WHEN** a signed-in user opens `/app/account`
- **THEN** the page displays the wallet address in truncated form
- **AND** displays the stored first name when available
- **AND** displays profile creation date or equivalent metadata in English

#### Scenario: Unauthenticated access

- **WHEN** an unauthenticated user attempts to open `/app/account`
- **THEN** the app redirects to sign-in per existing app layout rules

### Requirement: General settings page

The system SHALL provide a Settings page at `/app/settings` reachable from the user menu.

#### Scenario: User opens settings

- **WHEN** a signed-in user opens `/app/settings`
- **THEN** the page renders in English
- **AND** provides navigation or link to AI Settings at `/app/settings/ai`

### Requirement: Persist Google first name on login

The system SHALL capture the user's Google first name during sign-in and persist it on the profile for display in the user menu.

#### Scenario: First login stores first name

- **WHEN** a user completes Google sign-in via Circle for the first time
- **THEN** the server stores the Google first name on `profiles.display_name`
- **AND** subsequent sessions expose it via profile API for the menu label

#### Scenario: Returning user retains first name

- **WHEN** a returning user loads the app with an existing session
- **THEN** the user menu displays the previously stored first name without requiring re-entry

### Requirement: Profile read API

The system SHALL expose `GET /api/profile` returning session-scoped profile fields including `display_name` and `ai_provider`.

#### Scenario: Authenticated profile fetch

- **WHEN** a signed-in user calls `GET /api/profile`
- **THEN** the response includes `wallet_address`, `display_name`, `ai_provider`, and `created_at`
- **AND** returns HTTP 401 when unauthenticated

### Requirement: English UI strings for account pages

All user-facing strings on Account and Settings pages SHALL be in English.

#### Scenario: Account settings language

- **WHEN** Account or Settings pages are rendered
- **THEN** all visible labels and messages are English
