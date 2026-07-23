## Why

EH-105 publishes a replacement instrumental snapshot before summary generation and document/job completion, so a later failure can leave a failed job with the new snapshot current and the previous snapshot superseded. The completed EH-105 tasks 2.5 and 4.3 therefore do not match runtime behavior, and production release must remain blocked until publication and completion share one atomic commit.

## What Changes

- Separate immutable instrumental snapshot content from publication attempts/history and the document's current-publication pointer.
- Introduce an inactive prepared publication that owns versioned findings and impression; normal readers continue to see only the previous current publication.
- Generate summary outside the database for one exact immutable `prepared_snapshot_id`, canonicalization version, and snapshot hash.
- Finalize publication in one transaction that validates ownership and the active job, publishes measures/findings/impression/summary, supersedes the prior publication, advances the current pointer, completes the document/job, and invalidates synthesis.
- Define same-hash behavior for `PREPARED`, `CURRENT`, `SUPERSEDED`, and `ABANDONED`, including `A → B → A`, exact retry, stale worker, and concurrent finalizer cases.
- Define a versioned canonical payload and hash algorithm, with database-side canonicalization/digest verification and exact-payload conflict rejection.
- Add populated-database preflight/backfill for existing EH-105 snapshots, a current-reader cutover, service-only grants, ownership guards, and a deterministic lock order shared with durable deletion.
- Add orphan-prepared cleanup that cannot remove content or publication history still eligible for retry or audit.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `instrumental-observations`: Replace publish-on-materialize behavior with immutable snapshot content plus versioned, atomic publication history.
- `document-processing`: Make instrumental publication, findings/impression visibility, summary attachment, and final document/job status one commit boundary.
- `document-worker-reliability`: Define stale, retry, orphan-cleanup, and real two-session concurrency behavior for prepared publications.
- `document-structured-insights`: Bind instrumental findings, impression, and summary visibility to the exact current publication.

## Impact

- **Domain:** documents.
- **Database:** additive snapshot-content, publication-history/current-pointer, preparation, hash-version, and cleanup metadata; populated backfill and later legacy-path retirement.
- **Worker:** extraction prepares an inactive version, summarizes it, then invokes one service-only finalizer.
- **Readers:** cut over from row-level `is_current` inference to the authoritative current-publication pointer.
- **Delivery:** may be designed in parallel with the FK hotfix but must merge before durable deletion and before Sprint 1 production closure.
- **Verification:** pgTAP, worker integration, populated migration fixtures, two-session concurrency tests, role/grant negatives, and failure injection at every finalizer step.
