## 1. Worker heartbeat & liveness signal

- [x] 1.1 Add `worker_heartbeats` table (migration): `instance_id text`, `last_seen timestamptz default now()`, keeping a single latest row.
- [x] 1.2 Worker upserts the heartbeat once per `tick()` in `worker/src/index.ts`.
- [x] 1.3 Compute `workerOffline` in the document bootstrap API (`src/app/api/documents/[id]/route.ts`) from heartbeat age vs `LIVENESS_THRESHOLD`, and include it in the payload when the document is `processing`.

## 2. Stale-job reclamation (in-worker)

- [x] 2.1 Add `STALE_JOB_MAX_AGE_MS` config (env) with a 10-minute default.
- [x] 2.2 In `tick()`, add a reclaim pass selecting jobs `status='processing' AND started_at < now() - threshold`.
- [x] 2.3 Requeue (reset `started_at=null`, `status='queued'`) when `attempts < max_attempts`; otherwise call `failJob` with a timeout error.
- [x] 2.4 Add a test that an orphaned `processing` job is reclaimed while a worker is alive.

## 3. Per-document job dedupe

- [x] 3.1 Migration: de-duplicate existing active jobs (keep the latest per document) before adding the index.
- [x] 3.2 Create a unique partial index `ON document_processing_jobs (document_id) WHERE status IN ('queued','processing')` (use `CONCURRENTLY`).
- [x] 3.3 Make `enqueueFullPipelineJob` idempotent: catch the unique violation and no-op / return the existing active job.
- [x] 3.4 Add a defensive guard in `claimJob` to skip documents that already have an active job.

## 4. Deterministic retry policy

- [x] 4.1 Set `attempts: 0` and `max_attempts` (config, default 3) in `enqueueFullPipelineJob` (`src/lib/documents/jobs.ts`).

## 5. Reasoning-model temperature suppression

- [x] 5.1 Add a `supportsTemperature` capability flag to the model/provider registry.
- [x] 5.2 In the AI invocation layer, omit `temperature` for reasoning models and verify no AI SDK unsupported-parameter warning is emitted.

## 6. Frontend: polling timeout & recoverable state

- [x] 6.1 In `document-viewer.tsx` poll effect, track elapsed time; after `POLL_TIMEOUT_MS` (~150s) without a status change, `clearInterval` and set a `stuck` state.
- [x] 6.2 When `stuck` (or `workerOffline` is true while `processing`), render a recoverable banner ("Extraction is taking longer than expected. The processing worker may be offline.") with Retry / Reprocess actions.
- [x] 6.3 Wire Retry to re-enter the poll and Reprocess to the existing reprocess flow.
- [x] 6.4 Verify successful/failed rendering is unchanged; only the stuck path is new.

## 7. Verification

- [x] 7.1 Manual: stop the worker, upload a document, and confirm the offline banner appears instead of an infinite silent spinner.
- [x] 7.2 Manual: restart the worker and confirm stale/queued jobs drain and the document reaches `ready`/`needs_review`.
- [x] 7.3 Confirm AI SDK `temperature` warnings are gone for reasoning-model calls.
