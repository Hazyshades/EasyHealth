## ADDED Requirements

### Requirement: Authenticated app navigation is a read-only hot path

The system SHALL resolve an authenticated `/app/*` navigation without creating or upserting a `profiles` row. The layout SHALL use the existing Supabase session to obtain the user id and SHALL read onboarding state from the existing profile row. Profile creation remains an auth-entry concern.

#### Scenario: Returning user opens Documents

- **WHEN** a signed-in user with an existing `profiles` row navigates to `/app/documents`
- **THEN** the app shell renders without a `profiles` upsert
- **AND** the request still enforces the existing unauthenticated and onboarding redirects

#### Scenario: Signed-in user missing a profile row

- **WHEN** a request to `/app/*` has a valid Supabase session but no `profiles` row
- **THEN** the system does not create the row in the app shell layout
- **AND** the user is sent to `/onboarding/profile` rather than a successful app shell render

### Requirement: One session user resolution per app layout request

Within a single App Router request that renders the authenticated app layout, the system SHALL resolve `auth.getUser` (or equivalent session user) at most once and reuse that result for the layout gate and any server-loaded page data in that same request.

#### Scenario: Layout and server Documents list share the session user

- **WHEN** `/app/documents` is rendered on the server for a signed-in user
- **THEN** session user resolution runs once for that request
- **AND** both the layout gate and the initial documents list authorization use that user id

### Requirement: Warm authenticated Documents RSC stays within budget on production server

On `next start` (production Next server), a warm authenticated RSC request for `/app/documents` SHALL complete within 80ms at p50 and 150ms at p95 over at least 10 consecutive warm samples, excluding first-compile `next dev` remainder. That request SHALL perform zero `profiles` upserts.

#### Scenario: Warm production RSC budget

- **WHEN** an already-signed-in user with a valid session issues ten consecutive warm `GET /app/documents` RSC navigations against `next start`
- **THEN** total request time p50 is ≤ 80ms and p95 is ≤ 150ms
- **AND** none of those requests upsert `profiles`

### Requirement: Session refresh persistence does not tax warm valid tokens

If the system refreshes Supabase auth cookies outside RSC, it SHALL persist rotated cookies when the access token is missing, invalid, or near expiry. A warm request with a valid access token that is not near expiry SHALL NOT perform an extra Auth refresh round-trip solely to rewrite cookies.

#### Scenario: Warm valid session skips refresh round-trip

- **WHEN** the access token is valid and not within 60 seconds of expiry
- **THEN** middleware or equivalent cookie writer does not call the Auth refresh token endpoint
- **AND** the app layout still validates the user via session resolution

#### Scenario: Near-expiry token can persist new cookies

- **WHEN** the access token is expired or within 60 seconds of expiry and a valid refresh token exists
- **THEN** the system refreshes the session
- **AND** the new cookies are persisted on the response (not dropped as a read-only RSC `setAll` failure)
