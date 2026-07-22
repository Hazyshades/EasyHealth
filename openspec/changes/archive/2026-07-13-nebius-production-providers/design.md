## Context

EasyHealth resolves LLM providers per profile via `src/lib/ai-provider.ts` (app) and `worker/src/ai.ts` (worker). The document pipeline makes multiple `generateText` calls per upload: classification, extraction (text or vision), and summary.

Nebius Token Factory exposes an OpenAI-compatible API with Inference Observability (aggregate ops metrics) and Data Lab (full prompt logs only when ZDR is off). Production medical documents require ZDR, which means Data Lab imports are empty and prompt debugging must use `ai_invocations` + de-identified QA fixtures.

## Goals / Non-Goals

**Goals:**

- Two Nebius provider IDs: `nebius_fast`, `nebius_quality`
- Stage-aware model routing per tier
- Startup `/v1/models` catalog validation
- `json_object` + Zod + one retry on invalid JSON for classify/extract
- Fail-hard Nebius vision default; opt-in cross-provider OpenAI fallback
- `ai_invocations` with `provider_switch` — no PHI in logs
- `NEBIUS_BASE_URL` + `NEBIUS_REGION` config
- QA gate before default provider cutover

**Non-Goals:**

- Removing OpenAI, DeepSeek, or Owl Alpha
- `json_schema` until per-model QA confirms support
- Data Lab in production PHI workflows
- Cost dashboard UI, aggregate stage confidence, synthetic benchmark repo
- Fine-tuning, dedicated endpoints, Helicone/Prometheus setup

## Decisions

### 1. Provider IDs: `nebius_fast` and `nebius_quality`

Flat `ai_provider` enum values (Variant B). Default for new profiles remains `openai` until Test-Cases-QA gate passes on all tiers.

### 2. Stage-aware routing

`resolveModelForStage(provider, stage)` for: `classify`, `extract_text`, `extract_vision`, `summarize`, `report`, `synthesis`.

**Default model mapping (env-overridable; no guaranteed `*-fast` suffix):**

| Stage | `nebius_fast` | `nebius_quality` |
|-------|---------------|------------------|
| `classify` | `Qwen/Qwen3-32B` | `meta-llama/Llama-3.3-70B-Instruct` |
| `extract_text` | `meta-llama/Llama-3.3-70B-Instruct` | `Qwen/Qwen3-235B-A22B-Instruct-2507` |
| `extract_vision` | `Qwen/Qwen2-VL-7B-Instruct` | `Qwen/Qwen2-VL-72B-Instruct` |
| `summarize` | `meta-llama/Llama-3.3-70B-Instruct` | `meta-llama/Llama-3.3-70B-Instruct` |
| `report` | `meta-llama/Llama-3.3-70B-Instruct` | `deepseek-ai/DeepSeek-V3.2` |
| `synthesis` | `meta-llama/Llama-3.3-70B-Instruct` | `deepseek-ai/DeepSeek-V3.2` |

Optional fast flavor: env `NEBIUS_FAST_FLAVOR_SUFFIX=-fast` appends to text models **only if** `GET /v1/models` confirms the suffixed ID exists. Never hardcode suffixed IDs as guaranteed defaults.

### 3. Nebius endpoint config

```typescript
NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1"
NEBIUS_REGION   ?? "eu-north1"  // documentation / future use
```

Regional URLs (`eu-west1`, `us-central1`) documented for future dedicated/regional production config — not assumed unless `NEBIUS_BASE_URL` is explicitly set.

### 4. Startup model catalog validation

On worker startup (and optionally app boot in production):

1. `GET {NEBIUS_BASE_URL}/models?verbose=true` with `NEBIUS_API_KEY`
2. Compare configured model IDs per tier/stage
3. **Production** (`NODE_ENV=production`): fail fast if any configured model missing
4. **Development**: log warning, continue

### 5. Structured output

- Baseline: `response_format: { type: "json_object" }` on classify/extract
- Parse with existing Zod/`parseJsonFromModelText`
- **One retry** on invalid JSON (same model, temperature 0)
- `json_schema` / `guided_json`: note in docs as future per-model enhancement after QA

Temperature: `0` classify/extract; `0.3` summarize/report/synthesis.

### 6. Vision failure: fail-hard default (PHI)

```text
ALLOW_CROSS_PROVIDER_FALLBACK=false  (default)

Nebius vision fails
  → job fails with UI-safe English error
  → ai_invocations: success=false, provider_switch=false

ALLOW_CROSS_PROVIDER_FALLBACK=true  (dev/org opt-in only)

Nebius vision fails
  → retry OpenAI gpt-4o-mini vision once
  → ai_invocations: provider_switch=true on OpenAI row
```

Never silent cross-provider transfer. Document in ops docs.

### 7. Observability stack

| Layer | Use | Prod PHI |
|-------|-----|----------|
| Nebius Inference Observability | Latency, tokens, errors | Yes |
| Data Lab | Full prompts | **No** — dev/eval only; ZDR → empty imports |
| `ai_invocations` | Per doc/stage metadata | Yes — no prompts/responses |
| `Test-Cases-QA.md` | De-identified regression | Yes |

`ai_invocations` columns: `profile_id`, `document_id`, `stage`, `provider`, `model_id`, `latency_ms`, `input_tokens`, `output_tokens`, `success`, `error_code`, `provider_switch` (default false), `created_at`.

Strict rule: **no raw PHI, no raw prompts, no raw model responses** in invocation logs.

Nebius `user` metadata: `easyhealth:{document_id}:{stage}` (no PHI).

### 8. Nebius client

`createOpenAI({ apiKey: NEBIUS_API_KEY, baseURL: NEBIUS_BASE_URL })` — same pattern as DeepSeek.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Nebius vision fails in prod | Fail-hard + clear error; user switches to OpenAI provider or enables opt-in fallback |
| Model ID not in catalog | Startup validation |
| Open models worse JSON than gpt-4o-mini | json_object + retry; Quality tier |
| PHI on Nebius without ZDR | Ops checklist: ZDR + BAA |
| Credits burn on 235B | Fast tier; Quality opt-in |

## Migration Plan

1. Deploy migrations (`profiles` check + `ai_invocations`).
2. Set env vars; enable ZDR on Nebius before real PHI.
3. Run Test-Cases-QA on OpenAI, nebius_fast, nebius_quality.
4. Keep `openai` as default until QA gate passes.
5. Rollback: unset `NEBIUS_API_KEY` → Nebius options unavailable.

## Open Questions

- Exact model IDs from live catalog at apply time.
- Separate Nebius API keys per tier (defer).
