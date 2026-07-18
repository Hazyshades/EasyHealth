## ADDED Requirements

### Requirement: Dynamic price computed from request complexity

The system SHALL compute the price of an agent insight request from the request body using a deterministic pricing function, combining a tier base price, a per-item component beyond a free quota, and feature-flag surcharges, capped at a per-tier maximum. The computed amount SHALL be expressed in USDC micro-units consistent with the x402 payment requirements.

#### Scenario: Base price for minimal request

- **WHEN** a caller requests a tier with item count at or below the free quota and no feature flags
- **THEN** the quoted price equals the tier base price

#### Scenario: Per-item and feature surcharges applied

- **WHEN** a caller requests a tier with item count above the free quota and feature flags enabled (e.g. `include_citations`, `depth=deep`)
- **THEN** the quoted price equals base plus per-item surcharge plus feature surcharges
- **THEN** the quoted price never exceeds the tier maximum

### Requirement: Dynamic quote returned in the 402 response

When an agent insight request arrives without a valid payment, the system SHALL return HTTP 402 with a `PAYMENT-REQUIRED` header whose `accepts[]` amount equals the dynamically computed price, and SHALL include a human/agent-readable `quoted_price_usdc` and `price_breakdown` in the response body.

#### Scenario: Unpaid request receives dynamic quote

- **WHEN** a caller sends a valid agent request body without a `payment-signature`
- **THEN** the system returns HTTP 402
- **THEN** the `PAYMENT-REQUIRED` header amount matches the pricing function output for that body
- **THEN** the body includes `quoted_price_usdc` and a `price_breakdown` object

#### Scenario: Payment for quoted amount settles and serves

- **WHEN** the caller retries with a `payment-signature` authorizing the quoted amount
- **THEN** the system verifies and settles the payment via the batch facilitator on Arc
- **THEN** a `payment_receipts` row is created and the insight is returned with a `PAYMENT-RESPONSE` header

### Requirement: Wallet-based identity for agent callers

On agent endpoints, the system SHALL use the settled payer wallet address as the caller identity and SHALL NOT require a cookie-based profile session. Payment receipts for agent calls SHALL record the payer address.

#### Scenario: Payer address recorded as identity

- **WHEN** an agent call settles successfully
- **THEN** the `payment_receipts` row records the payer wallet address
- **THEN** no cookie-based profile session is required for the call to succeed
