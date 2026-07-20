## ADDED Requirements

### Requirement: Each Registry 2.0 write is one service-only database transaction

For every accepted laboratory extracted row, manual correction, or undo, the trusted server SHALL invoke one service-only database writer that commits the normalization revision, extracted review snapshot, source-identified observation, V2 activation/projection, and extracted acceptance status in one PostgreSQL transaction. The writer SHALL lock and validate the extracted source, profile, document, current snapshot/version, target observation, and expected active revision before mutation. A failure in any step MUST roll back every mutation made for that row.

The application resolver MAY compute a candidate before the RPC call, but the writer MUST reject a candidate whose supplied source snapshot/version no longer matches the locked extracted row.

#### Scenario: Incomplete accepted source commits complete lineage

- **WHEN** an authenticated owner accepts a current extracted result whose resolver outcome is `partial`
- **THEN** one transaction creates a `pending` normalization revision, source-identified observation, active revision link, and synchronized `partial` observation projection
- **AND** the observation has no fabricated concrete measurement-definition identity

#### Scenario: Observation persistence fails after candidate preparation

- **WHEN** the database writer cannot insert or upsert the observation for a candidate
- **THEN** it rolls back the new revision and extracted snapshot/status update
- **AND** no half-linked accepted observation is committed

#### Scenario: Source changes before the writer locks it

- **WHEN** the extracted row becomes non-current or its validated source snapshot changes after the server resolved it
- **THEN** the writer returns `source_changed`
- **AND** it does not create a revision or mutate an observation

### Requirement: Active revision state follows resolver and verification invariants

The transactional writer SHALL activate exactly one revision through the EH-104 V2 primitive for every accepted source row. Ordinary user acceptance SHALL map `resolved` with a reviewed concrete definition to `user_verified`. Ordinary raw acceptance of `partial`, `ambiguous`, `unmapped`, or a resolved non-reviewed definition SHALL map to `pending`. A compatible manual correction or undo SHALL map to `manually_corrected`.

An active `pending` revision SHALL be authoritative for the accepted observation. `pending` MUST have null verification-decision metadata and MUST NOT be treated as an inactive candidate. This change MUST NOT introduce `auto_verified` activation.

#### Scenario: Ambiguous result is accepted without verification

- **WHEN** a user accepts an ambiguous raw result
- **THEN** the active revision has `resolver_result = ambiguous` and `verification_status = pending`
- **AND** the observation projection has null concrete measurement-definition identity

#### Scenario: Resolved provisional definition is accepted defensively

- **WHEN** a resolver returns a concrete definition that is not reviewed and the user performs ordinary acceptance
- **THEN** the writer persists an active `pending` revision rather than `user_verified`
- **AND** no definition-specific assessment input is admitted by this write

### Requirement: Selected acceptance returns a result for every requested row

`POST /api/documents/:id/biomarkers/accept` SHALL retain its `ids[]` request shape and process each selected source row through an independent per-row transaction. After valid authentication and document ownership checks, its response SHALL contain one result for every requested id with `extractedBiomarkerId`, `outcome`, and stable `code`; successful results SHALL also identify the observation and revision when available.

`outcome` SHALL distinguish `accepted`, `already_active`, and `failed`. Stable codes SHALL include `stale_revision_conflict`, `source_changed`, `not_found`, `not_actionable`, `incompatible_definition`, and `write_failed`. The endpoint MUST NOT claim full success when only a subset of selected rows commits.

#### Scenario: One selected row conflicts while another succeeds

- **WHEN** a request selects two current rows and one receives a stale-revision conflict
- **THEN** the successful row remains committed by its own transaction
- **AND** the response contains an `accepted` result for it and a `failed` result with `stale_revision_conflict` for the conflicting row

### Requirement: Correction and undo are single-row CAS operations

`PATCH /api/documents/:id/biomarkers` SHALL accept exactly one `extractedBiomarkerId` for a correction or undo and SHALL invoke the same transactional writer. A compatible reviewed manual definition is required for correction. A complete retry whose requested revision is already active and whose projection is synchronized SHALL be an idempotent no-op. A stale expected revision SHALL return HTTP 409 with code `stale_revision_conflict` and MUST NOT mutate lineage.

#### Scenario: Manual correction retries after success

- **WHEN** a client repeats a correction request after the same target revision became active with a matching projection
- **THEN** the endpoint succeeds as an idempotent no-op
- **AND** it does not create another revision or rewrite promotion metadata

#### Scenario: Undo races with a newer correction

- **WHEN** an undo request supplies an active revision that has been superseded before the writer acquires locks
- **THEN** the endpoint returns HTTP 409 with `stale_revision_conflict`
- **AND** it leaves the newer active revision and observation projection unchanged
