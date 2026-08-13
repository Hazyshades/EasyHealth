## ADDED Requirements

### Requirement: Live observation changes create exactly one downstream dependency event
The system SHALL create one append-only assessment dependency event in the same transaction as every EH-121 `observation_change_events` record whose origin is `capture`. The dependency event SHALL uniquely reference its source change event and SHALL contain only profile/document identity, event classification, occurrence metadata, and safe version identifiers. It SHALL NOT duplicate raw document content, raw values, source regions, resolver evidence, or decision traces.

#### Scenario: A correction is promoted
- **WHEN** a corrected normalization revision becomes active and EH-121 records its captured change event
- **THEN** exactly one linked assessment dependency event is committed
- **AND** a rollback commits neither the source event nor the downstream event

#### Scenario: A reprocess result is applied
- **WHEN** Registry reprocessing applies a row and EH-121 records `reprocess_applied`
- **THEN** exactly one linked assessment dependency event is committed

#### Scenario: EH-121 history is backfilled
- **WHEN** an EH-121 event has origin `backfill`
- **THEN** no assessment dependency event is created

### Requirement: Health Profile recalculation is durable, coalesced, and exclusive
The system SHALL queue Health Profile recalculation for profiles with unconsumed dependency events. It SHALL permit at most one active claim for a profile/output kind, coalesce multiple pending events into one current-projection calculation, and persist a receipt for every event that calculation consumes.

#### Scenario: Multiple source changes arrive before a worker claim
- **WHEN** two or more captured dependency events for one profile are pending
- **THEN** one worker calculation may consume them together
- **AND** each source dependency event receives exactly one completion receipt

#### Scenario: Two workers race to claim work
- **WHEN** two workers attempt to claim the same queued profile/output job
- **THEN** at most one receives the claim
- **AND** the losing worker performs no calculation or version write

### Requirement: Recalculated Health Profile outputs are immutable and auditable
The system SHALL persist each distinct effective Health Profile input as an immutable version with profile identity, canonical input hash, deterministic score payload, source scope, and generation metadata. The system SHALL retain prior versions and associate every consumed dependency event with the version representing its resulting projection.

#### Scenario: A changed observation changes the score input
- **WHEN** recalculation observes an input hash different from the latest version
- **THEN** the system creates one new immutable Health Profile version
- **AND** the previous version remains readable for audit

#### Scenario: A retry sees an already-created input version
- **WHEN** a retried or competing calculation obtains an input hash already versioned for that profile
- **THEN** it SHALL reuse that version for event receipts
- **AND** it SHALL NOT create a duplicate version

### Requirement: Assessment jobs recover from failure without hiding a last known good output
The system SHALL record job attempt count, claim lease, operational failure state, and retry eligibility. It SHALL reclaim an expired processing lease, bound automatic retries, and permit an authorized manual retry. A failure SHALL NOT overwrite or delete the latest successful assessment version.

#### Scenario: A worker fails before completion
- **WHEN** a claimed assessment job fails
- **THEN** the job records a safe operational failure message and retry state
- **AND** the API continues to return the latest successful version, if one exists

#### Scenario: A worker claim becomes stale
- **WHEN** a processing job lease expires before completion
- **THEN** the system requeues it when retry attempts remain or marks it failed when the retry limit is exhausted

### Requirement: Health Profile reads do not cause dependent-output generation
The Health Profile API SHALL return the latest successful assessment version, its recalculation status, and an explicit fallback state when an initial version is pending. It SHALL NOT synchronously generate a synthesis or mutate a dependent output during a GET request.

#### Scenario: A stale synthesis exists
- **WHEN** an observation change invalidates the synthesis input
- **THEN** `GET /api/health-profile` returns the latest synthesis version marked stale
- **AND** it does not call a model provider or overwrite that version

#### Scenario: An initial score is pending
- **WHEN** a profile has eligible observations but no completed Health Profile version
- **THEN** the API identifies the assessment as pending while returning the existing live projection as a temporary fallback

### Requirement: Holistic synthesis invalidation preserves prior generated output
The system SHALL mark synthesis stale from a live assessment dependency event. An explicit refresh for the current input SHALL append a synthesis version rather than overwrite historical output, and SHALL clear stale state only after its new version is committed.

#### Scenario: A user refreshes stale synthesis
- **WHEN** the user requests synthesis refresh after a dependent observation change
- **THEN** the system stores a new immutable synthesis version for the current canonical input
- **AND** the earlier synthesis version remains available for audit

### Requirement: Live charts and assessment reads avoid stale HTTP caches
The Biomarkers API and the Health Profile API SHALL emit `Cache-Control: no-store` while their current data is derived from active observation projections or version/job state.

#### Scenario: A correction is committed
- **WHEN** the user reloads Biomarkers or Health Profile after a committed correction
- **THEN** the response is not served from an HTTP cache
- **AND** chart eligibility is projected from the active normalization revision.