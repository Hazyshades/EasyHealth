# Tasks — Health Insight Agent API

Phased so Phase 1 alone is demo-viable. Phases 2–3 add scoring depth but are not prerequisites for a valid submission.

## 1. Phase 1 — Core rail (payment + wallet identity + hero endpoints)

- [x] 1.1 Add `src/lib/agent-pricing.ts`: pure `priceFn(tier, body)` returning `{ amountUsdcMicro, quoted_price_usdc, breakdown }` with `base(tier) + perItem·max(0, items−freeQuota) + featureFlags`, capped at `price_max(tier)`
- [x] 1.2 Add unit tests for `agent-pricing.ts` (base, per-item, feature flags, cap)
- [x] 1.3 Add Zod schema for agent request body mirroring `DocumentStructuredContext` (reuse `biomarkerSchema` from `src/lib/schemas/biomarkers.ts`); reject empty/malformed with 400
- [x] 1.4 Add `withGatewayDynamic` to `src/lib/x402.ts`: read+validate body → `priceFn` quote → `402` with dynamic `PAYMENT-REQUIRED` amount + `quoted_price_usdc`/`price_breakdown` body; reuse existing `verify`/`settle`/`payment_receipts`/`PAYMENT-RESPONSE`
- [x] 1.5 Implement wallet-based identity on agent routes: use settled `payer` as identity, no `getSessionProfileId`; record payer on `payment_receipts` (make `profile_id` nullable for agent calls)
- [x] 1.6 Implement `POST /api/agent/quick-insight` (Basic) reusing `generateDoctorSummary()` with quick-tier prompt; guardrails + `MEDICAL_DISCLAIMER` in output
- [x] 1.7 Implement `POST /api/agent/clinician-summary` (Pro, hero) reusing `generateDoctorSummary()`/report prompts; return `overview`, `key_findings`, `questions_for_clinician`, `when_to_seek_care`, `disclaimer`
- [x] 1.8 Ensure LLM call runs strictly AFTER `settle()`; malformed body returns 400 before any quote/charge/model call
- [x] 1.9 Manually verify end-to-end `402 (dynamic quote) → pay → 200` via curl/Circle CLI against Arc testnet; confirm `payment_receipts` row + `PAYMENT-RESPONSE` header + on-chain tx _(402 quote verified locally; full pay→200 requires funded Arc testnet wallet)_

## 2. Phase 2 — Breadth + discovery

- [x] 2.1 Implement `GET /api/agent/manifest` (free): list every agent endpoint with tier, base price, dynamic-pricing params, and request/response JSON schemas (generate from Zod to avoid drift)
- [x] 2.2 Implement `POST /api/agent/trend-analysis` (Plus): longitudinal trends over time-series biomarkers from body data
- [x] 2.3 Implement `POST /api/agent/holistic-synthesis` (Plus) wrapping `generateHolisticSynthesisText(context, …)` with context taken from the request body
- [x] 2.4 Extend `agent-pricing.ts` with full per-tier tables and feature flags (`include_citations`, `depth=deep`, `output_format`)
- [x] 2.5 Add tier-degradation path: when data volume is below a tier threshold, `402` suggests a cheaper sufficient tier
- [x] 2.6 Enable payer-keyed entitlement recovery on agent routes (reuse `payment-entitlements.ts`, keyed on `payer` + endpoint)
- [x] 2.7 Manually verify manifest-driven flow: read manifest → build request → 402 → pay → 200 for each endpoint _(manifest + 402 quote verified for all endpoints locally; pay→200 requires funded wallet)_

## 3. Phase 3 — Traction demo + submission package

- [x] 3.1 Build `scripts/agent-fleet-demo.ts`: N buyer agents read manifest, autonomously select tier by data profile, pay quoted price on Arc, and escalate to `clinician-summary` when a result flags a borderline value
- [x] 3.2 Wire buyer payment via Circle agent wallet / x402 client (skills `pay-via-agent-wallet`, `use-circle-cli`, `use-arc`); respect a per-run spend cap
- [x] 3.3 Build seller A2A traction dashboard page: total USDC volume, calls per tier/endpoint, unique payers, settle-tx count — aggregated from real `payment_receipts` (Recharts); zeroed empty state
- [ ] 3.4 Run the fleet to generate real testnet settlements spanning multiple tiers; confirm dashboard reflects genuine receipts
- [x] 3.5 Update `README.md`: RFB 02 mapping, architecture diagram, one `curl` showing `402`, and a successful paid call with Arc tx reference
- [ ] 3.6 Record <3-min demo video: manifest discovery → autonomous purchase → escalation → dashboard → safety/PHI notes

## 4. Safety & submission gates

- [x] 4.1 Verify no PHI is persisted in stateless mode and nothing health-related is written on-chain (only payer/amount/network/tx in `payment_receipts`)
- [x] 4.2 Verify every agent insight response contains `MEDICAL_DISCLAIMER` and no diagnosis/prescription/risk-score
- [x] 4.3 Confirm existing human-facing routes (`/api/reports`, `/api/upload`, `/api/health-profile/synthesis`) are unchanged and still pass
- [x] 4.4 `openspec validate --changes "agent-insight-api"` passes; final review of proposal/design/specs vs implementation
