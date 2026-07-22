## Why

Paid endpoints (`POST /api/upload`, `POST /api/reports`) settle USDC via x402 **before** business logic runs. If OCR, LLM generation, or persistence fails afterward, the user is charged but receives no value. The current `withGateway` wrapper also mislabels handler failures as `"Payment processing error"`, which hides the real cause and blocks recovery.

## What Changes

- Introduce **payment entitlements**: when settlement succeeds but the handler returns a server error, the system issues a one-time retry credit for the same endpoint and profile (no second charge).
- Extend `payment_receipts` with **outcome status** (`settled`, `consumed`, `failed`) and link failed receipts to entitlements.
- Refactor `withGateway` to:
  - Accept an optional `X-EasyHealth-Entitlement` header instead of `payment-signature` for entitled retries.
  - Return accurate error types (`Report generation failed`, `Upload processing failed`, etc.) instead of generic payment errors.
  - Include `entitlement_id` in 5xx responses when a retry credit was created.
- Update **client pay flows** (`payForResource` callers) to retry automatically or show a "Retry without additional charge" action when an entitlement is returned.
- Apply recovery to **all paid endpoints** (`/api/upload`, `/api/reports`); `/api/doctor-summary` if still present.

## Capabilities

### New Capabilities

- `x402-payment-recovery`: Entitlement issuance, retry without re-payment, receipt status tracking, and client/server error contract for post-settlement failures.

### Modified Capabilities

<!-- Cross-cutting middleware change; no existing main-spec capability requirement deltas -->

## Impact

- **Database**: Migration `006_payment_recovery.sql` -`payment_receipts.status`, new `payment_entitlements` table.
- **API middleware**: `src/lib/x402.ts` -entitlement check, receipt lifecycle, error shaping.
- **Paid routes**: `src/app/api/upload/route.ts`, `src/app/api/reports/route.ts` -rely on updated middleware; handlers keep domain-specific error messages.
- **Client**: `src/lib/payments/gateway-client.ts`, `src/components/upload-zone.tsx`, `src/app/app/reports/create/page.tsx` -entitlement retry UX.
- **Unchanged**: x402 prices ($0.01 upload, $0.05 reports), Arc Network settlement, no PHI on-chain, no automatic on-chain refunds.
