## Why

EasyHealth has prepaid Nebius Token Factory credits and needs a production-grade LLM path that is cost-efficient for routine document processing while offering a higher-quality tier for users who want better extraction and reports. Today only OpenAI, DeepSeek, and Owl Alpha are selectable; there is no Nebius integration, no per-stage model routing, and no structured observability for LLM calls beyond `extraction_model` on results.

## What Changes

- Add two user-selectable Nebius tiers on the AI Settings page: **Nebius Fast** (`nebius_fast`) and **Nebius Quality** (`nebius_quality`).
- Integrate Nebius Token Factory via its OpenAI-compatible API with configurable `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`) and optional `NEBIUS_REGION` for documentation/future regional endpoints.
- Route pipeline stages (classify, extract, summarize, reports, holistic synthesis) to **tier-specific model IDs** configured via server env — not a single model per tier.
- Validate configured model IDs at startup against `GET /v1/models`; warn or fail fast if models are missing (environment-dependent).
- Use structured JSON generation (`response_format: json_object`) on classification and extraction, with Zod validation and **one retry on invalid JSON**. (`json_schema` may be enabled per model after QA — deferred.)
- **Fail hard by default** when Nebius vision fails on PHI documents. OpenAI cross-provider vision fallback only when `ALLOW_CROSS_PROVIDER_FALLBACK=true` (explicit dev/org opt-in); every switch logged with `ai_invocations.provider_switch=true`.
- Persist full model IDs in `extraction_model` and document processing metadata.
- Add **`ai_invocations`** table for app-side metadata logging (stage, model, latency, tokens, `provider_switch`) — **no raw PHI, prompts, or responses**.
- Document production prerequisites: Nebius **ZDR** for PHI, BAA if required, **Inference Observability** for ops metrics, and that **Data Lab is dev/eval only** (ZDR disables stored chat completion logs).
- Gate prod default provider cutover behind `Test-Cases-QA.md` runs on OpenAI, `nebius_fast`, and `nebius_quality`.
- Extend `PATCH /api/profile` and DB check constraint to accept `nebius_fast` and `nebius_quality`.

## Capabilities

### New Capabilities

- `nebius-tiered-routing`: Per-stage model resolution, startup catalog validation, opt-in cross-provider fallback, JSON-structured extraction calls.
- `ai-invocation-observability`: App-side `ai_invocations` metadata logging (`provider_switch` included) without persisting raw medical document content.

### Modified Capabilities

- `ai-provider-preference`: Extend provider enum, settings UI, profile API, and worker routing to include `nebius_fast` and `nebius_quality` with availability flags.

## Impact

- **Domain**: `ai-config` (provider selection, model routing); touches `documents` worker pipeline and all LLM entry points.
- **Database**: Migration extending `profiles.ai_provider` check; `ai_invocations` table with RLS.
- **App lib**: `src/lib/ai-provider.ts` — Nebius client, tiered stage routing, catalog validation, invocation logging helper.
- **Worker**: `worker/src/pipeline.ts` — stage routing, fail-hard vision default, opt-in fallback, invocation logging.
- **Env**: `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEBIUS_REGION`, `ALLOW_CROSS_PROVIDER_FALLBACK`, tiered model env vars.
- **Docs**: Update `docs/06-ai/ai-providers.md`, `docs/07-ops/env-vars.md` (ZDR, Data Lab limits, regional URLs as future config).
- **Deferred**: cost dashboard UI, aggregate stage-level confidence, separate synthetic benchmark dataset repo.
- **Unchanged**: x402 pricing; no user API keys; medical safety rules; OpenAI/DeepSeek/Owl Alpha remain available; default profile provider stays `openai` until QA gate passes.
