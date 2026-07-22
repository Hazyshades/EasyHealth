## ADDED Requirements

### Requirement: Resolver outcomes are a four-value domain

Resolver outcome SHALL be independent from verification trust. Whenever a
resolver outcome is stored, it SHALL be one of `resolved`, `partial`,
`ambiguous`, or `unmapped`. A pre-resolution extracted row MAY have a null
resolver outcome; a normalization revision SHALL NOT.

Phase A retains the existing revision and observation domains and reports
invalid legacy extracted values through read-only preflight. After the EH-106
writer cutover and clean preflight, Phase B adds the final constraint on
pre-acceptance extracted rows. A legacy
`measurement_resolution_shadow_events` table is inspected only when it is
present; it is retired in the current migration chain.

#### Scenario: Phase B extracted biomarker accepts partial when an outcome exists

- **WHEN** a resolver stores a partial outcome for a
  `document_extracted_biomarkers` row
- **THEN** the row stores `resolver_result = 'partial'` under the Phase B
  four-value constraint

#### Scenario: Retained legacy shadow event is inspected conditionally

- **WHEN** populated-data preflight runs in an installation that still retains
  `measurement_resolution_shadow_events`
- **THEN** preflight reports an unsupported non-null `resolver_result` without
  making the retired table a Phase A migration dependency

### Requirement: Revision verification status has explicit decision metadata

`observation_normalization_revisions.verification_status` SHALL be non-null and
one of `pending`, `auto_verified`, `user_verified`, or `manually_corrected`.
`rejected` SHALL NOT be a verification status in EH-104; record rejection is
deferred to EH-120.

`verification_decided_at`, `verification_actor_type`, and
`verification_actor_id` are decision metadata, not revision-creation metadata.
Phase A adds these columns without actor/cross-axis enforcement. Phase B,
after the EH-106 writer cutover and preflight, enables the INSERT and UPDATE
guards below. `NOT VALID` SHALL NOT be used to stage these guards.

#### Scenario: Pending decision metadata is empty

- **WHEN** a revision has `verification_status = 'pending'`
- **THEN** `verification_decided_at`, `verification_actor_type`, and
  `verification_actor_id` are all null

#### Scenario: Automatic verification has a system decision

- **WHEN** a revision is `auto_verified`
- **THEN** it has `verification_actor_type = 'system'`, a null
  `verification_actor_id`, and a non-null `verification_decided_at`

#### Scenario: User decision has an identified actor

- **WHEN** a revision is `user_verified` or `manually_corrected`
- **THEN** it has `verification_actor_type = 'user'`, a non-null
  `verification_actor_id`, and a non-null `verification_decided_at`

#### Scenario: INSERT path receives decision metadata

- **WHEN** a verified revision is inserted directly
- **THEN** INSERT-time guards reject a missing or inconsistent actor/timestamp
  combination

#### Scenario: UPDATE path receives decision metadata

- **WHEN** an existing pending revision changes to a verified status
- **THEN** UPDATE-time guards set or validate `verification_decided_at` and
  reject an inconsistent actor combination

### Requirement: Verified revisions require a resolved reviewed definition

`auto_verified`, `user_verified`, and `manually_corrected` revisions SHALL be
`resolved` and have a non-null `measurement_definition_key`. Phase B SHALL
enforce this cross-axis rule on both INSERT and UPDATE. The selected definition
SHALL be `reviewed`, enforced by a trusted server-side Registry guard after the
EH-106 writer cutover.

#### Scenario: Incomplete result cannot be verified

- **WHEN** a caller attempts to insert or update a partial, ambiguous, or
  unmapped revision as verified
- **THEN** the database rejects the write

#### Scenario: Non-reviewed definition cannot be verified

- **WHEN** a verified revision references a definition that is not reviewed in
  the Registry
- **THEN** the trusted writer rejects the request before persistence

### Requirement: Active revision owns post-acceptance state

EH-104 SHALL keep the active revision authoritative for every v2-promoted
observation.

For an observation promoted through v2, and for every accepted observation
after the EH-106 writer cutover, the active normalization revision SHALL be
authoritative for resolver outcome and verification status.
`document_extracted_biomarkers` is a pre-acceptance snapshot and SHALL NOT be
used as post-acceptance authority in that flow. Phase A deliberately leaves the
legacy acceptance/correction control flow on its legacy path until EH-106.

`observations.measurement_definition_key`, `normalization_revision_id`, and
`resolution_status` SHALL be synchronized projections of the active revision.
`observations` SHALL NOT receive verification columns in EH-104.

#### Scenario: Projection equals the active revision

- **WHEN** a promotion succeeds
- **THEN** the observation references the active target revision and its
  `measurement_definition_key` and `resolution_status` equal that revision's
  definition and `resolver_result` in the same transaction

#### Scenario: Inactive candidate does not affect consumers

- **WHEN** a normalization candidate is inactive
- **THEN** it is not selected as a v2 observation's authoritative revision and
  does not alter that observation projection or scoring inputs

### Requirement: Observation and revision share source lineage

The system SHALL preserve a full same-source relationship between every linked
observation and normalization revision.

Phase A SHALL add the composite uniqueness target but SHALL NOT enable the
composite foreign key or `MATCH FULL`; current writers can commit an interim
source-only observation. Phase B, after EH-106 uses the atomic primitive,
SHALL enforce that a linked revision and observation reference the same
extracted biomarker and SHALL reject half-linked rows and
source/profile/document mismatches. `NOT VALID` SHALL NOT be used to stage the
Phase B relation.

#### Scenario: Phase A retains legacy source-only observations

- **WHEN** an existing EH-106-incompatible writer creates an observation with
  `source_extracted_biomarker_id` before promotion
- **THEN** Phase A accepts the write and does not enable `MATCH FULL`

#### Scenario: Source mismatch is rejected

- **WHEN** promotion targets an observation whose
  `source_extracted_biomarker_id` differs from the target revision's
  `extracted_biomarker_id`
- **THEN** promotion fails and no active revision or observation projection
  changes

#### Scenario: Profile mismatch is rejected

- **WHEN** the target revision's extracted biomarker and target observation
  belong to different profiles or documents
- **THEN** promotion fails and the transaction rolls back

### Requirement: Revision deletion uses controlled purge

Phase B SHALL make normalization revisions append-only during ordinary runtime.
A profile/document purge SHALL then be the only supported physical deletion
path for document-derived lineage. It SHALL atomically clear both
`normalization_revision_id` and `source_extracted_biomarker_id` on each
retained observation before deleting the extracted lineage and cascading its
revisions. The purge path SHALL be the only allowed bypass of the provenance
write-once guard for these fields.

#### Scenario: Phase A preserves legacy document deletion

- **WHEN** Phase A is deployed before EH-106 cutover
- **THEN** it does not change the existing document delete path

#### Scenario: Direct revision delete is unavailable to a runtime writer

- **WHEN** an ordinary runtime writer attempts to delete a normalization
  revision directly
- **THEN** the database rejects the operation or the writer lacks permission

#### Scenario: Document purge preserves a full null lineage pair

- **WHEN** a controlled document purge deletes an extracted biomarker with a
  linked retained observation
- **THEN** both observation lineage columns are null after the transaction and
  no half-linked row remains

### Requirement: Promotion is a service-only compare-and-swap primitive

Phase A SHALL expose the versioned
`promote_observation_normalization_revision_v2` only to `service_role` and
shall retain the legacy promotion RPC only for `service_role` until Phase B.
The v2 primitive SHALL lock the source rows in the order extracted biomarker,
observation, then active/target revisions ordered by id. After ownership and
projection checks, it SHALL return a complete idempotent no-op before comparing
the current active revision with the supplied expected active revision. It
SHALL perform the CAS before every non-no-op mutation.

#### Scenario: Stale active revision fails

- **WHEN** the supplied expected active revision differs from the current
  active revision after locks are acquired
- **THEN** promotion returns a stale-revision failure and rolls back

#### Scenario: Complete idempotent promotion is a no-op

- **WHEN** the target is already active for the same observation and every
  source and projection invariant already holds
- **THEN** promotion succeeds without rewriting promotion metadata

#### Scenario: Retry after initial activation succeeds before CAS

- **WHEN** a retry supplies `expected_active_revision_id = NULL` after its
  first activation already made the target active with every invariant intact
- **THEN** promotion returns the complete no-op instead of a stale-revision
  failure and does not rewrite promotion metadata

#### Scenario: Divergent projection is not silently repaired

- **WHEN** the target is already active but an observation projection differs
  from it
- **THEN** promotion fails with an invariant error; repair is a separate
  administrative workflow

#### Scenario: Direct client RPC call is denied

- **WHEN** `anon` or `authenticated` calls a promotion or verified-write RPC
- **THEN** PostgreSQL denies execution

### Requirement: Document-observations projects active revision dimensions

`GET /api/documents/:id/observations` SHALL expose `resolver_result` and
`verification_status` from the observation's active linked normalization
revision, together with `resolution_status` from `observations`.

#### Scenario: Document observation uses active revision

- **WHEN** a document-observations response contains an observation with an
  active linked revision
- **THEN** its resolver and verification fields match that active revision and
  do not come from `document_extracted_biomarkers`

### Requirement: Constraint rollout is gated by compatible writers

EH-104 SHALL use two phases. Phase A deploys only additive schema, a read-only
preflight, v2 promotion, and service-only RPC grants. Phase B follows the
EH-106 writer cutover and contains populated-database preflight/backfill or
reset, same-source and actor/cross-axis enforcement, controlled purge, and
legacy-RPC removal. EH-104 SHALL not automatically repair semantic data.
Persistent environments SHALL abort Phase B enforcement with diagnostics and
no mutation for every preflight finding. Only an explicitly marked disposable
pre-production environment MAY reset its document-derived lineage through the
controlled purge workflow.

#### Scenario: Legacy or half-linked data blocks final enforcement

- **WHEN** preflight finds null/invalid statuses, verified incomplete rows,
  source/profile mismatches, half-linked observations, multiple active
  revisions, or divergent projections
- **THEN** a persistent environment aborts with diagnostics and no mutation,
  while an explicitly marked disposable pre-production environment may run the
  controlled reset; neither path silently clears source identity

#### Scenario: Constraints wait for EH-106 writers

- **WHEN** compatible acceptance and correction writers are not deployed
- **THEN** Phase B constraints, controlled purge enforcement, and legacy-RPC
  removal are not enabled

### Requirement: Database fixtures are executable

EH-104 database fixtures SHALL run through `pnpm test:eh104-db`, which invokes
`supabase test db --local` after a disposable local Supabase stack has applied
the repository migrations. Phase A fixtures SHALL cover clean and populated
legacy data, safe domain additions, both RPC grants, v2 CAS/no-op order, source
ownership, projection equality, and read-only preflight. Phase A may invoke the
unattached guard function inside a rolled-back fixture transaction to prove its
future INSERT/UPDATE contract, but it SHALL NOT attach that guard in runtime.
Phase B fixtures SHALL cover runtime guard attachment, composite lineage
enforcement, controlled purge, migration abort, and disposable reset.

#### Scenario: Local database fixture suite runs

- **WHEN** CI starts a disposable local Supabase stack and applies migrations
- **THEN** `pnpm test:eh104-db` executes the EH-104 pgTAP fixture suite

### Requirement: Scoring eligibility is unchanged

EH-104 SHALL NOT change scoring eligibility. Existing consumers continue to
select resolved observations with reviewed assessment bindings. Incomplete
outcome UX, trends, metrics, and consumer semantics are deferred to EH-112.

#### Scenario: Existing scoring filter remains unchanged

- **WHEN** Health Profile evaluates observations
- **THEN** EH-104 adds no verification-status eligibility gate
