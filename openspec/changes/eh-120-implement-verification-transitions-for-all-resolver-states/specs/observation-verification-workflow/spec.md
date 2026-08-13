## ADDED Requirements

### Requirement: Verification and record lifecycle use independent axes

The document-derived laboratory review contract SHALL expose three independent axes for every current or historical source record: `resolution_status` (`resolved`, `partial`, `ambiguous`, or `unmapped`), `verification_status` (`pending`, `auto_verified`, `user_verified`, or `manually_corrected`), and `record_status` (`active`, `rejected`, or `superseded`). `rejected` and `superseded` SHALL NOT be serialized as verification statuses. Extraction process status and source-lineage fields SHALL remain separate from these axes.

For laboratory observations, `record_status` SHALL be authoritative on the linked extracted source record. Read boundaries and definition-specific consumers SHALL apply that status to the linked observation projection. Instrumental observations SHALL remain outside this document-derived lifecycle contract.

#### Scenario: Active resolved result remains pending until a decision

- **WHEN** a current extracted laboratory row resolves to one reviewed definition but has not been accepted or automatically promoted
- **THEN** the review contract reports `resolution_status = resolved`, `verification_status = pending`, and `record_status = active`
- **AND** it does not serialize the row as a verified concrete observation

#### Scenario: Incomplete result is retained without verification

- **WHEN** a current partial, ambiguous, or unmapped row is accepted as raw evidence
- **THEN** the contract reports the corresponding resolver outcome, `verification_status = pending`, and `record_status = active`
- **AND** no concrete measurement definition is exposed as active identity

#### Scenario: Superseded source remains auditable

- **WHEN** a reprocessing run replaces a laboratory extraction batch
- **THEN** each replaced source row reports `record_status = superseded`
- **AND** its raw evidence and normalization history remain readable as historical data

### Requirement: Only the transition policy may change workflow state

All verification and record-lifecycle transitions SHALL pass through one server-authoritative policy and trusted persistence seam. The policy SHALL validate the current source, active revision, actor type, permission, reason code, expected snapshots, and idempotency binding before allowing a transition. Client payloads SHALL NOT select the resulting status, actor type, or system actor identity.

#### Scenario: Foreign profile cannot reject a record

- **WHEN** an authenticated caller submits a rejection for a source row owned by another profile
- **THEN** the transition is rejected with an authorization error
- **AND** neither source, observation projection, nor audit history changes

#### Scenario: Stale transition is isolated

- **WHEN** a rejection, correction, or verification request carries an expected source or active-revision snapshot that no longer matches
- **THEN** the service returns a stable stale-conflict outcome
- **AND** it does not overwrite the newer decision

#### Scenario: Invalid verification of an incomplete outcome is rejected

- **WHEN** a caller attempts to transition a partial, ambiguous, or unmapped row to `auto_verified`, `user_verified`, or `manually_corrected`
- **THEN** the transition is rejected
- **AND** the row remains raw evidence with pending verification

### Requirement: Record rejection is explicit and reversible only by a new source

An authenticated owner MAY reject an active document-derived laboratory source only with an allowlisted non-PII reason code and a matching current snapshot. Rejection SHALL preserve the extracted row, raw provenance, existing observations, normalization revisions, and audit history. A rejected source SHALL be terminal; restoring it SHALL require a new source/review action rather than mutating the rejected row.

#### Scenario: Owner rejects an active extracted row

- **WHEN** the owner confirms rejection of an active source row with a valid reason code
- **THEN** the source transitions to `record_status = rejected` in one transaction
- **AND** its prior verification/revision data remains unchanged and auditable

#### Scenario: Rejection requires a reason

- **WHEN** a rejection request omits or supplies an unsupported reason code
- **THEN** the request is rejected before mutation
- **AND** the source remains active

#### Scenario: Rejected source is not definition-consumer eligible

- **WHEN** a linked laboratory observation has a reviewed resolved revision but its source record is rejected
- **THEN** the observation is excluded from definition-specific trends, reports, and assessment inputs
- **AND** the raw record remains available in review history

### Requirement: Source supersession is a service transition

Reprocessing SHALL transition an active source row to `record_status = superseded` only through a service-authorized, source- and batch-bound operation. Supersession SHALL preserve old evidence and revisions, SHALL be idempotent for the same reprocess row, and SHALL never directly delete a source or observation to hide the prior decision.

#### Scenario: Reprocessing supersedes a source row

- **WHEN** a document-level reprocess successfully publishes a replacement extraction batch
- **THEN** the old current source rows transition to `superseded` with lineage timestamps
- **AND** the replacement rows are active
- **AND** the old normalization history remains available

#### Scenario: Duplicate supersession retry is safe

- **WHEN** the same reprocess row is applied again after its supersession committed
- **THEN** the service reuses the existing outcome
- **AND** it creates no duplicate lifecycle event or replacement mutation

#### Scenario: Direct source lifecycle update is denied

- **WHEN** an ordinary authenticated or anonymous role directly updates `record_status`, `is_current`, or `superseded_at`
- **THEN** the database denies the operation or the lifecycle guard rejects it
- **AND** only the trusted transition seam can change those fields

### Requirement: Automatic verification is system-only and policy-approved

The system SHALL provide a service-role automatic verification path that recomputes the current resolver decision and may create `auto_verified` only when the result is resolved, the definition is reviewed and concrete, all hard evidence axes are compatible, the source is active/current, no manual override or protected human decision exists, and the configured quality gate for the resolver/catalog release is approved. The path SHALL persist system actor metadata and the canonical resolver trace through the same append-only writer boundary as user decisions.

#### Scenario: Approved automatic promotion

- **WHEN** a service worker evaluates an active source that satisfies every automatic-promotion predicate
- **THEN** it creates or reuses an active revision with `verification_status = auto_verified`
- **AND** the revision has a decision timestamp, `verification_actor_type = system`, a null actor id, a reviewed concrete definition, and an immutable decision trace

#### Scenario: Automatic promotion cannot accept incomplete data

- **WHEN** the automatic path evaluates a partial, ambiguous, or unmapped result, or a resolved result with a missing/conflicting axis
- **THEN** it leaves verification pending and returns a stable non-promotion reason
- **AND** it does not create a verified concrete measurement

#### Scenario: User cannot impersonate the system path

- **WHEN** an authenticated or anonymous caller invokes the automatic route or submits a system actor/status field
- **THEN** the request is denied
- **AND** no automatic revision or audit event is created

### Requirement: Human decisions are protected during reprocessing

Registry reprocessing and automatic verification SHALL NOT supersede an active `user_verified` or `manually_corrected` decision, measurement override, or explicit human reversal successor. A changed candidate SHALL be recorded as a skipped or pending reprocessing outcome with retryable context and SHALL require an explicit user correction to replace the protected decision.

#### Scenario: Reprocessing encounters a manual correction

- **WHEN** a reprocess candidate disagrees with an active manually corrected revision
- **THEN** the active human revision remains active and unchanged
- **AND** the reprocess result is recorded as skipped or pending with a stable protected-decision reason

#### Scenario: Automatic verification encounters a protected user decision

- **WHEN** the automatic worker evaluates a source with an active user-verified revision or reversal successor
- **THEN** it does not create an automatic revision
- **AND** the existing revision and audit history remain unchanged

### Requirement: Lifecycle transitions are append-only and audit-safe

Every successful rejection, supersession, automatic verification, user verification, correction, reversal, and reprocessing transition SHALL be captured by the service-owned append-only observation change ledger with actor type, actor id where applicable, prior/next states, source/revision identifiers, stable reason code, and version metadata. Audit metadata SHALL NOT duplicate raw document evidence, resolver trace payloads, or patient-entered content.

#### Scenario: Rejection produces one lifecycle event

- **WHEN** an active source is successfully rejected
- **THEN** exactly one idempotently captured rejection event records the prior and next record status, actor, reason code, and source identity
- **AND** retrying the same request does not append a duplicate event

#### Scenario: Historical revision cannot be rewritten

- **WHEN** a caller attempts to update or delete a prior normalization revision or change-history event to reflect a later rejection or reversal
- **THEN** the database rejects the mutation or the caller lacks permission
- **AND** a new successor/event is required for the new decision
