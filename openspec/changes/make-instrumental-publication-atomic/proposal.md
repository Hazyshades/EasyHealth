## Why

EH-105 publishes a replacement instrumental snapshot before summary generation and document/job completion, so a later failure can leave a failed job with the new snapshot current and the previous snapshot superseded. The completed EH-105 tasks 2.5 and 4.3 therefore do not match runtime behavior, and production release must remain blocked until publication and completion share one atomic commit.

## What Changes

- Separate immutable instrumental snapshot content from publication attempts/history and the document's current-publication pointer.
- Introduce an inactive prepared publication that owns versioned findings and impression; normal readers continue to see only the previous current publication.
- Add a current-only `document_extracted_findings` compatibility relation with the existing reader shape while immutable versioned findings move behind the publication pointer, so old readers cannot mix historical accepted rows during rollout.
- Generate summary outside the database for one exact immutable `prepared_snapshot_id`, canonicalization version, and snapshot hash.
- Finalize publication in one transaction that validates ownership and the active processing attempt, publishes measures/findings/impression/summary, supersedes the prior publication, advances the current pointer, completes the document/job, and invalidates synthesis.
- Introduce the shared processing-attempt foundation: `documents.write_generation` with legacy value `0`, retained per-claim `document_processing_attempts`, and an atomic claim RPC. Prepare/finalize bind to `processing_attempt_id + write_generation`; durable deletion later extends the same attempts with lease token, expiry, heartbeat, cancellation, and storage intents.
- Define same-hash behavior for `PREPARED`, `CURRENT`, `SUPERSEDED`, and `ABANDONED`, including `A → B → A`, exact retry, stale worker, and concurrent finalizer cases.
- Define a versioned canonical payload and hash algorithm, with database-side canonicalization/digest verification and exact-payload conflict rejection.
- Add populated-database preflight/backfill for existing EH-105 snapshots, findings, summaries, and attempt/generation state; add service-only grants, ownership guards, and a deterministic lock order shared with durable deletion.
- Add orphan-prepared cleanup that cannot remove content or publication history still eligible for retry or audit.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `instrumental-observations`: Replace publish-on-materialize behavior with immutable snapshot content plus versioned, atomic publication history.
- `document-processing`: Make instrumental publication, findings/impression visibility, summary attachment, and final document/job status one commit boundary while defining the generation-0 processing-attempt foundation.
- `document-worker-reliability`: Define atomic claim, stale-attempt fencing, retry, orphan cleanup, and real two-session concurrency behavior for prepared publications.
- `document-structured-insights`: Bind instrumental findings, impression, and summary visibility to the exact current publication while preserving a current-only legacy reader relation during cutover.

## Impact

- **Domain:** documents.
- **Database:** additive snapshot-content, publication-history/current-pointer, processing-attempt, generation-0, preparation, hash-version, compatibility-view, and cleanup metadata; populated backfill and later legacy-path retirement.
- **Worker:** claim creates a unique processing attempt; extraction prepares an inactive version, summarizes it, then invokes one service-only finalizer.
- **Readers:** existing findings readers remain safe through a current-only compatibility relation, then cut over to the authoritative current-publication pointer.
- **Dependency ownership:** this change owns `processing_attempt_id` and base `write_generation`; durable deletion extends the same contract rather than creating a second lease model.
- **Delivery:** may be designed in parallel with the FK hotfix but must merge before durable deletion and before Sprint 1 production closure.
- **Verification:** pgTAP, worker integration, populated migration fixtures, two-session concurrency tests, role/grant negatives, compatibility-reader tests, and failure injection at every finalizer step.
