# supabase-auth Specification Delta

## ADDED Requirements

### Requirement: Profile readiness is distinct from an authenticated Auth user

The system MUST distinguish a server-verified Supabase Auth user from a successfully ensured and readable Profile. A Profile ensure or hydration failure MUST NOT be represented as a ready Profile id.

#### Scenario: Profile ensure fails during onboarding entry

- **WHEN** a valid Supabase session exists but Profile ensure fails on the onboarding entry path
- **THEN** the system does not render a Profile-dependent onboarding page as ready
- **AND** presents a recoverable English setup/sign-in error
- **AND** does not redirect into the authenticated app shell as if the Profile were ready

#### Scenario: Profile hydration fails in the client shell

- **WHEN** the browser has a valid Auth user but the Profile route returns a non-success response
- **THEN** client auth state identifies the user as authenticated with Profile unavailable
- **AND** does not fabricate a ready Profile id from the Auth user id

#### Scenario: Valid Auth user and Profile remain usable

- **WHEN** the session is valid and the corresponding Profile is readable
- **THEN** the system exposes the Profile-ready state
- **AND** existing protected routes continue to resolve ownership from the server session

### Requirement: Auth callback failures expose safe recoverable reasons

The auth callback MUST fail closed on exchange or Profile setup failure and MUST expose a stable English-facing reason that the landing/auth surface can render without forwarding raw provider error details.

#### Scenario: Invalid or expired callback code

- **WHEN** `/auth/callback` cannot exchange the supplied code
- **THEN** the system does not enter `/app`
- **AND** redirects to an English error state with a safe reason code
- **AND** the user can request a new magic link

#### Scenario: Profile setup failure after successful exchange

- **WHEN** code exchange succeeds but Profile setup fails
- **THEN** the system does not enter `/app`
- **AND** redirects to an English recoverable setup error
- **AND** does not expose the raw provider or database error in the redirect contract
