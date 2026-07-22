## Why

When the background document-processing worker is not running (not started, not deployed, or crashed mid-run), the document viewer silently hangs on **"Extraction in progress…"** forever. The frontend polls `GET /api/documents/:id?page=N` every 8s with no upper bound because `documents.processing_status` stays `"processing"` and queued jobs in `document_processing_jobs` are never claimed. There is no worker-liveness signal, no stale-job reclamation, and no client-side timeout, so the failure presents exactly like a loading bug and wastes debugging time. This has already recurred in practice (papercut `pc_b3ae6ffb01b9`).

## What Changes

- **Worker-liveness detection + stale-job reclamation**: a job stuck in `processing` beyond a threshold (or absence of worker heartbeats) is surfaced and/or auto-failed/requeued instead of hanging forever.
- **Per-document job dedupe**: at most one active/queued job per document, to avoid redundant LLM extraction cost on retries (observed: 5 queued jobs for a single document after a backlog).
- **Deterministic `max_attempts` on enqueue**: `enqueueFullPipelineJob` currently omits `attempts`/`max_attempts`, making retry/fail logic depend on fragile DB column defaults.
- **Stop sending `temperature` to reasoning models**: the pipeline unconditionally passes `temperature`, which reasoning models reject (AI SDK warning spam on every LLM call, wasted round-trips).
- **Surface worker-down / stuck-processing in the UI**: a recoverable banner + state in the document viewer instead of an infinite spinner.
- **Client-side polling timeout**: after ~2–3 min without a status change, the viewer stops the 8s poll and shows a recoverable state with Retry/Reprocess.

## Capabilities

### New Capabilities

- `document-worker-reliability`: backend hardening — worker-liveness detection, stale-job reclamation (threshold + auto-fail/requeue), per-document job dedupe, deterministic `max_attempts` on enqueue, and suppression of unsupported `temperature` for reasoning models.

### Modified Capabilities

- `document-viewer`: the viewer must stop polling and present a recoverable state (with Retry/Reprocess and an offline/stuck banner) when processing exceeds a timeout, instead of polling forever.
