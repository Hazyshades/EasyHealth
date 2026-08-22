## ADDED Requirements

### Requirement: Profile ensure is confined to auth entry

The system SHALL create or upsert a `profiles` row during successful auth callback (and MAY do so on `/onboarding/*` if the row is still missing). The system MUST NOT upsert `profiles` as part of rendering the authenticated `/app/*` shell. `ensureProfile` remains idempotent when it does run.

#### Scenario: Successful callback creates the profile

- **WHEN** `/auth/callback` exchanges a valid auth code for a session
- **THEN** the system ensures a `profiles` row with `id` equal to `auth.users.id` before redirecting into onboarding or `/app`

#### Scenario: Failed ensure does not enter the app shell

- **WHEN** `/auth/callback` cannot ensure a `profiles` row after a successful code exchange
- **THEN** the system does not redirect to `/app` as if sign-in succeeded
- **AND** the user is shown a sign-in error they can retry

#### Scenario: App shell does not repair a missing profile by upsert

- **WHEN** a signed-in user hits `/app/*` and `ensureProfile` is not invoked
- **THEN** no `profiles` upsert runs in that layout
- **AND** a missing row is handled by redirecting to onboarding, not by creating the row in the shell

### Requirement: Session cookie refresh can persist outside RSC

The system SHALL be able to persist Supabase session cookie updates when Server Components cannot write cookies. A successful refresh of an expired or near-expiry access token MUST result in updated cookies on the HTTP response that performed the refresh.

#### Scenario: Expired access token with valid refresh token

- **WHEN** a browser request to a protected `/app/*` route presents an expired access token and a valid refresh token
- **THEN** the system establishes a refreshed session
- **AND** the response includes the updated auth cookies
- **AND** a subsequent request using those cookies resolves the same user
