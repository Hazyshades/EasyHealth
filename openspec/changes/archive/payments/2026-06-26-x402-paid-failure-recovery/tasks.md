## 1. Database

- [x] 1.1 Add migration `006_payment_recovery.sql`: `payment_receipts.status` (`settled` | `consumed` | `failed`, default `settled`)
- [x] 1.2 Create `payment_entitlements` table with FK to `payment_receipts` and `profiles`, indexes on `(profile_id, endpoint, status)`
- [x] 1.3 Enable RLS + service_role policy on `payment_entitlements` (match `payment_receipts` pattern)

## 2. Entitlement library

- [x] 2.1 Add `src/lib/payment-entitlements.ts` with `createEntitlement`, `validateEntitlement`, `redeemEntitlement` helpers
- [x] 2.2 Add `markReceiptConsumed` / `markReceiptFailed` helpers updating `payment_receipts.status`
- [x] 2.3 Export shared types: `EntitlementRetryResponse`, header constant `X-EasyHealth-Entitlement` (via `payment-entitlement-contract.ts`)

## 3. x402 middleware refactor

- [x] 3.1 Refactor `withGateway` to branch on `X-EasyHealth-Entitlement` before payment-signature flow
- [x] 3.2 Wrap handler execution: on 2xx after payment → `consumed`; on 5xx → `failed` + create entitlement + attach `entitlement_id` to JSON body
- [x] 3.3 Split try/catch: payment verify/settle errors vs handler errors (no `"Payment processing error"` for post-settlement failures)
- [x] 3.4 Entitlement retry path: validate → run handler → redeem on 2xx; return 402 if invalid/expired

## 4. Paid route handlers

- [x] 4.1 Ensure `POST /api/reports` returns domain error JSON on generation failure (already partially done; align with entitlement response shape)
- [x] 4.2 Ensure `POST /api/upload` returns domain error JSON on OCR/persistence failure with same entitlement fields
- [x] 4.3 Verify `/api/doctor-summary` uses `withGateway` and benefits from middleware (skip if route removed)

## 5. Client payment helpers

- [x] 5.1 Add `retryWithEntitlement(url, entitlementId, options)` in `gateway-client.ts` (same method/body, entitlement header, no `payForResource`)
- [x] 5.2 Parse `entitlement_id` and `retry_without_payment` from error responses in a small shared helper

## 6. UI retry flows

- [x] 6.1 `src/app/app/reports/create/page.tsx`: on failure with entitlement, show "Retry without additional charge" using `retryWithEntitlement`
- [x] 6.2 `src/components/upload-zone.tsx`: same retry UX preserving selected file
- [x] 6.3 Optional: one automatic entitled retry on transient failure before showing manual button

## 7. Verification

- [ ] 7.1 Manual test: force report generation failure → confirm receipt `failed`, entitlement created, retry succeeds without second payment
- [ ] 7.2 Manual test: successful first attempt → receipt `consumed`, no entitlement
- [ ] 7.3 Manual test: expired or wrong-profile entitlement → 402 payment required
