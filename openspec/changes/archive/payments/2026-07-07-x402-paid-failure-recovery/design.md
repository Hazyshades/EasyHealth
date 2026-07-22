## Context

`withGateway` in `src/lib/x402.ts` follows a strict sequence: verify payment → settle on-chain → insert `payment_receipts` → run handler. Settlement is irreversible for the hackathon flow; Gateway batched USDC transfers do not support automatic refunds in-app. When `generateObject` or Supabase insert fails (e.g. schema mismatch), the user loses $0.05 and sees `"Payment processing error"`.

Recent report-generation failures demonstrated this gap. A permissive LLM schema reduces failure rate but does not eliminate the paid-without-delivery risk.

## Goals / Non-Goals

**Goals:**

- Guarantee **at least one free retry** per failed paid request on the same endpoint for the authenticated profile.
- Persist auditable linkage: `gateway_tx` → `payment_receipts` → `payment_entitlements`.
- Return **actionable API errors** with `entitlement_id` when retry is available.
- Let the UI **retry without a second `payForResource` call** when holding an entitlement.
- Mark receipts `consumed` only after handler returns 2xx.

**Non-Goals:**

- On-chain USDC refunds or partial credits.
- Unlimited retries (one entitlement per failed settlement).
- Entitlement transfer between profiles or endpoints.
- Changing x402 prices or payment verification rules.
- Idempotent "return existing report" for duplicate submits (separate concern).

## Decisions

### 1. Entitlement model (not on-chain refund)

**Decision:** Add `payment_entitlements` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Sent to client as `entitlement_id` |
| `profile_id` | uuid FK | Owner |
| `endpoint` | text | e.g. `/api/reports` |
| `receipt_id` | uuid FK | Source failed receipt |
| `status` | text | `available` \| `redeemed` \| `expired` |
| `expires_at` | timestamptz | Default `now() + interval '24 hours'` |
| `redeemed_at` | timestamptz nullable | Set on successful retry |
| `created_at` | timestamptz | |

Extend `payment_receipts` with `status text not null default 'settled'` (`settled` \| `consumed` \| `failed`).

**Rationale:** Off-chain credit is fast, hackathon-appropriate, and matches x402 "pay once, deliver value" without building refund infrastructure.

**Alternatives:**

- *Settle after handler success* -rejected; x402 client/facilitator expects settlement before resource delivery in current starter pattern; larger protocol change.
- *Manual support refunds* -rejected; poor demo UX.

### 2. Middleware flow

**Decision:** `withGateway` entry paths:

```
A) Header X-EasyHealth-Entitlement: <uuid>
   → validate: exists, profile match, endpoint match, status=available, not expired
   → run handler (no verify/settle)
   → on 2xx: mark entitlement redeemed, receipt stays failed (already paid)
   → on 5xx: entitlement remains available (same id)

B) Header payment-signature (existing)
   → verify → settle → insert receipt (status=settled)
   → run handler in inner try/catch
   → on 2xx: receipt status=consumed
   → on 5xx: receipt status=failed, insert entitlement, return {
       error: "<domain message>",
       message: "...",
       entitlement_id: "<uuid>",
       retry_without_payment: true
     }
```

Payment verification/settlement errors stay in outer try → 402/500 with payment-specific messages. Handler errors never use `"Payment processing error"`.

**Rationale:** Clear separation of payment vs. business failures; entitlement path reuses same handler signature.

### 3. Entitlement header contract

**Decision:** Custom header `X-EasyHealth-Entitlement` (not reusing `payment-signature`) to avoid facilitator parsing invalid payloads.

Client helper:

```typescript
retryWithEntitlement(url, entitlementId, body?)
```

Sends same method/body as original request plus entitlement header. No `payForResource` / no wallet interaction.

### 4. Client UX

**Decision:**

- **Upload** (`upload-zone.tsx`): on failure response with `entitlement_id`, show error + button "Retry upload (no extra charge)" calling `retryWithEntitlement`.
- **Reports create**: same pattern; preserve form state; on success navigate to report.
- Optional: auto-retry once for transient LLM errors (single automatic call); if still fails, show manual retry button.

**Rationale:** Explicit user consent for retry avoids double LLM cost surprises; auto-retry once improves UX for flaky model output.

### 5. Security constraints

**Decision:**

- Entitlement MUST match session `profile_id` from `getProfileId` option.
- Entitlement MUST match route `endpoint` string exactly.
- One entitlement redeems at most once (`status` transition `available` → `redeemed` in same transaction as success).
- Service role only for entitlement tables (same as receipts).

### 6. Expiry and cleanup

**Decision:** 24-hour TTL. No cron for MVP; expired entitlements rejected at validation (`status` check + `expires_at > now()`). Optional later: nightly job marking expired rows.

## Risks / Trade-offs

- **[Risk] User abandons after failure** → Entitlement expires in 24h; USDC not refunded (document in UI copy).
- **[Risk] Double redemption race** → Mitigation: update entitlement with `WHERE status = 'available'` and check row count.
- **[Risk] Handler succeeds but client disconnects** → Receipt marked consumed; user may not see result -out of scope (existing issue).
- **[Trade-off] No cash refund** → Accept for hackathon; entitlement is the remediation.
- **[Trade-off] Failed upload may retry expensive OCR** → Accept; user already paid once.

## Migration Plan

1. Apply `006_payment_recovery.sql`.
2. Deploy updated `withGateway` and route handlers.
3. Deploy client retry helpers and UI.
4. Rollback: revert code; new tables/columns harmless if unused.

## Open Questions

- None blocking. TTL of 24h is sufficient for demo; adjust via env later if needed.
