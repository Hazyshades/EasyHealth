## Why

Corrections, verification changes, and Registry reprocessing update the active observation projection, but no durable downstream workflow records, recalculates, retries, or audits the dependent Health Profile output. The only persistent dependent output, holistic synthesis, is overwritten in place and can be regenerated as a side effect of a read, leaving no prior output version or failure visibility.

## What Changes

- Add a durable assessment dependency event/outbox derived transactionally from live EH-121 observation change events without replaying historical backfill events.
- Add a coalescing, lease-claimed recalculation job workflow with bounded retries, stale-claim recovery, observable failure state, and manual retry.
- Persist immutable, version-stamped Health Profile assessment snapshots linked to their canonical input and consumed source events; retain previous snapshots for audit.
- Move dependent-output regeneration out of `GET /api/health-profile`; expose the latest successful assessment and recalculation state instead.
- Preserve live chart/trend projection from active observations and make its no-cache delivery contract explicit.
- Version and invalidate holistic synthesis through the same dependency workflow while preserving prior output history.
- Add focused database, worker, API, and QA coverage for exactly-once admission, coalescing, concurrency, retries, and version auditability.

## Capabilities

### New Capabilities
- `assessment-recalculation`: Durable invalidation, recalculation, retry, and immutable versioning for dependent Health Profile outputs.

### Modified Capabilities
- None.

## Impact

- **Domain:** `health-profile`.
- **Database:** new immutable dependency-event, job, and assessment-version records; transactional trigger/RPC contracts; migrations and pgTAP coverage.
- **Worker:** extend the existing polling/claim/heartbeat/reclaim model with assessment recalculation processing.
- **APIs/UI:** Health Profile returns version and job state; explicit retry/status behavior replaces GET-time synthesis generation. Biomarker/chart reads remain projection-based.
- **Dependencies:** consume the existing EH-121 ledger. EH-120 and EH-122 continue to own future verification and batch-verification transition semantics; their live ledger events will use this downstream path.
- **Safety:** no raw document content is copied into dependency events or job errors; historic outputs remain profile-scoped and immutable.