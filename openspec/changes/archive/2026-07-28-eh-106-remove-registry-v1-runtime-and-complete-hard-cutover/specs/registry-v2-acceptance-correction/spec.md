## ADDED Requirements

### Requirement: Every acceptance and correction writer uses v2 promotion

Every runtime writer that accepts or corrects a laboratory observation SHALL
use EH-104's service-only
`promote_observation_normalization_revision_v2` primitive for the target row.
The caller SHALL supply the target observation, target revision, expected
active revision, and user/service context required by the primitive, and SHALL
not directly synchronize observation projection or revision activation fields.
When an acceptance needs to create its target observation or revision, a
service-only per-row database writer SHALL create the same-source records and
invoke v2 promotion in one transaction; a route SHALL NOT leave a source-only
observation or an unlinked candidate revision on a failed initial acceptance.

#### Scenario: Acceptance promotes through v2
- **WHEN** a user accepts an eligible extracted laboratory result
- **THEN** the acceptance writer invokes the v2 promotion primitive and the
  active revision and observation projection are synchronized in that
  primitive's transaction

#### Scenario: Correction promotes through v2
- **WHEN** a user corrects a laboratory result by choosing a reviewed concrete
  Registry 2.0 definition
- **THEN** the correction writer invokes the v2 promotion primitive instead of
  updating the revision and observation separately

#### Scenario: Direct client promotion is unavailable
- **WHEN** an `anon` or `authenticated` client attempts to invoke a promotion
  or verified-write RPC directly
- **THEN** database permissions deny the call

#### Scenario: Failed initial acceptance leaves no half-linked record
- **WHEN** creation or promotion of an initial accepted result fails
- **THEN** the per-row transaction rolls back its new observation and revision
  rather than committing a source-only observation or unlinked candidate

### Requirement: User decisions preserve Registry 2.0 outcome semantics

The system SHALL map a user acceptance of a `resolved` result with a reviewed
selected definition to a `user_verified` active revision with user decision
metadata. The system SHALL map a raw user acceptance of `partial`,
`ambiguous`, or `unmapped` to a `pending` active revision with no invented
concrete definition or verified decision metadata. The system SHALL map a user
correction selecting a reviewed concrete definition to a `manually_corrected`
active revision with user decision metadata.

#### Scenario: Resolved reviewed acceptance is user verified
- **WHEN** a user accepts a resolved result whose selected Registry 2.0
  definition is reviewed
- **THEN** the active revision has `verification_status = 'user_verified'`
  and complete user decision metadata

#### Scenario: Partial raw acceptance remains pending
- **WHEN** a user accepts a partial result without choosing a concrete
  definition
- **THEN** the active revision remains `pending`, has no verified decision
  metadata, and does not gain a fabricated definition

#### Scenario: Ambiguous or unmapped raw acceptance remains pending
- **WHEN** a user accepts an ambiguous or unmapped result as raw evidence
- **THEN** the active revision remains `pending` and downstream consumers do
  not receive a concrete Registry 2.0 identity

#### Scenario: Reviewed correction is manually corrected
- **WHEN** a user corrects a result to a reviewed concrete Registry 2.0
  definition
- **THEN** the active revision has `verification_status = 'manually_corrected'`
  and complete user decision metadata

### Requirement: Multi-selection requests are independently atomic per row

An acceptance or correction request containing `ids[]` SHALL process each
selected row through an independent v2 promotion transaction. One row's stale
CAS, ownership, source/profile, or invariant failure SHALL not corrupt the
active revision or observation projection of any row. This capability SHALL NOT
introduce a batch-operation table, aggregate retry status, or a new automatic
verification API.

#### Scenario: One selected row has a stale active revision
- **WHEN** an `ids[]` request includes a row whose expected active revision is
  stale
- **THEN** that row reports the v2 stale failure and no mutation is committed
  for it

#### Scenario: Another selected row is eligible
- **WHEN** the same `ids[]` request includes a different row with a valid v2
  promotion input
- **THEN** that row can complete its own atomic promotion without relying on
  the failed row's transaction

### Requirement: Writer integration preserves EH-104 invariants

The acceptance and correction integration SHALL preserve the v2 primitive's
lock order, same-source/document/profile checks, expected-active CAS,
idempotent no-op behavior, and active-revision projection synchronization.
Writer code SHALL surface primitive failures and SHALL NOT silently repair a
divergent projection or reattach a revision to a different source.

#### Scenario: Source or profile mismatch is rejected
- **WHEN** a writer supplies an observation and revision that do not share the
  required extracted source, document, or profile ownership
- **THEN** v2 promotion fails and neither active revision nor observation
  projection changes

#### Scenario: Idempotent retry remains a no-op
- **WHEN** a writer retries a completed v2 promotion with an otherwise
  complete matching target
- **THEN** the primitive returns its idempotent no-op outcome without
  rewriting promotion metadata
