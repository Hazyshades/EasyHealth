# user-onboarding Specification Delta

## MODIFIED Requirements

### Requirement: Consent gate blocks app until required consents are recorded

The system SHALL present a full-screen consent screen after profile completion and BEFORE rendering the main app shell. The screen MUST include four separate required checkboxes (Terms of Service, Privacy Policy, health data processing, AI-assisted processing) and optional preference checkboxes. All required and optional checkboxes MUST default to unchecked. The consent gate MUST remain incomplete until all required consent timestamps exist and `terms_version` equals the current terms version.

#### Scenario: New user sees consent gate

- **WHEN** a user has `first_name` set and one or more required consent facts are missing, or the stored `terms_version` is not the current terms version
- **THEN** the system redirects them to `/onboarding/consent`

#### Scenario: Consent controls start unchecked

- **WHEN** the consent screen is first rendered for an incomplete consent state
- **THEN** all four required checkboxes and all optional preference checkboxes are unchecked

#### Scenario: Continue disabled until required consents checked

- **WHEN** fewer than four required consent checkboxes are checked
- **THEN** the Continue button is disabled

#### Scenario: Successful consent submission

- **WHEN** the user checks all four required consents and clicks Continue
- **THEN** the system records `terms_accepted_at`, `health_data_consent_at`, `ai_consent_at`, `terms_version`, and optional preferences server-side
- **AND** redirects to `/app`

#### Scenario: Consent timestamps are server-authoritative

- **WHEN** a client submits consent with required flags true
- **THEN** the server sets consent timestamps and the current terms version
- **AND** the client cannot set timestamps or terms version directly

#### Scenario: Partial consent cannot pass the gate

- **WHEN** `terms_accepted_at` exists but `health_data_consent_at` or `ai_consent_at` is missing
- **THEN** the system keeps the user at the consent gate

#### Scenario: Stale terms require re-consent

- **WHEN** all required consent timestamps exist but `terms_version` differs from the current terms version
- **THEN** the system keeps the user at the consent gate

#### Scenario: Completed current consent skips gate

- **WHEN** a user has all required consent timestamps and the current `terms_version`
- **THEN** the system redirects them to `/app`

## REMOVED Requirements

### Requirement: Getting-started wizard overlays dashboard

**Reason**: Replaced by the optional `platform-tour` capability, which introduces the app shell without treating orientation as task completion.

**Migration**: Use the current-version Platform Tour terminal state and `platform-tour` requirements. Do not persist or expose `wizard_steps_visited` as a runtime contract.

### Requirement: Success banner after wizard completion

**Reason**: The old requirement is coupled to the removed wizard terminology and completion semantics.

**Migration**: The dashboard MAY retain a dismissible completion banner, but its trigger and copy are defined by the current `platform-tour` implementation and versioned terminal state.
