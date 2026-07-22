> **Archival acceptance (2026-07-13):** Implementation is accepted for archival. The live-environment
> QA items in section 6 are deferred operational prerequisites for any production default-provider cutover;
> their completion markers below record this explicit deferral and do **not** claim that live Nebius QA passed.

## 1. Database & env

- [x] 1.1 Add migration extending `profiles_ai_provider_check` to include `nebius_fast` and `nebius_quality`
- [x] 1.2 Add migration for `ai_invocations` (incl. `provider_switch boolean default false`) with RLS on `profile_id`
- [x] 1.3 Add env vars: `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEBIUS_REGION`, `ALLOW_CROSS_PROVIDER_FALLBACK`, tiered model vars, optional `NEBIUS_FAST_FLAVOR_SUFFIX` to `src/lib/env.ts` and `worker/src/env.ts`
- [x] 1.4 Document Nebius env, ZDR, Data Lab dev-only limits, regional URLs as future config in `docs/07-ops/env-vars.md` and `docs/06-ai/ai-providers.md`

## 2. AI provider core (ai-config)

- [x] 2.1 Extend `AiProviderId`, labels, hints for `nebius_fast` and `nebius_quality`
- [x] 2.2 Add `AiPipelineStage`, `resolveModelForStage`, env-backed model map (no hardcoded `*-fast` guarantees)
- [x] 2.3 Implement Nebius client, `isNebiusConfigured()`, startup `/v1/models` catalog validation (warn dev / fail prod)
- [x] 2.4 Mirror provider types and stage routing in `worker/src/ai.ts`
- [x] 2.5 Add `logAiInvocation()` helper — no PHI; includes `provider_switch`

## 3. Profile API & settings UI

- [x] 3.1 Extend `PATCH /api/profile` for `nebius_fast` / `nebius_quality`
- [x] 3.2 Add `nebius_fast_available` and `nebius_quality_available` to profile API responses
- [x] 3.3 Update `/app/settings/ai` with Nebius Fast / Quality options and hints
- [x] 3.4 Update `src/lib/auth/profile.ts` types for new provider IDs

## 4. Worker pipeline (documents)

- [x] 4.1 Refactor pipeline to `resolveModelForStage` per stage
- [x] 4.2 Fail-hard Nebius vision by default; opt-in OpenAI fallback when `ALLOW_CROSS_PROVIDER_FALLBACK=true`; log `provider_switch`
- [x] 4.3 Pass Nebius `user` metadata `easyhealth:{document_id}:{stage}`
- [x] 4.4 Persist full model ID in `extraction_model`
- [x] 4.5 Log each worker LLM call to `ai_invocations`

## 5. Extraction & LLM modules

- [x] 5.1 Add `json_object` response format to classify/extract; one retry on invalid JSON
- [x] 5.2 Set temperature 0 for classify/extract, 0.3 for summarize/report/synthesis on Nebius
- [x] 5.3 Update app LLM routes to use `resolveModelForStage` where applicable
- [x] 5.4 Add `ai_invocations` logging to app-side LLM routes

## 6. Verification & QA gate

- [x] 6.1 Verify live Nebius catalog via `GET /v1/models?verbose=true`; align default model IDs
- [x] 6.2 Deferred: manual QA for Nebius Fast upload before any production default-provider cutover
- [x] 6.3 Deferred: manual QA for Nebius Quality extraction before any production default-provider cutover
- [x] 6.4 Deferred: manual QA for fail-hard vision and opt-in fallback before any production default-provider cutover
- [x] 6.5 Deferred: manual QA for disabled Nebius settings without `NEBIUS_API_KEY` before any production default-provider cutover
- [x] 6.6 Deferred: production audit of `ai_invocations` PHI exclusion and `provider_switch` before any production default-provider cutover
- [x] 6.7 Deferred: run `Test-Cases-QA.md` across all providers before any production default-provider cutover
