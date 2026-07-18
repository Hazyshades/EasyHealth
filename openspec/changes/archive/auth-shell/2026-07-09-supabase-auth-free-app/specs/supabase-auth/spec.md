## ADDED Requirements

### Requirement: Google OAuth sign-in via Supabase Auth

The system SHALL allow users to sign in with Google using Supabase Auth OAuth. Successful authentication MUST establish a server-verified Supabase session and ensure a corresponding `profiles` row exists.

#### Scenario: New user signs in with Google

- **WHEN** a user completes Google OAuth through Supabase Auth for the first time
- **THEN** the system creates a Supabase session
- **AND** creates a `profiles` row with `id` equal to `auth.users.id`
- **AND** stores the verified email on the profile when available

#### Scenario: Returning Google user

- **WHEN** a user who already has a profile signs in with Google again
- **THEN** the system restores their session
- **AND** does not create a duplicate profile

#### Scenario: Google name available for onboarding prefill

- **WHEN** Google provides a display name in user metadata
- **THEN** the onboarding profile gate MAY pre-fill first and last name from that metadata
- **AND** still requires explicit user submit for first name

### Requirement: Email magic link sign-in

The system SHALL allow users to sign in with email via Supabase magic link (OTP email link), without passwords.

#### Scenario: User requests magic link

- **WHEN** a user submits a valid email address for magic link sign-in
- **THEN** the system requests a Supabase email magic link for that address
- **AND** shows a check-your-email confirmation screen

#### Scenario: User completes magic link

- **WHEN** the user opens a valid magic link and the auth callback exchanges the code successfully
- **THEN** the system establishes a Supabase session
- **AND** ensures a `profiles` row exists with `id` equal to `auth.users.id`
- **AND** redirects to onboarding if incomplete or to `/app` if complete

#### Scenario: Invalid or expired magic link

- **WHEN** the user opens an invalid or expired magic link
- **THEN** the system does not establish a session
- **AND** presents an English error allowing the user to request a new link

### Requirement: Auth callback exchange

The system SHALL expose an auth callback route that exchanges the Supabase auth code for a session using the server-side Supabase client and then redirects into the app or onboarding.

#### Scenario: Successful callback

- **WHEN** `/auth/callback` receives a valid auth code
- **THEN** the system establishes session cookies
- **AND** ensures the profile row exists
- **AND** redirects the user to the next appropriate route

### Requirement: Server session resolution

All human authenticated API routes and protected layouts SHALL resolve the current user via Supabase session (JWT/cookies), not via a client-supplied wallet address or a bare forgeable profile id cookie.

#### Scenario: Authenticated API call

- **WHEN** a request includes a valid Supabase session for a user with a profile
- **THEN** `getSessionProfileId` (or equivalent) returns that user's profile id

#### Scenario: Unauthenticated API call

- **WHEN** a request has no valid Supabase session
- **THEN** session resolution returns null
- **AND** protected APIs respond with HTTP 401

#### Scenario: Legacy profile cookie ignored

- **WHEN** a client presents only a legacy `eh_profile_id` cookie without a Supabase session
- **THEN** the system MUST NOT treat the user as authenticated

### Requirement: Sign out

The system SHALL allow a signed-in user to sign out, clearing the Supabase session and returning them to the landing page.

#### Scenario: User signs out

- **WHEN** a signed-in user activates Sign out
- **THEN** the Supabase session is cleared
- **AND** subsequent `/app/*` visits redirect to the landing page with sign-in required

### Requirement: Profile ensure is idempotent

The system SHALL create a profile at most once per auth user and MUST be safe to call on every login.

#### Scenario: Concurrent ensure

- **WHEN** ensure-profile runs twice for the same auth user id
- **THEN** only one `profiles` row exists for that id

### Requirement: Free human core actions under session

Document upload, educational report generation, and health synthesis refresh for signed-in human users SHALL NOT require x402 or any USDC payment.

#### Scenario: Free upload

- **WHEN** a signed-in user uploads a document via `POST /api/upload` without payment headers
- **THEN** the request is accepted if otherwise valid (file type, auth)
- **AND** the API does not return HTTP 402 for missing payment

#### Scenario: Free report generation

- **WHEN** a signed-in user requests educational report generation without payment headers
- **THEN** the API does not return HTTP 402 for missing payment

#### Scenario: Free synthesis refresh

- **WHEN** a signed-in user calls `POST /api/health-profile/synthesis` without payment headers
- **THEN** the API regenerates synthesis when allowed by product rules
- **AND** does not return HTTP 402 for missing payment
