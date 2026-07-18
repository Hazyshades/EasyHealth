## MODIFIED Requirements

### Requirement: Supabase Auth is the sole session authority
All protected human PHR routes SHALL resolve the current user from the Supabase Auth session and SHALL reject requests without a valid session with HTTP 401. Profiles SHALL be keyed by the Supabase Auth user ID.

#### Scenario: Authenticated request
- **WHEN** a signed-in user calls a protected human API route
- **THEN** the route resolves that user's profile from the Supabase Auth user ID
- **AND** does not require wallet credentials or wallet-derived identity

#### Scenario: Unauthenticated request
- **WHEN** a request lacks a valid Supabase Auth session
- **THEN** the protected route returns HTTP 401

## REMOVED Requirements

### Requirement: Wallet-derived identity and payment state
Circle wallet identity fields and payment receipt or entitlement state are removed from the runtime schema.

**Reason:** The product no longer supports Circle wallets or x402 payments.

**Migration:** A forward migration drops retired columns and tables after a production backup/export decision is complete.