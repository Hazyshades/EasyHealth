## ADDED Requirements

### Requirement: Phase B enforcement is gated by clean preflight

Phase B database enforcement SHALL NOT be applied to a database that fails
`eh104_resolution_verification_preflight`. The preflight SHALL remain read-only
and SHALL NOT mutate patient or lineage data. Persistent environments, including
production and retained staging, SHALL abort with diagnostics and no mutation
when any finding is present. Only an explicitly marked disposable
pre-production environment MAY run a controlled document-derived laboratory
lineage reset, and only when an explicit environment allow-flag is set.
EH-104 Phase B SHALL NOT perform automatic semantic repair or invent
verification actors, measurement definitions, or source identities.
`NOT VALID` SHALL NOT be used to stage Phase B constraints.

#### Scenario: Clean preflight allows enforcement

- **WHEN** preflight returns zero findings on the target database
- **THEN** the Phase B enforcement migration MAY be applied

#### Scenario: Persistent environment aborts on findings

- **WHEN** preflight returns one or more findings in a persistent environment
- **THEN** enforcement is not applied
- **AND** diagnostics include finding codes without mutating rows

#### Scenario: Disposable reset requires explicit allow-flag

- **WHEN** an operator requests document-derived laboratory lineage reset
- **THEN** the reset runs only when the environment is disposable and the
  explicit allow-flag is enabled
- **AND** after reset, preflight MUST be re-run and return zero findings
  before enforcement

### Requirement: Revision verification guards are attached at runtime

`observation_normalization_revisions` SHALL enforce verification decision
metadata and the verified-cross-axis rule on both INSERT and UPDATE through
attached database triggers. `verification_status` SHALL remain one of
`pending`, `auto_verified`, `user_verified`, or `manually_corrected`.
`rejected` SHALL NOT be a verification status.

#### Scenario: Pending forbids decision metadata

- **WHEN** a revision is inserted or updated with `verification_status = 'pending'`
- **THEN** `verification_decided_at`, `verification_actor_type`, and
  `verification_actor_id` are all null or the write is rejected

#### Scenario: Auto-verified system decision

- **WHEN** a revision is `auto_verified`
- **THEN** it has `verification_actor_type = 'system'`, null
  `verification_actor_id`, non-null `verification_decided_at`,
  `resolver_result = 'resolved'`, and a non-null `measurement_definition_key`

#### Scenario: User-verified decision

- **WHEN** a revision is `user_verified` or `manually_corrected`
- **THEN** it has `verification_actor_type = 'user'`, non-null
  `verification_actor_id` and `verification_decided_at`,
  `resolver_result = 'resolved'`, and a non-null `measurement_definition_key`

#### Scenario: Incomplete result cannot be verified

- **WHEN** a writer attempts to insert or update a partial, ambiguous, or
  unmapped revision as `auto_verified`, `user_verified`, or `manually_corrected`
- **THEN** the database rejects the write

### Requirement: Verified definitions are reviewed at the trusted writer

`auto_verified`, `user_verified`, and `manually_corrected` revisions SHALL
reference a Registry definition whose maturity is `reviewed`. The reviewed
check SHALL be enforced by the trusted service writer path before persistence.
Phase B SHALL retain regression coverage proving non-reviewed definitions
cannot be verified through acceptance or correction APIs.

#### Scenario: Non-reviewed definition is rejected before persistence

- **WHEN** a verification write targets a provisional or retired definition
- **THEN** the trusted writer rejects the request
- **AND** no verified revision row is committed

### Requirement: Extracted resolver outcomes use the four-value domain

After clean preflight, `document_extracted_biomarkers.resolver_result` SHALL be
either null (pre-resolution) or one of `resolved`, `partial`, `ambiguous`, or
`unmapped`. Unsupported legacy values SHALL be impossible under the Phase B
constraint.

#### Scenario: Partial extracted outcome is stored

- **WHEN** extraction stores a partial resolver outcome
- **THEN** the row stores `resolver_result = 'partial'`

#### Scenario: Unsupported extracted outcome is rejected

- **WHEN** a writer attempts to store an extracted resolver outcome outside the
  four-value domain
- **THEN** the database rejects the write

### Requirement: Laboratory observation and revision share MATCH FULL source lineage

For laboratory observations, a linked normalization revision and its
observation SHALL form a full same-source pair. Phase B SHALL replace the
standalone observation-to-revision foreign key with a composite foreign key
from `observations (normalization_revision_id, source_extracted_biomarker_id)`
to `observation_normalization_revisions (id, extracted_biomarker_id)` using
`MATCH FULL`. Rows with both lineage columns null remain valid. Exactly one of
the two columns null is rejected. Instrumental observations continue to keep
both laboratory lineage columns null and use instrumental source identity from
EH-105.

#### Scenario: Half-linked laboratory observation is rejected

- **WHEN** a writer sets exactly one of `normalization_revision_id` or
  `source_extracted_biomarker_id` on a laboratory observation
- **THEN** the database rejects the write

#### Scenario: Source mismatch is rejected

- **WHEN** an observation's `source_extracted_biomarker_id` differs from the
  linked revision's `extracted_biomarker_id`
- **THEN** the database rejects the write

#### Scenario: Both-null lineage remains valid

- **WHEN** an observation has both laboratory lineage columns null
- **THEN** the row is accepted with respect to the composite laboratory relation
- **AND** instrumental exclusive-lineage rules from EH-105 still apply

#### Scenario: V2 promotion still succeeds on a clean pair

- **WHEN** `promote_observation_normalization_revision_v2` activates a revision
  for a same-source laboratory observation
- **THEN** the observation projection matches the active revision and the
  composite relation holds

### Requirement: Normalization revisions are append-only at runtime

Ordinary runtime writers SHALL NOT delete `observation_normalization_revisions`
rows. Physical deletion of document-derived revision history SHALL occur only
through the controlled purge path after observation laboratory lineage columns
are cleared as a pair.

#### Scenario: Direct revision delete is denied

- **WHEN** an ordinary runtime role or writer issues DELETE against a
  normalization revision
- **THEN** the operation is rejected or the role lacks permission

### Requirement: Controlled purge clears a full null lineage pair

The system SHALL provide a service-only controlled purge primitive for
document-derived laboratory lineage. The primitive SHALL, in one transaction,
lock affected rows, set both `normalization_revision_id` and
`source_extracted_biomarker_id` to null on each retained observation, then
delete the document's extracted biomarker lineage so revisions are removed
without leaving half-linked observations. The purge path is the only allowed
bypass of the provenance write-once guard for that laboratory lineage pair.
Execution SHALL be granted only to `service_role`.

#### Scenario: Document purge leaves no half-link

- **WHEN** controlled purge runs for a document with linked laboratory
  observations
- **THEN** each retained observation has both laboratory lineage columns null
- **AND** no observation remains with exactly one lineage column set

#### Scenario: Non-service caller cannot purge

- **WHEN** `anon` or `authenticated` calls the purge primitive
- **THEN** PostgreSQL denies execution

### Requirement: Legacy promotion RPC is removed

After Phase B enforcement, `promote_observation_normalization_revision` SHALL
not exist. Acceptance, correction, and any other runtime promotion SHALL use
only `promote_observation_normalization_revision_v2`. CI or a package static
check SHALL reject active references to the legacy function outside historical
migrations and the drop migration.

#### Scenario: Legacy function is absent

- **WHEN** the Phase B enforcement migration has been applied
- **THEN** the legacy three-argument promotion function cannot be executed
  because it is dropped

#### Scenario: Static ban catches a revived caller

- **WHEN** application, worker, or script code references the legacy promotion
  RPC name as an active caller
- **THEN** the static verification command fails

### Requirement: Phase B database fixtures are executable

Phase B SHALL extend the EH-104 database fixture suite run by
`pnpm test:eh104-db` after a disposable local Supabase stack applies repository
migrations. Fixtures SHALL prove guard attachment, composite lineage
enforcement, controlled purge, direct revision-delete denial, legacy RPC
absence, and continued success of the v2 promotion path.

#### Scenario: Local Phase B fixture suite runs

- **WHEN** CI starts a disposable local Supabase stack and applies migrations
- **THEN** `pnpm test:eh104-db` executes Phase B enforcement fixtures
  successfully on a clean database

### Requirement: Scoring eligibility remains unchanged

Phase B SHALL NOT add verification-status gates to Health Profile scoring or
change which resolved reviewed bindings are assessment-eligible. Incomplete
outcome presentation remains owned by EH-112.

#### Scenario: Health Profile filter is untouched

- **WHEN** Health Profile evaluates laboratory observations after Phase B
- **THEN** eligibility still depends on existing resolved/reviewed binding rules
- **AND** Phase B adds no new verification_status scoring predicate
