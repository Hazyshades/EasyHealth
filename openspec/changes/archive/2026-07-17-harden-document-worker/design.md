## Context

The document-processing worker (`worker/`) is a separate Node process. It polls `document_processing_jobs` every `WORKER_POLL_INTERVAL_MS` (default 5000ms), claims `queued` jobs via an atomic `status:"queued" → "processing"` update (`claimJob`), and runs `runPipeline`. On success the document becomes `ready`/`needs_review` and the job `completed`; on a controlled failure `failJob` sets both to `failed`; on an uncaught throw `processJob` either requeues (`queued`) or fails after `max_attempts`.

Observed gaps (from the `e93c1489…` silent-hang incident, papercut `pc_b3ae6ffb01b9`):

1. **No liveness/heartbeat.** If the worker is not running or crashes mid-run, a `processing` job is orphaned forever — `claimJob` only selects `status:"queued"`, so nothing ever reclaims it and the document hangs in `processing`.
2. **`enqueueFullPipelineJob` omits `attempts`/`max_attempts`**, so retry/fail logic depends on fragile DB column defaults.
3. **`temperature` is sent to reasoning models**, which reject it (AI SDK warning on every LLM call, wasted round-trips).
4. **No per-document job dedupe** — a backlog produced 5 queued jobs for one document (retry duplication → redundant LLM spend).
5. **Frontend polls forever** (`document-viewer.tsx:359-365`) with no timeout, so a stuck backend looks like a loading bug.

## Goals / Non-Goals

**Goals:**
- Make worker-down / stuck-processing self-diagnosing (backend signal + UI surfacing).
- Reclaim orphaned/stale jobs so documents do not hang.
- Avoid redundant LLM cost (dedupe) and log noise (`temperature`).
- Make the retry policy deterministic.
- Stop the frontend from polling indefinitely; offer a recoverable state.

**Non-Goals:**
- Rewriting the extraction pipeline or the OCR/LLM stages.
- Multi-worker scaling/fencing beyond the MVP (README mandates a single instance).
- Introducing a new job-queue system — stay on the existing Postgres polling model.

## Decisions

### D1 — Stale-job reclamation + worker liveness via heartbeat (in-worker, no new service)
- Add a lightweight `worker_heartbeats` table (single/latest row: `instance_id`, `last_seen timestamptz`). The worker upserts it once per `tick()`.
- **Reclaim** runs inside `tick()` as a cheap extra pass (no new infra): select jobs `status='processing' AND started_at < now() - STALE_JOB_MAX_AGE_MS` (e.g. 10 min). For each: if `attempts < max_attempts` → requeue (`status='queued'`, `started_at=null`); else → `failJob` with a timeout error. This repairs orphaned `processing` jobs whenever *any* worker is alive.
- **Liveness signal** for the UI: a new `workerOffline` flag computed from heartbeat age (`now() - last_seen > LIVENESS_THRESHOLD`, e.g. `2 * pollIntervalMs + slack`). Exposed on the document bootstrap payload when the doc is `processing`.
- *Alternative considered:* a Supabase cron for reclamation. Rejected as primary (new infra, separate scheduling) but noted as an optional safety net if the worker itself is fully down and `queued` jobs accumulate — the cron could at least flip very-old `queued` jobs to a visible `failed`/notify state. For MVP, in-worker reclamation + heartbeat covers the realistic failure modes.

### D2 — Per-document job dedupe via unique partial index
- Add `CREATE UNIQUE INDEX ... ON document_processing_jobs (document_id) WHERE status IN ('queued','processing')`. This is race-free and authoritative.
- Make `enqueueFullPipelineJob` idempotent: catch the unique violation and no-op (or return the existing active job) instead of erroring.
- Add a defensive guard in `claimJob` to skip documents that already have an active job.
- *Alternative considered:* check-then-insert in app code — rejected (TOCTOU race under concurrency).
- *Migration note:* pre-existing duplicate active rows must be de-duplicated before/while creating the index (create `CONCURRENTLY` after cleanup).

### D3 — Deterministic `max_attempts` on enqueue
- `enqueueFullPipelineJob` sets `attempts: 0, max_attempts: <config, default 3>`. Makes `processJob`'s `job.attempts >= job.max_attempts` comparison deterministic regardless of DB defaults.

### D4 — Suppress unsupported params for reasoning models
- Add a `supportsTemperature` (or model-capability) flag resolved from the provider/model registry. The AI invocation layer omits `temperature` when the resolved model is a reasoning model. Removes the AI SDK warning and avoids rejected/retried calls.

### D5 — Frontend polling timeout + recoverable state
- In the `document-viewer.tsx` poll effect, track elapsed time since entering `processing`. After `POLL_TIMEOUT_MS` (≈150s, ~2.5 min) without a status change, `clearInterval` and set a local `stuck` state.
- When `stuck` (or `workerOffline` is true while `processing`): show a banner — *"Extraction is taking longer than expected. The processing worker may be offline."* — with **Retry** (re-enter poll) and **Reprocess** (existing flow).
- Keep the existing 8s interval; add only the cap + `stuck` state. No change to successful/failed rendering.

## Risks / Trade-offs

- **Heartbeat table** adds one tiny table + one upsert per tick (negligible). Single worker instance (per README) avoids fencing; with multiple workers, latest-wins heartbeat is fine for liveness, but reclaim could double-act — keep one instance for MVP.
- **Auto-requeue loops** if the pipeline consistently hangs (e.g. a model that never returns). Mitigated by `max_attempts` → eventual auto-fail. Recommended companion work (separate task): add a network timeout to `runPipeline` LLM calls so jobs fail fast instead of hanging.
- **Unique partial index** requires handling pre-existing duplicates (migration note in D2).
- **Poll timeout (2–3 min)** is a heuristic: too short annoys on slow-but-healthy extractions (typical LLM extraction is 10–60s), too long delays the signal. 150s balances this.
