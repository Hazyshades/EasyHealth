## Why

EasyHealth already ships a working x402 payment rail on Arc, a domain LLM layer (doctor summary, holistic synthesis) with medical-safety guardrails, and paid-failure recovery. But every paid endpoint today assumes a **human** with a browser cookie who has pre-uploaded documents. For the Lepton hackathon (RFB 02 "Selling Agent Services via Nanopayments") the scoring weighs Agentic Sophistication and Traction at 30% each, and our current human-in-the-loop flow scores low on both.

This change reframes EasyHealth as an **agent-facing health-intelligence service**: other AI agents pay per-call in USDC on Arc to buy structured, safe health insights, choosing a quality tier and reacting to a dynamically-quoted price. It monetizes work we can already do, closes the two weak scoring dimensions, and keeps the existing human UI as a seller console.

## What Changes

- Add a stateless `/api/agent/*` endpoint family that accepts health data **in the request body** (no pre-uploaded profile, no cookie) and returns structured JSON insights:
  - `POST /api/agent/quick-insight` — Basic tier, single-biomarker interpretation
  - `POST /api/agent/trend-analysis` — Plus tier, longitudinal trends
  - `POST /api/agent/holistic-synthesis` — Plus tier, cross-domain synthesis
  - `POST /api/agent/clinician-summary` — Pro tier, hero endpoint (clinician-ready summary)
- Add **wallet-based identity** for agent callers: the settled `payer` address is the identity, replacing cookie-based `getSessionProfileId` on agent routes.
- Add a **dynamic pricing engine**: price is computed from request-body complexity (item count, depth, feature flags) and quoted in the `402` response before payment.
- Add a machine-discoverable **service manifest** at `GET /api/agent/manifest` (services, tiers, schemas, base prices) so buyer agents can discover and decide autonomously.
- Add a **seller-side A2A traction dashboard** aggregating `payment_receipts` by endpoint/tier/payer, plus a buyer **agent-fleet demo script** that autonomously selects tiers and escalates.
- Reuse the existing payment core (`withGateway` verify/settle/receipt), entitlement recovery, LLM generation, guardrails, and structured-context schema **without modification**.
- No breaking changes to existing human-facing routes; the new surface is additive under `/api/agent/*`.

## Capabilities

### New Capabilities
- `agent-insight-api`: Stateless, agent-facing paid endpoints that accept health data in the request body and return structured, guardrailed insights across four quality tiers.
- `agent-payment-pricing`: Dynamic per-request pricing (complexity → quote) and wallet-based identity for agent payers, extending the x402 middleware with a body-aware `402` quote.
- `agent-service-discovery`: A machine-readable manifest describing available services, tiers, request/response schemas, and base prices for autonomous buyer agents.
- `agent-traction-dashboard`: A seller console that aggregates real A2A payment volume and tier distribution from settled receipts, fed by an autonomous buyer agent-fleet demo.

### Modified Capabilities
<!-- None. Existing human-facing routes and x402-payment-recovery behavior are unchanged; all new behavior is additive under /api/agent/*. -->

## Impact

- **Code (new)**: `src/app/api/agent/{manifest,quick-insight,trend-analysis,holistic-synthesis,clinician-summary}/route.ts`, `src/lib/agent-pricing.ts`, `scripts/agent-fleet-demo.ts`, a seller dashboard page.
- **Code (extended, additive)**: `src/lib/x402.ts` gains a `withGatewayDynamic` variant that reads the body, computes a quote, and supports wallet identity; no change to existing `withGateway` behavior.
- **Reused as-is**: `src/lib/payment-entitlements.ts`, `src/lib/generate-doctor-summary.ts`, `src/lib/holistic-synthesis.ts`, `src/lib/schemas/biomarkers.ts`, `src/lib/report-prompts.ts`, `DocumentStructuredContext`.
- **Data**: `payment_receipts` reused (payer/amount/tx). Stateless mode persists **no PHI**; on-chain remains payment metadata only.
- **Dependencies**: none new (`@circle-fin/x402-batching`, Vercel AI SDK, Recharts already present).
- **Safety/regulatory**: educational-only outputs, mandatory `MEDICAL_DISCLAIMER`, no diagnosis/prescription, no PHI on-chain — unchanged from project rules.
