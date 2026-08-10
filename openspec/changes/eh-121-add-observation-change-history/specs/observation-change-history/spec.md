## ADDED Requirements

### Requirement: Every auditable observation change is captured as an event

The system SHALL record one audit event for each change to an observation's
mapping, verification state, or source extraction. Capture SHALL happen in the
same database transaction as the change it records, so that a change cannot
commit without its event and an event cannot exist without its change. Capture
SHALL be driven from the append-only stores that already hold the change, and no
application code path SHALL be permitted to write an audit event directly.

The captured event kinds SHALL be `observation_accepted`, `mapping_corrected`,
`correction_reverted`, `verification_changed`, `extraction_superseded`, and
`reprocess_applied`.

#### Scenario: Accepting an extracted row records an acceptance event

- **WHEN** an extracted biomarker is accepted and its first normalization
  revision becomes active
- **THEN** one event of kind `observation_accepted` exists for that revision
- **AND** it names the resulting observation, its extracted row, its document
  and its profile

#### Scenario: A manual correction records a correction event

- **WHEN** a reviewer corrects a row's measurement definition and a new revision
  becomes active
- **THEN** one event of kind `mapping_corrected` exists for the new revision
- **AND** it names the revision it superseded

#### Scenario: Undoing a correction records a reversal event

- **WHEN** a reviewer restores an earlier mapping and the resulting revision
  names the revision it reverses
- **THEN** the event kind is `correction_reverted` rather than
  `mapping_corrected`

#### Scenario: A verification transition without a mapping change is still recorded

- **WHEN** a new active revision keeps the same measurement definition and
  analyte key but changes the verification status
- **THEN** the event kind is `verification_changed`

#### Scenario: Reprocessing an extracted row records supersession

- **WHEN** reprocessing retires an extracted row by clearing `is_current` and
  stamping `superseded_at`
- **THEN** one event of kind `extraction_superseded` exists for that extracted
  row

#### Scenario: An applied registry reprocess row records its result

- **WHEN** a registry reprocess batch row moves to the applied state
- **THEN** one event of kind `reprocess_applied` exists for that batch row
- **AND** it carries the batch row's prior and next mapping and verification
  values

#### Scenario: A replayed idempotent write records no second event

- **WHEN** the observation writer is called twice with the same request hash and
  reuses the existing revision
- **THEN** the revision still has exactly one event

### Requirement: Every event carries a complete before/after diff

An event SHALL carry the prior and next value of the measurement definition key,
the analyte key, the resolver result, the verification status, and the mapping
confidence band, independently of its event kind. Absent prior values SHALL be
recorded as null rather than omitted, so that a first acceptance is
distinguishable from an unchanged axis.

The event kind SHALL be resolved by this precedence: `correction_reverted` when
the revision names a reversed revision; otherwise `mapping_corrected` when the
measurement definition key or the analyte key changed; otherwise
`observation_accepted` when there was no prior revision; otherwise
`verification_changed`.

#### Scenario: A correction records both axes it moved

- **WHEN** a correction changes the measurement definition key and moves
  verification from `pending` to `manually_corrected`
- **THEN** the single `mapping_corrected` event records both the definition key
  transition and the verification status transition

#### Scenario: A first acceptance has null prior values

- **WHEN** an extracted row's first revision becomes active
- **THEN** every prior column on its event is null and every next column carries
  the new revision's value

### Requirement: Every event carries actor and version metadata

An event SHALL record who caused the change and under which processing contract.
The actor SHALL be recorded as an actor type of `user` or `system` together with
a profile reference when the actor is a user, resolved from the revision's
verification actor, its author, and its promoter in that order. The event SHALL
record the catalog manifest version and digest, the resolver version, the
normalization version, and the extraction version in force for the change, and
the operator-authored correction reason when one was supplied.

#### Scenario: A user correction attributes the acting profile

- **WHEN** a signed-in reviewer corrects a mapping
- **THEN** the event's actor type is `user` and its actor id is that reviewer's
  profile id

#### Scenario: An automatic decision attributes the system

- **WHEN** a revision becomes active with no user actor
- **THEN** the event's actor type is `system` and its actor id is null

#### Scenario: Version metadata pins the contract in force

- **WHEN** an event is captured from a revision that carries catalog and
  resolver versions
- **THEN** those versions are copied onto the event and remain readable after
  the catalog is upgraded

### Requirement: Audit events are append-only

Audit events SHALL NOT be updated or deleted once written. The database SHALL
reject a direct update or delete regardless of the acting role, and no role
SHALL hold the `update` or `delete` privilege on the store. Removal SHALL be
possible only where the subject itself is erased: a cascade from deleting the
document or the profile, or the controlled derived-lineage purge. An event
SHALL NOT hold a reference whose loss would require rewriting the event, so
deleting an observation or a reprocess batch SHALL leave its events intact.

#### Scenario: Updating an event is rejected

- **WHEN** any role attempts to update a stored audit event
- **THEN** the statement is rejected with an append-only error

#### Scenario: Deleting an event directly is rejected

- **WHEN** any role attempts to delete a stored audit event directly
- **THEN** the statement is rejected with an append-only error

#### Scenario: Deleting the document removes its events

- **WHEN** a document is deleted or its derived laboratory lineage is purged
- **THEN** its audit events are removed with it and the deletion succeeds

#### Scenario: Deleting an observation leaves its history standing

- **WHEN** reprocessing deletes an observation the history refers to
- **THEN** the events for that observation remain readable and unchanged

### Requirement: Audit events never duplicate raw document text

An audit event SHALL contain only identifiers, enumerated state values, evidence
hashes, version strings, actor references, and the operator-authored correction
reason. It SHALL NOT contain a raw label, a raw value, raw reference text, a
raw unit, source text, a bounding box, or a copy of the resolver decision trace.
Evidence SHALL be referenced by its 64-character lowercase hexadecimal hash, and
the store SHALL enforce that shape rather than rely on convention. A reader that
needs the decision trace SHALL follow the event's revision reference.

#### Scenario: A malformed evidence hash is rejected

- **WHEN** a write supplies an evidence hash that is not 64 lowercase hex
  characters
- **THEN** the write is rejected

#### Scenario: The decision trace stays on the revision

- **WHEN** a reader needs the resolver decision trace for an event
- **THEN** it reads the revision the event references, because the event stores
  no trace of its own

### Requirement: Pre-existing history is reconstructed and labelled

The change SHALL backfill audit events for revisions, superseded extracted rows,
and applied reprocess rows that existed before the ledger, so that documents
processed earlier show their history rather than appearing untouched. A
reconstructed event SHALL be distinguishable from a live capture, and SHALL
carry the source row's own timestamp so that ordering remains truthful.

#### Scenario: An older corrected row shows its correction

- **WHEN** a document whose row was corrected before the ledger existed is
  opened
- **THEN** its history shows the correction with its prior and next mapping

#### Scenario: A reconstructed event is marked as such

- **WHEN** an event was produced by the backfill rather than by a live capture
- **THEN** its origin identifies it as reconstructed

### Requirement: A history endpoint serves a document's change history

The system SHALL expose an authenticated, profile-scoped endpoint returning a
document's audit events, newest first. It SHALL reject an unauthenticated
request, SHALL answer as not found for a document the caller does not own, and
SHALL support narrowing to a single observation or a single extracted row. The
result size SHALL be bounded by an explicit limit with a documented default and
maximum, and an invalid limit SHALL be rejected rather than silently clamped.

#### Scenario: Another profile's document is not found

- **WHEN** a signed-in user requests the history of a document owned by someone
  else
- **THEN** the response is a not-found error and no events are disclosed

#### Scenario: Narrowing to one observation

- **WHEN** the request names an observation
- **THEN** only events for that observation are returned

#### Scenario: An invalid limit is rejected

- **WHEN** the request supplies a limit that is not a positive integer within
  the allowed maximum
- **THEN** the response is a validation error

### Requirement: The review workspace shows a compact change history

The review workspace SHALL show each reviewable row's change history in place,
collapsed by default and stating how many changes exist, so that the review list
stays scannable. Each entry SHALL state what changed, from which value to which
value, who changed it, when, and the reason when one was recorded. The surface
SHALL be present for both extracted-review rows and observation-fallback rows.
A row with no recorded change SHALL say so rather than render an empty control.

#### Scenario: A corrected row explains its correction

- **WHEN** a reviewer expands the history of a row whose mapping was corrected
- **THEN** the entry names the previous and the new measurement, the actor, the
  time, and the recorded reason

#### Scenario: An untouched row states that it has no history

- **WHEN** a row has no recorded change beyond its acceptance
- **THEN** the panel states that no further changes were recorded instead of
  showing an empty list

#### Scenario: Fallback rows expose history too

- **WHEN** the workspace renders observation-fallback rows because no extracted
  rows are reviewable
- **THEN** those rows expose the same history surface
