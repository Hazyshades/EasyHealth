## MODIFIED Requirements

### Requirement: Paid synthesis refresh endpoint

The system SHALL expose `POST /api/health-profile/synthesis` that forces regeneration of holistic health profile synthesis for the authenticated user without requiring payment.

#### Scenario: Authenticated refresh succeeds without payment

- **WHEN** a signed-in user calls `POST /api/health-profile/synthesis` without payment headers
- **THEN** the API returns HTTP 200 with new `synthesis_text` and `generated_at`
- **AND** `profile_health_synthesis` is updated regardless of prior cache hash
- **AND** the API does not return HTTP 402 for missing payment

#### Scenario: Unauthenticated refresh rejected

- **WHEN** a client calls `POST /api/health-profile/synthesis` without a valid session
- **THEN** the API returns HTTP 401

### Requirement: First synthesis remains free

Initial holistic synthesis generation on `GET /api/health-profile` when cache is missing or stale SHALL remain free and SHALL NOT require payment.

#### Scenario: Free first load

- **WHEN** a user loads Health Profile with no cached synthesis and structured documents exist
- **THEN** synthesis is generated or returned without payment on GET

### Requirement: Paid refresh UI affordance

The Health Profile page SHALL provide a "Refresh synthesis" control that regenerates synthesis for the signed-in user without initiating a payment flow.

#### Scenario: User triggers free refresh

- **WHEN** a signed-in user clicks Refresh synthesis on Health Profile
- **THEN** the client calls the synthesis refresh endpoint without x402 payment
- **AND** displays the updated synthesis text on success

### Requirement: Synthesis refresh safety

Synthesis refresh output SHALL follow the same medical safety rules as free synthesis: educational language, no new diagnoses or treatment plans, mandatory disclaimer.

#### Scenario: Refreshed synthesis includes disclaimer

- **WHEN** synthesis refresh completes
- **THEN** the response and UI include "This is not medical advice. Consult a healthcare professional."

## REMOVED Requirements

### Requirement: Synthesis refresh price

**Reason:** Human product is fully free; synthesis refresh no longer uses x402 pricing.
**Migration:** Clients call `POST /api/health-profile/synthesis` with session only; ignore USDC price configuration for this endpoint.
