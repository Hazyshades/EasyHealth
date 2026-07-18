## ADDED Requirements

### Requirement: Paid synthesis refresh endpoint

The system SHALL expose `POST /api/health-profile/synthesis` protected by x402 payment that forces regeneration of holistic health profile synthesis for the authenticated user.

#### Scenario: Unpaid request rejected

- **WHEN** a client calls `POST /api/health-profile/synthesis` without valid x402 payment
- **THEN** the API returns HTTP 402 Payment Required

#### Scenario: Paid refresh succeeds

- **WHEN** a client pays the configured USDC price and calls `POST /api/health-profile/synthesis`
- **THEN** the API returns HTTP 200 with new `synthesis_text`, `generated_at`, and payment metadata
- **AND** `profile_health_synthesis` is updated regardless of prior cache hash

### Requirement: Synthesis refresh price

The synthesis refresh endpoint SHALL use a configurable x402 price defaulting to $0.02 USDC.

#### Scenario: Price in 402 response

- **WHEN** an unpaid synthesis refresh is attempted
- **THEN** the 402 response includes the synthesis refresh price in USDC

### Requirement: First synthesis remains free

Initial holistic synthesis generation on `GET /api/health-profile` when cache is missing or stale SHALL remain free and SHALL NOT require x402 payment.

#### Scenario: Free first load

- **WHEN** a user loads Health Profile with no cached synthesis and structured documents exist
- **THEN** synthesis is generated or returned without payment on GET

### Requirement: Paid refresh UI affordance

The Health Profile page SHALL provide a "Refresh synthesis" control that initiates the paid x402 flow when the user chooses to regenerate.

#### Scenario: User triggers paid refresh

- **WHEN** a signed-in user clicks Refresh synthesis on Health Profile
- **THEN** the client completes x402 payment
- **AND** displays the updated synthesis text on success

### Requirement: Synthesis refresh safety

Paid refresh output SHALL follow the same medical safety rules as free synthesis: educational language, no new diagnoses or treatment plans, mandatory disclaimer.

#### Scenario: Refreshed synthesis includes disclaimer

- **WHEN** paid synthesis refresh completes
- **THEN** the response and UI include "This is not medical advice. Consult a healthcare professional."
