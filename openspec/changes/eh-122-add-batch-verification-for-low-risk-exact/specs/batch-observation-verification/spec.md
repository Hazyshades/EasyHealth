## ADDED Requirements

### Requirement: Server-authoritative low-risk exact eligibility
The system SHALL compute batch-verification eligibility for each current laboratory extraction through one shared policy. A row SHALL be eligible only when it is awaiting review; the canonical resolver run against its current source evidence returns a concrete reviewed and compatible Registry 2.0 definition; its winning candidate has no missing or conflicting compatibility axes and active reviewed-resolution exact alias evidence without a fold fallback; it has no active human correction, reversal, `user_verified`, or `manually_corrected` decision; and it satisfies source-current and active-revision snapshot checks.

Pending-review rows SHALL be evaluated from the deterministic canonical resolver preview because they have no normalization revision or persisted trace yet. The successful existing normalization writer SHALL persist the canonical trace atomically with the verification revision. The policy SHALL validate any existing active trace only as a protected-decision/audit boundary and SHALL NOT accept client-supplied resolver evidence.

The policy SHALL return a stable exclusion code for every failed condition. It SHALL treat missing, malformed, stale, or non-authoritative decision evidence as excluded when an existing revision requires it. It SHALL NOT infer exactness from raw/display labels, use extraction confidence or the generic mapping-confidence band as batch eligibility, or promote an incomplete result to a concrete identity. The exact reviewed alias plus complete compatible evidence is the workflow's high-confidence definition because the resolver's current generic score cannot reach its `high` band for a standard exact match.

#### Scenario: Exact reviewed match with complete evidence is eligible
- **WHEN** a current pending-review laboratory row resolves to one reviewed compatible definition with complete compatible evidence and a canonical active reviewed-resolution exact alias match without a fold fallback
- **THEN** the policy SHALL classify it as eligible for batch verification

#### Scenario: Normalized or OCR match is excluded
- **WHEN** an otherwise resolved high-confidence row has a normalized, OCR-variant, token-set, bounded-fuzzy, fold-fallback, provisional, or recognition-only winning alias match
- **THEN** the policy SHALL classify it as excluded and return its stable exclusion code

#### Scenario: Incomplete resolver result is excluded
- **WHEN** a row is partial, ambiguous, unmapped, missing a concrete reviewed compatible definition, or has a confidence band other than high
- **THEN** the policy SHALL classify it as excluded and SHALL NOT expose it as a batch-verification candidate

#### Scenario: Human decision protects a row
- **WHEN** a row has an active measurement override, human correction/reversal, `user_verified`, or `manually_corrected` revision
- **THEN** the policy SHALL classify it as excluded even if its resolver evidence otherwise meets the low-risk conditions

### Requirement: Safe batch-verification selection and confirmation
The document review workspace SHALL distinguish batch verification from generic/raw acceptance. It SHALL initialize the batch-verification selection to eligible rows only, permit reviewers to deselect eligible rows, and prevent excluded rows from joining that selection.

Before execution, the workspace SHALL show a confirmation summary containing the selected count, eligible-but-deselected count, excluded count grouped by user-readable exclusion reason, and a statement that selected rows will be verified by the current user and may be undone only while unchanged. The confirmation view SHALL use a server-produced eligibility summary or the same response contract used for execution; client state alone SHALL NOT authorize a write.

Partial, ambiguous, and unmapped rows SHALL retain their individual/raw-acceptance paths and SHALL NOT be relabelled as batch verification.

#### Scenario: Default selection excludes ambiguous rows
- **WHEN** a document has three eligible exact rows, one ambiguous row, and one corrected row
- **THEN** the batch selection SHALL initially contain exactly the three eligible rows
- **AND THEN** the summary SHALL report the ambiguous and corrected rows as excluded with their respective reasons

#### Scenario: Reviewer deselects an eligible row
- **WHEN** a reviewer deselects one eligible row before confirming
- **THEN** the confirmation summary SHALL report it as eligible but not selected
- **AND THEN** execution SHALL NOT attempt to verify that row

#### Scenario: No candidates exist
- **WHEN** no current row is eligible
- **THEN** the workspace SHALL not offer an enabled batch-verification action
- **AND THEN** it SHALL continue to expose any applicable individual/raw-acceptance workflow

### Requirement: Idempotent document-scoped batch execution
The system SHALL provide an authenticated, document-owner-scoped batch-verification operation. The request SHALL bind a caller-provided operation id to a deduplicated selected extracted-row-id set and row snapshots sufficient to detect stale source/revision state.

At execution, the server SHALL re-read ownership, source-current state, active revision, and source evidence, then re-run the canonical resolver and eligibility policy for every requested row. Each eligible row SHALL be persisted only through the existing observation-normalization writer with its existing source ownership and compare-and-swap guards. Each row write SHALL have a deterministic request hash derived from the operation id and row id.

The operation SHALL return independent row outcomes and an aggregate `completed`, `partially_completed`, `no_op`, or `failed` result. A stale, missing, changed, or newly ineligible row SHALL be reported without suppressing independent eligible rows. A retry with the same actor, operation id, and identical payload SHALL return the original durable result; reuse with a conflicting payload SHALL fail deterministically.

#### Scenario: Row changes after confirmation
- **WHEN** a reviewer opens a confirmation summary and another action corrects one selected row before batch execution
- **THEN** execution SHALL not verify the changed row
- **AND THEN** it SHALL return a row outcome that identifies the stale or changed state
- **AND THEN** it SHALL continue processing independent selected rows

#### Scenario: Retry is idempotent
- **WHEN** a caller retries a completed batch request with the same operation id and identical selected-row payload
- **THEN** the system SHALL return the recorded aggregate and row outcomes
- **AND THEN** it SHALL NOT create an additional normalization revision or audit event

#### Scenario: Partial completion is explicit
- **WHEN** one selected row is successfully verified and another fails server-side eligibility re-evaluation
- **THEN** the response SHALL have aggregate result `partially_completed`
- **AND THEN** it SHALL report both the successful revision binding and the failed row's exclusion/outcome code

### Requirement: Durable minimal batch metadata
The system SHALL persist a batch operation and one operation-row record for every execution attempt or durable replay required to implement idempotency, result reporting, and reversal binding. The records SHALL contain only operation/profile/document/extracted-row/revision identifiers, actor/time, eligibility and outcome codes, request hashes, and aggregate state needed by the workflow.

Batch metadata SHALL NOT duplicate raw document labels, values, reference ranges, source text, filenames, bounding boxes, resolver decision traces, or free-form patient content. It SHALL be protected by ownership-aware access controls and SHALL NOT grant anonymous or arbitrary authenticated users write access.

#### Scenario: Metadata does not duplicate document evidence
- **WHEN** a batch successfully verifies a row
- **THEN** its operation-row record SHALL link the source and resulting revision by identifier
- **AND THEN** it SHALL contain no raw label, value, source text, bounding box, or resolver decision trace payload

### Requirement: Audit-safe batch reversal
The system SHALL permit a document owner to request reversal of a completed batch operation. For each operation row, reversal SHALL proceed only if the batch's resulting verification revision is still active and belongs to the requested document/profile. A row changed after the batch SHALL be reported as `changed_since_batch` and SHALL remain untouched.

For every reversible row, the system SHALL create a successor normalization revision through the established writer/database promotion path. The successor SHALL preserve source linkage and resolved identity while moving verification to `pending`, record the reversing user/time and reason, supersede the batch revision, and reference it as the reversal source. It SHALL NOT update/delete a prior normalization revision, observation, or EH-121 change event.

The existing EH-121 trigger-backed ledger SHALL capture each successful reversal. Batch operation metadata SHALL be supplementary and SHALL NOT replace normalization revisions or change events as audit truth.

#### Scenario: Unchanged verified row is reversed
- **WHEN** a completed batch row's resulting verification revision is still active
- **AND WHEN** the owner requests batch reversal with a reason
- **THEN** the system SHALL create a pending successor revision through the normalization writer
- **AND THEN** the change ledger SHALL contain the append-only verification-reversal event

#### Scenario: Later correction blocks reversal for one row
- **WHEN** a completed batch contains two rows and one has since been corrected individually
- **THEN** reversal SHALL leave the corrected row unchanged and report `changed_since_batch`
- **AND THEN** it SHALL reverse the unchanged row independently
- **AND THEN** the aggregate reversal result SHALL make the partial outcome explicit

### Requirement: Verification invariants remain intact
Batch verification SHALL preserve all existing EH-104, EH-119, EH-121, and source-provenance invariants. It SHALL record a successful verification decision with the acting profile and decision time, keep raw extraction immutable, preserve source ownership and writer compare-and-swap behavior, and rely on the existing append-only change ledger trigger.

The batch workflow SHALL NOT create a second observation writer, modify the EH-115 wrapper, grant verified concrete status to partial/ambiguous/unmapped rows, weaken reviewed-definition requirements, or change automatic-verification behavior.

#### Scenario: Raw acceptance remains non-verification
- **WHEN** a reviewer retains a partial or unmapped result through the existing raw-acceptance workflow
- **THEN** the persisted result SHALL remain pending verification
- **AND THEN** the row SHALL not appear in any successful batch-verification outcome
