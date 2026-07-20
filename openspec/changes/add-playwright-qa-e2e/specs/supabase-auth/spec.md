## MODIFIED Requirements

### Requirement: Email magic link sign-in

The system SHALL allow users to sign in with email via Supabase magic link (OTP email link), without passwords.

#### Scenario: User requests magic link

- **WHEN** a user submits a valid email address for magic link sign-in
- **THEN** the system requests a Supabase email magic link for that address
- **AND** shows a check-your-email confirmation screen

#### Scenario: User completes a server-side magic link

- **WHEN** the user opens a valid magic-link URL that supplies `token_hash` and its Supabase email verification type to `/auth/callback`
- **THEN** the system verifies the one-time token server-side
- **AND** establishes a Supabase session
- **AND** ensures a `profiles` row exists with `id` equal to `auth.users.id`
- **AND** redirects to onboarding if incomplete or to `/app` if complete

#### Scenario: Invalid or expired magic link

- **WHEN** the user opens an invalid or expired magic link
- **THEN** the system does not establish a session
- **AND** presents an English error allowing the user to request a new link

### Requirement: Auth callback exchange

The system SHALL expose an auth callback route that uses the server-side Supabase client to establish a session from either a valid Supabase auth code or a valid one-time `token_hash` plus email verification type, then redirects into the app or onboarding.

#### Scenario: Successful PKCE callback

- **WHEN** `/auth/callback` receives a valid auth code
- **THEN** the system establishes session cookies
- **AND** ensures the profile row exists
- **AND** redirects the user to the next appropriate route

#### Scenario: Successful token-hash callback

- **WHEN** `/auth/callback` receives a valid `token_hash` and supported email verification type
- **THEN** the system verifies the token with Supabase on the server
- **AND** establishes session cookies
- **AND** ensures the profile row exists
- **AND** redirects without retaining the token hash in the destination URL
