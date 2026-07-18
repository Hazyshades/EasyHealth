## ADDED Requirements

### Requirement: Failed paid requests issue a retry entitlement

When x402 settlement succeeds for a paid endpoint but the route handler responds with HTTP 5xx, the system MUST mark the `payment_receipts` row as `failed`, create exactly one `payment_entitlements` row with `status=available` for the same `profile_id` and `endpoint`, and include `entitlement_id` and `retry_without_payment: true` in the JSON response body.

#### Scenario: Report generation fails after payment

- **WHEN** an authenticated user pays for `POST /api/reports` and settlement succeeds but report generation returns HTTP 500
- **THEN** the response body includes `error` describing the generation failure (not "Payment processing error"), `entitlement_id`, and `retry_without_payment: true`
- **THEN** the linked payment receipt has `status=failed`
- **THEN** exactly one available entitlement exists for that profile and `/api/reports`

#### Scenario: Upload processing fails after payment

- **WHEN** an authenticated user pays for `POST /api/upload` and settlement succeeds but OCR or persistence returns HTTP 500
- **THEN** the response includes a domain-specific error, `entitlement_id`, and `retry_without_payment: true`
- **THEN** the payment receipt is marked `failed` with a matching entitlement for `/api/upload`

### Requirement: Entitled retry does not charge again

The system MUST allow one retry per entitlement by accepting header `X-EasyHealth-Entitlement: <uuid>` instead of `payment-signature`, without calling x402 verify or settle, when the entitlement is valid.

#### Scenario: Successful entitled retry

- **WHEN** the client sends `POST /api/reports` with a valid `X-EasyHealth-Entitlement` header for the same profile and endpoint
- **THEN** no new x402 settlement occurs
- **THEN** the handler runs and on HTTP 2xx the entitlement `status` becomes `redeemed`
- **THEN** no new `payment_receipts` row is created for the retry

#### Scenario: Invalid entitlement rejected

- **WHEN** the client sends an expired, redeemed, wrong-profile, or wrong-endpoint entitlement header
- **THEN** the system returns HTTP 402 with `{ error: "Payment required" }` (standard x402 unpaid response)
- **THEN** no handler business logic executes

### Requirement: Successful paid requests consume receipts

When a paid request completes with HTTP 2xx after settlement, the system MUST set the associated `payment_receipts.status` to `consumed`.

#### Scenario: First-attempt success

- **WHEN** settlement succeeds and the handler returns HTTP 201 or 200
- **THEN** the receipt `status` is `consumed`
- **THEN** no entitlement is created

### Requirement: Payment and handler errors are distinct

The system MUST NOT return `"Payment processing error"` for failures that occur after successful settlement. Payment verification and settlement failures MUST use payment-specific error codes and messages (402 or payment-related 500).

#### Scenario: Handler throws after settlement

- **WHEN** the handler throws or returns 500 after settlement
- **THEN** the HTTP status is 500 with a domain-specific `error` field
- **THEN** the message does not imply payment verification or settlement failure

### Requirement: Client surfaces retry without additional charge

Paid-resource UI flows MUST detect `entitlement_id` in error responses and offer a retry action that calls the same endpoint with `X-EasyHealth-Entitlement` and without invoking `payForResource` again.

#### Scenario: Report create retry button

- **WHEN** report creation fails with `entitlement_id` in the response
- **THEN** the create page shows the error and a control labeled to indicate no extra USDC charge
- **WHEN** the user activates that control
- **THEN** the client retries with the entitlement header and the original request body

#### Scenario: Upload retry button

- **WHEN** upload fails with `entitlement_id` in the response
- **THEN** the upload UI offers retry without additional charge using the same file and entitlement header

### Requirement: Entitlement expiry

Entitlements MUST expire 24 hours after creation. Expired entitlements MUST NOT be redeemable.

#### Scenario: Expired entitlement

- **WHEN** a client attempts retry with an entitlement past `expires_at`
- **THEN** the system returns HTTP 402 requiring a new payment
