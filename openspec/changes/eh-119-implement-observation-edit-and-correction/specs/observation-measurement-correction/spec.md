## ADDED Requirements

### Requirement: A correction restates resolver input, never a stored outcome

A user correction SHALL be expressed as a measurement override against the raw
extraction, and the system SHALL re-derive the effective measurement, the
resolver outcome, the identity tier, the mapping confidence and the decision
trace from raw evidence combined with that override. A correction request SHALL
NOT carry a resolver result, an analyte key, a mapping confidence or a decision
trace, and the system SHALL NOT accept a caller-asserted outcome. The override
SHALL be absolute against raw extraction rather than cumulative against the
previous override.

#### Scenario: A restated unit is re-resolved

- **WHEN** a reviewer restates the unit of an extracted result
- **THEN** the system rebuilds the resolver input from raw evidence with the
  restated unit applied
- **AND** the persisted resolver result, identity keys, mapping confidence and
  decision trace are the resolver's output for that corrected input
- **AND** the input evidence hash of the new revision differs from the hash of
  the revision it supersedes

#### Scenario: A caller-supplied outcome is refused

- **WHEN** a correction request contains a resolver result, analyte key,
  measurement definition key inside the override, or a decision trace
- **THEN** the request is rejected with an actionable error naming the field
- **AND** no revision is written

#### Scenario: A second correction replaces the first

- **WHEN** a reviewer corrects the unit of a row that already carries an
  override restating the value
- **THEN** the new override is evaluated against raw extraction, not against
  the previous override
- **AND** any field absent from the new override reverts to its raw extracted
  value

### Requirement: A correction never rewrites raw extraction

A correction SHALL NOT write, clear or re-derive any raw, source, provenance or
version field of an observation or of its extracted source row. The correctable
set SHALL be exactly the reported measurement: value, value text, value kind,
ordinal, unit, reference low, reference high and observation date.

#### Scenario: Raw columns are byte-identical after a correction

- **WHEN** a reviewer corrects the value, unit, reference range and date of an
  accepted result
- **THEN** `raw_name`, `raw_value_text`, `raw_reference_text`, `raw_unit`,
  `source_page`, `source_text`, `bounding_box`, `confidence`,
  `extraction_version`, `provenance_schema_version` and every catalog, resolver
  and normalization version column on the observation are unchanged
- **AND** the raw columns of `document_extracted_biomarkers` are unchanged

#### Scenario: An override naming a raw field is refused

- **WHEN** a correction override contains a raw, source or version field name
- **THEN** the database rejects the override as malformed
- **AND** no revision or observation mutation is committed

### Requirement: The measurement override has a validated shape

The system SHALL validate a measurement override identically in the application
and in the database. An override SHALL be an object carrying at least one
correctable field and no unknown field. A numeric value kind SHALL carry a
value; a non-numeric value kind SHALL carry non-empty value text. When both
reference bounds are present the low bound SHALL NOT exceed the high bound. An
observation date SHALL be a calendar date that is not in the future. A restated
unit SHALL be a non-blank string.

#### Scenario: An inverted reference range is refused

- **WHEN** a reviewer submits a reference range whose low bound exceeds its
  high bound
- **THEN** the request is rejected with an actionable error naming the
  reference range
- **AND** the stored measurement is unchanged

#### Scenario: A future observation date is refused

- **WHEN** a reviewer submits an observation date later than today
- **THEN** the request is rejected with an actionable error naming the date
- **AND** the stored measurement is unchanged

#### Scenario: An empty override is refused

- **WHEN** a correction request carries an override with no correctable field
- **THEN** the request is rejected with an actionable error stating that
  nothing was restated

### Requirement: A restated unit is checked against reviewed unit policy

The system SHALL evaluate a restated unit through the reviewed clinical
compatibility rules before writing it. A unit the catalog cannot normalize SHALL
be refused. A unit whose dimension conflicts with the definition currently bound
to the row SHALL be refused unless the reviewer confirms the resulting loss of
that binding, and the refusal SHALL name the unit and the expected dimension.
The system SHALL NOT silently downgrade a resolved row to an incomplete outcome.

#### Scenario: An unsupported unit is refused

- **WHEN** a reviewer restates a unit the measurement catalog does not
  recognize
- **THEN** the request is rejected with an actionable error naming the unit
- **AND** the stored measurement is unchanged

#### Scenario: A dimension conflict against the bound definition is surfaced

- **WHEN** a reviewer restates the unit of a resolved row with a unit whose
  dimension the bound definition does not accept
- **THEN** the response states the unit, the expected dimension, and that
  accepting the correction would leave the row without its concrete definition
- **AND** the correction is applied only when the request confirms that outcome

#### Scenario: A restated unit unblocks a reviewed definition

- **WHEN** a row is incomplete only because its printed unit was missing or
  unreadable, and the reviewer restates a unit the reviewed definition accepts
- **THEN** the re-resolution may reach `resolved`
- **AND** the reviewed-definition picker offered for that row is recomputed
  from the corrected input rather than from the extracted row

### Requirement: A censored result is preserved as printed

The system SHALL preserve a censored or comparator-bearing result as text rather
than converting it into a bare number. A reviewer SHALL NOT be able to create a
numeric measurement from a comparator, and no correction path SHALL write a
comparator, specimen, modifier or method into a clinical identity axis.

#### Scenario: A comparator value is kept as text

- **WHEN** a reviewer restates a result as `< 0.20`
- **THEN** the stored value kind is text, the value text is the restated string
  verbatim, and no numeric value is synthesized
- **AND** the clinical modifier axis is unchanged

#### Scenario: No axis editing affordance exists

- **WHEN** a reviewer opens the correction form for any row
- **THEN** no control offers a specimen, modifier, timing or method value
- **AND** an incomplete row whose document states no specimen continues to
  offer raw acceptance rather than an axis choice

### Requirement: Every correction records reason, actor and time and is append-only

A correction SHALL create a new normalization revision carrying the override,
the correction reason, the acting profile and the creation time, and SHALL
supersede the previously active revision through the expected-active
compare-and-swap. A correction SHALL NOT update or delete a prior revision. A
correction reason SHALL be required and non-blank. Replaying an identical
correction SHALL be idempotent rather than creating a second revision.

#### Scenario: A correction without a reason is refused

- **WHEN** a correction request omits the reason or supplies only whitespace
- **THEN** the request is rejected with an actionable error naming the reason
- **AND** no revision is written

#### Scenario: History survives a correction

- **WHEN** a reviewer corrects a row that already has an active revision
- **THEN** a new revision is inserted carrying the override, reason, actor and
  time, and it supersedes the prior revision
- **AND** the prior revision remains readable and is no longer active

#### Scenario: A concurrent correction is rejected, not merged

- **WHEN** a correction supplies an expected active revision that is no longer
  active
- **THEN** the write fails as a stale-revision conflict
- **AND** neither the observation projection nor the active revision changes

#### Scenario: An identical replay is idempotent

- **WHEN** the same correction is submitted twice by the same actor with the
  same reason and override
- **THEN** the second submission reuses the first revision and reports reuse
- **AND** exactly one revision exists for that correction

### Requirement: A correction may terminate incomplete

A correction SHALL be permitted when its re-resolution is `partial`, `ambiguous`
or `unmapped`, and SHALL NOT require the reviewer to select a concrete
measurement definition. An incomplete correction SHALL NOT store a measurement
definition key, SHALL NOT carry verified decision metadata, and SHALL leave the
revision `pending`. A correction whose re-resolution is `resolved` with a
reviewed definition SHALL be `manually_corrected` with complete user decision
metadata.

#### Scenario: The value of a partial row is corrected

- **WHEN** a reviewer corrects the printed value of a row that stays `partial`
  because the document states no specimen
- **THEN** the correction is committed, the revision is `pending` with null
  verification decision metadata, and no measurement definition key is stored
- **AND** the analyte link the resolver was entitled to make is preserved

#### Scenario: A corrected resolved row is manually corrected

- **WHEN** a correction re-resolves to `resolved` against a reviewed definition
- **THEN** the active revision is `manually_corrected` with the acting profile
  and decision time

#### Scenario: A human edit is visible without a verification status

- **WHEN** a row carries an override and its revision is `pending`
- **THEN** the review surface can state that a person restated the result
  without presenting it as verified

### Requirement: Undo restores a prior measurement state

Undo SHALL create a forward revision that restores the target revision's
measurement override and identity, links to the revision it reverses, and
promotes through the same compare-and-swap. Undo SHALL succeed for a target
revision that carries no measurement definition key. Undo SHALL NOT delete a
revision.

#### Scenario: Undoing a correction on an incomplete row

- **WHEN** a reviewer undoes a correction whose target revision has no
  measurement definition key
- **THEN** a reversal revision is created restoring that revision's override
  and outcome
- **AND** the request is not rejected for lacking a definition

#### Scenario: Undoing back to raw extraction

- **WHEN** a reviewer undoes back to a revision that carried no override
- **THEN** the projected measurement equals the raw extracted measurement
- **AND** the correction history remains readable

### Requirement: Reprocessing does not silently discard a correction

Reprocessing and batch re-resolution SHALL treat an active revision carrying a
measurement override as a protected user decision by default, on the same terms
as a user-verified or manually-corrected revision. Overriding that protection
SHALL require an explicit request and a recorded reason, and the affected rows
SHALL be reported.

#### Scenario: A corrected pending row is skipped by default

- **WHEN** a reprocessing batch selects rows and one carries an active revision
  with a measurement override and `pending` verification
- **THEN** the row is skipped as a protected manual decision and counted as
  such in the batch summary

#### Scenario: Overriding protection is explicit and recorded

- **WHEN** a batch is requested with manual-decision inclusion and a reason
- **THEN** the corrected row may be re-resolved
- **AND** the batch records the reason and reports that the correction was
  superseded

### Requirement: The corrected measurement is projected atomically

The promotion primitive SHALL project the effective measurement — value, value
text, value kind, ordinal, unit, reference low, reference high and observation
date — onto the observation in the same transaction and under the same locks as
the identity projection. Its idempotent short-circuit SHALL compare the
projected measurement as well as the identity columns, so that a correction
changing only a measurement field is not mistaken for a completed write. A
failed correction SHALL leave no partially projected observation.

#### Scenario: A measurement-only correction is projected

- **WHEN** a correction changes only the printed value of an already accepted
  row
- **THEN** the observation's value is updated in the promotion transaction
- **AND** the write is not short-circuited as an idempotent no-op

#### Scenario: A failed correction commits nothing

- **WHEN** promotion fails after the revision insert
- **THEN** the transaction rolls back and neither the revision nor the
  observation measurement changes
