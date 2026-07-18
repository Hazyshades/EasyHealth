## Context

EasyHealth already has the hard parts of an x402 seller in place:

- **Payment core** — `src/lib/x402.ts::withGateway(handler, price, endpoint, options)` handles the full `402 → verify → settle → receipt → response` loop against Arc testnet (`eip155:5042002`, USDC `0x3600…`, Gateway wallet `0x0077…`) via `BatchFacilitatorClient` from `@circle-fin/x402-batching`.
- **Failure recovery** — `src/lib/payment-entitlements.ts` issues a one-time `X-EasyHealth-Entitlement` retry when settlement succeeds but the handler 5xx's (spec `x402-payment-recovery`).
- **LLM layer** — `generateDoctorSummary()` (`src/lib/generate-doctor-summary.ts`) and `generateHolisticSynthesisText(context, …)` (`src/lib/holistic-synthesis.ts`), both single structured calls with medical guardrails baked into the prompts (`src/lib/report-prompts.ts`), returning schemas from `src/lib/schemas/biomarkers.ts` (incl. mandatory `MEDICAL_DISCLAIMER`).
- **Structured context** — `DocumentStructuredContext` (`src/lib/documents/structured-context.ts`) is the container the LLM layer already consumes.

Three constraints block reusing these directly for agent callers:

1. **Identity = cookie.** `withGateway` resolves `profileId` via `getSessionProfileId()` (cookie `eh_profile_id`, `src/lib/auth/session.ts`). A headless agent has no cookie and hits `401`.
2. **Input = pre-uploaded documents.** Existing handlers build context via `buildDocumentStructuredContext(profileId)` reading Supabase. An agent buyer has no pre-loaded PHR.
3. **Price is static per route.** `withGateway(handler, "$0.05", …)` fixes the price before the body is read, so dynamic pricing is impossible.

This design describes how to add an additive `/api/agent/*` surface that removes these three constraints while reusing everything else.

## Goals / Non-Goals

**Goals:**
- Let a headless AI agent discover, price, pay for, and consume a health insight per-call in USDC on Arc, with no cookie and no pre-uploaded data.
- Compute price dynamically from request-body complexity and quote it in the `402`.
- Use the settled `payer` wallet address as the caller identity for agent routes.
- Maximize reuse: no changes to `withGateway`, entitlements, LLM functions, or schemas.
- Persist **no PHI** in stateless mode; on-chain remains payment metadata only.
- Keep the work shippable in ~4 days, split into three phases where Phase 1 alone is demo-viable.

**Non-Goals:**
- Replacing or migrating the existing human-facing routes (`/api/reports`, `/api/upload`, `/api/health-profile/synthesis`).
- Building a real agent reputation/escrow network (ERC-8004) — out of scope for this change.
- Persisting agent-submitted health data or building agent accounts/subscriptions.
- Production KYC, multi-currency, or mainnet settlement.

## Decisions

### D1: Additive `/api/agent/*` surface, not a refactor of existing routes
New stateless routes live under `src/app/api/agent/*`. Existing routes are untouched.
- **Why:** Zero regression risk to the human UI during a time-boxed hackathon; the agent contract (data-in-body) is fundamentally different from the human contract (data-in-profile) and shouldn't be forced into one handler.
- **Alternative considered:** Add a `stateless` flag to existing handlers. Rejected — entangles two identity models and two input models in one code path, higher regression risk.

### D2: `withGatewayDynamic` as a sibling of `withGateway`
Add a new export in `src/lib/x402.ts` that (a) reads and validates the JSON body, (b) calls a `priceFn(body)` to get a quote, (c) builds `PAYMENT-REQUIRED` with that dynamic amount, (d) reuses the exact same `verify`/`settle`/`payment_receipts`/`PAYMENT-RESPONSE` logic as `withGateway`.
- **Why:** Reuses the proven settlement path; isolates the only real new behavior (body-aware quote + wallet identity) behind one function.
- **Alternative considered:** Parameterize `withGateway` with an optional `priceFn`. Viable, but a separate function keeps the static path untouched and easier to reason about. Shared internals can be factored into helpers if trivial.

### D3: Wallet-based identity for agent routes
On agent routes, identity is the settled `payer` address (already available from `settleResult.payer`/`verifyResult.payer`). No `profileId` is required. `payment_receipts.profile_id` is nullable for agent calls (or stores a wallet-derived key).
- **Why:** Agents authenticate by paying; the payer address is a stable, verifiable identity with no session.
- **Trade-off:** Entitlement recovery is currently keyed on `profile_id`. For agent routes, recovery keys on `payer` instead (or is disabled in Phase 1 and enabled in Phase 2). See R3.

### D4: Request body mirrors `DocumentStructuredContext`
The agent `data` field uses the same shape the LLM layer already consumes, validated with Zod (reusing `biomarkerSchema` where possible).
- **Why:** The generation functions accept a context argument, so mirroring the shape means near-zero adaptation. Validation rejects garbage with `400` **before** any `402`/payment.

### D5: Dynamic pricing as a pure function in `src/lib/agent-pricing.ts`
`priceFn(tier, body) → { amountUsdc, breakdown }` computes `base(tier) + perItem·max(0, items−freeQuota) + featureFlags`, capped at `price_max(tier)`. Prices are integers in USDC micro-units to match `buildPaymentRequirements`.
- **Why:** Pure, unit-testable, and the `breakdown` doubles as the "agent decides pricing by complexity" evidence in the `402` body.

### D6: `GET /api/agent/manifest` is free and static-ish
Returns services, tiers, base prices, and JSON schemas (derived from Zod). No payment.
- **Why:** Machine discovery is the entry point of the autonomous buyer loop and the first thing shown in the demo; gating it would break discovery.

### D7: Traction dashboard reads real `payment_receipts`
The seller console aggregates settled receipts (endpoint, tier via endpoint mapping, payer, amount) with Recharts. The buyer fleet demo (`scripts/agent-fleet-demo.ts`) drives **real** testnet settlements so the numbers are genuine, not mocked.
- **Why:** Lepton weighs genuine traction even on testnet; real receipts are defensible, mocked charts are not.

### Phasing
- **Phase 1 — Core rail (demo-viable alone):** `withGatewayDynamic` + wallet identity + `agent-pricing.ts` + stateless `quick-insight` and `clinician-summary` (hero). End-to-end `402 (dynamic quote) → pay → 200` provable via Circle CLI/curl.
- **Phase 2 — Breadth + discovery:** `GET /manifest`, `trend-analysis`, `holistic-synthesis`, full tier/feature-flag pricing, payer-keyed entitlement recovery on agent routes.
- **Phase 3 — Traction + demo:** buyer agent-fleet demo (autonomous tier selection + result-driven escalation) and seller A2A dashboard; record submission video.

## Risks / Trade-offs

- **Wallet-identity vs entitlement recovery keyed on `profile_id`** → Phase 1 keys recovery on `payer` for agent routes, or accepts that a failed agent call simply re-pays (micro amount); Phase 2 formalizes payer-keyed entitlements. Existing human recovery is unchanged.
- **"It's just an LLM wrapper" objection** → Differentiate via dynamic pricing, tier/safety routing, health-domain normalization, and full A2A rail with recovery; demo multi-step autonomous escalation, not a single call.
- **Reading body before payment enables free abuse of validation/LLM** → Only cheap Zod validation runs pre-payment; the LLM call runs strictly **after** `settle()` succeeds. Malformed bodies get `400` with no charge and no model call.
- **Healthcare/regulatory** → Educational-only outputs, mandatory `MEDICAL_DISCLAIMER`, no diagnosis/prescription/risk-score; guardrails already enforced in prompts and output schema.
- **PHI leakage** → Stateless handlers hold data in memory only and persist nothing; `payment_receipts` store payer/amount/tx only; nothing health-related goes on-chain.
- **LLM 5xx mid-demo** → Reuse entitlement recovery so the agent retries free; frame it as a resilience feature in the video.
- **Time pressure (4 days)** → Phase 1 is independently demo-able; Phases 2–3 add score but are not prerequisites for a valid submission.

## Open Questions

- Should `payment_receipts.profile_id` become nullable, or should we synthesize a stable profile row per payer wallet? (Leaning nullable for Phase 1.)
- Do we expose per-tier daily spend hints in the manifest to help buyer wallet-policy checks, or leave budget logic entirely to the buyer?
- Manifest schema format: hand-authored JSON vs generated from Zod via `zod-to-json-schema`? (Leaning generated to avoid drift.)
