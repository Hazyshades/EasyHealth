## Context

EH-119 writes corrections as append-only normalization revisions, EH-116 applies Registry reprocessing through the same active projection, and EH-121 captures each live source fact in `observation_change_events` with source-specific uniqueness. The Biomarkers API and the numeric Health Profile derive their values directly from current observations, while `profile_health_synthesis` is the only persisted dependent output and is overwritten by `upsert`.

`GET /api/health-profile` currently calculates a hash, marks synthesis stale, and then invokes `getOrCreateHolisticSynthesis`, which can regenerate that cache during the same read. This mixes request reads, LLM generation, and invalidation; it cannot expose a durable retry state or preserve an earlier output. There is also no stored Health Profile score version.

## Goals / Non-Goals

**Goals:**

- Admit exactly one dependency event for each committed live EH-121 source event.
- Recalculate and retain immutable numeric Health Profile snapshots from the active observation projection.
- Coalesce bursts safely, lease work to one worker, recover stale claims, and expose retryable failure.
- Preserve prior synthesis output when its input becomes stale; a user-initiated refresh creates a new version instead of overwriting it.
- Make current chart/profile reads explicitly non-cacheable where they derive live data.

**Non-Goals:**

- Changing correction, verification, rejection, supersession, or batch-verification state-machine rules owned by EH-119, EH-120, and EH-122.
- Materializing chart/trend data; those remain projections over the active observation revision.
- Replaying EH-121 backfill history or automatically charging for/generating an LLM synthesis after every change.
- Copying raw document text, values, evidence, or decision traces into queue records, job errors, or assessment audit metadata.

## Decisions

### 1. Derive one private dependency event from each live EH-121 event

Create `assessment_dependency_events` as an append-only, service-role-only outbox. An `AFTER INSERT` trigger on `observation_change_events` inserts one row only when `origin = 'capture'`; `source_change_event_id` is unique. The transaction therefore commits the observation change, its EH-121 audit fact, and its downstream intent together. Backfilled history has no downstream side effect.

The source event is retained by reference, not copied. The outbox carries profile/document identifiers, event kind, occurrence time, and safe version identifiers only.

**Alternative considered:** enqueue from Next.js correction routes. Rejected because registry reprocessing and future EH-120/EH-122 writers would bypass it, and a request failure after a source commit would silently lose downstream work.

### 2. Coalesce per-profile Health Profile work but receipt every source event

Create an updateable `assessment_recalculation_jobs` row per `(profile_id, output_kind)` with `queued`, `processing`, `retryable_failed`, `failed`, or `succeeded` status, lease metadata, attempts, and a high-water dependency event sequence. A trigger/RPC inserts or wakes the `health_profile` job when a dependency event arrives.

A claiming RPC serializes one worker. The worker claims every unreceipted dependency event for that profile, calculates one canonical current snapshot, and writes a receipt for every claimed source event. Multiple committed source events can thus coalesce into one calculation while no event is lost or applied twice.

**Alternative considered:** one job and one version per event. Rejected because a rapid correction/reprocess burst creates redundant scoring and does not improve auditability; event receipts retain the required per-event causal record.

### 3. Version numeric Health Profile outputs immutably

Create `health_profile_assessment_versions` with a canonical input hash, serialized deterministic score payload, source scope, and generation timestamp. A receipt links every consumed dependency event to the version that represents its resulting active projection. A unique `(profile_id, input_hash)` avoids duplicate output versions after a race or retry; a job may receipt a later event against the current version when its effective input is unchanged.

The current version is selected by newest generation. Rows are append-only; service-role grants do not include update/delete. Bootstrap jobs create the first version for profiles with eligible records without synthesizing EH-121 backfill events.

**Alternative considered:** add a version column to the current score response only. Rejected because an incrementing response field cannot recover historical payloads or prove which committed observation change produced a score.

### 4. Canonicalize the worker input and share score logic

Extract the existing Health Profile query/projection and `buildHealthProfile` invocation into a server-safe snapshot builder usable by both the route and the existing TypeScript worker. Order documents and observations with deterministic tie-breakers before hashing. The worker uses the shared builder, so the versioned result exactly matches the live profile contract.

**Alternative considered:** duplicate scoring code in the worker or calculate from SQL. Rejected because it would create a second scoring policy and bypass Registry V2 laboratory eligibility gates.

### 5. Keep synthesis user-triggered, versioned, and explicitly stale

Replace the single mutable `profile_health_synthesis` cache with immutable synthesis versions plus a current/stale read model. An assessment dependency event marks the synthesis stale but does not invoke the model. `POST /api/health-profile/synthesis` creates a new immutable version for the current canonical input and clears stale state atomically. `GET /api/health-profile` never generates text; it returns the latest version and stale status.

This preserves the existing explicit Refresh synthesis UI, prevents a read from generating duplicate text, and keeps the old synthesis auditable until a new one is requested.

### 6. Reuse existing worker reliability patterns

Extend the existing worker poll loop, heartbeat, atomic claim, retry, and stale-claim reclamation rather than deploying another scheduler. Assessment job errors are stored as bounded operational messages/codes, never provider prompts or patient data. A service-role retry RPC moves a terminal/retryable failure back to `queued` without altering historical output versions.

### 7. Live projections use explicit no-store responses

`/api/biomarkers` and the current assessment/status response return `Cache-Control: no-store`. The application already rebuilds chart eligibility from the active revision, so invalidating a separate chart cache would add an inconsistent second truth.

## Data flow

```text
active normalization revision / reprocess apply
  -> EH-121 observation_change_events (capture only)
  -> assessment_dependency_events (unique source event)
  -> health_profile recalculation job (coalesced + leased)
  -> immutable assessment version + per-event receipts
  -> API serves latest successful version and job state

same dependency event
  -> mark current synthesis stale
  -> explicit user refresh
  -> immutable synthesis version
```

## Risks / Trade-offs

- **Worker is unavailable:** the last successful score remains visible and the job exposes retryable/failed status. Stale claim recovery prevents a permanent `processing` state.
- **Out-of-order source events:** the worker scores the latest active projection and receipts all claimed event IDs; chronology is preserved in the EH-121 ledger, not inferred from job execution order.
- **Burst changes:** coalescing reduces work but means an intermediate score need not exist. This is intentional; every event is still linked to the resulting current projection.
- **Existing profiles:** bootstrap jobs delay the first version until a worker processes them. The API retains a clearly marked live fallback only while no version exists.
- **Synthesis storage growth:** immutable text versions grow per user refresh. Versions are profile-scoped and can receive a retention policy later; deletion is not part of EH-123.
- **Dependency ownership:** EH-120/EH-122 may add new event producers. Their source changes automatically enter this design through EH-121 capture; EH-123 must not duplicate their transition rules.