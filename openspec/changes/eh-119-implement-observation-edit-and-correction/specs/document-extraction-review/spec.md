## MODIFIED Requirements

### Requirement: Manual corrections are append-only and reversible

Manual verification, correction, or undo SHALL create a normalization revision with actor, timestamp, any selected definition justified by the evidence, evidence, and supersession links. Prior decisions MUST NOT be deleted or overwritten.

A correction that restates the reported measurement SHALL follow the same append-only rule and SHALL additionally record the measurement override and a required, non-blank correction reason on the new revision. Undo SHALL be available for every revision the user can create, including a revision that carries no measurement definition key, and SHALL be expressed as a forward reversal revision rather than a deletion or an in-place edit.

#### Scenario: Correction is undone

- **WHEN** a user undoes an active correction
- **THEN** a reversal/promotion revision is created and history remains intact

#### Scenario: Measurement correction is recorded

- **WHEN** a user restates a printed value, unit, reference range or date
- **THEN** a new revision records the override, the correction reason, the acting profile and the time, and supersedes the prior active revision
- **AND** the prior revision remains readable

#### Scenario: Undo is available on an incomplete row

- **WHEN** a user undoes a correction on a row whose target revision has no measurement definition key
- **THEN** a reversal revision restores that revision's measurement state
- **AND** the request is not rejected for lacking a definition

### Requirement: Correction choices respect hard evidence

The standard review UI SHALL offer only candidates compatible with explicit value kind, unit, specimen, timing, and method evidence. It MUST NOT force a mapping for partial or unmapped results.

When a reviewer restates measurement evidence, the offered candidates SHALL be recomputed from the corrected input rather than from the extracted row, so that a restated unit neither preserves a candidate the corrected evidence rejects nor hides a candidate the corrected evidence now supports. The correction surface SHALL NOT offer a specimen, modifier, timing, or method value, and SHALL NOT present a mapping choice as a precondition for saving a restated measurement.

#### Scenario: Specimen is absent

- **WHEN** serum and plasma definitions are candidates but the report states neither
- **THEN** ordinary acceptance remains available without choosing either specimen

#### Scenario: Candidates follow the corrected evidence

- **WHEN** a reviewer restates the unit of a row and the corrected unit is accepted by a reviewed definition that the extracted unit was not compatible with
- **THEN** the offered candidates are those the corrected input supports
- **AND** a candidate rejected by the corrected input is no longer offered

#### Scenario: A measurement correction saves without a mapping

- **WHEN** a reviewer restates a value on a row whose document states no specimen
- **THEN** the correction saves and the row remains partial
- **AND** no control invites the reviewer to supply the missing specimen

## ADDED Requirements

### Requirement: The ordinary review action set includes restating the reported measurement

The review experience SHALL let an authenticated owner restate the value, unit, reference range and observation date of an extracted laboratory result without opening technical details, and SHALL require a reason for that restatement. The restated measurement SHALL be presented as a correction of what was read from the document, never as a correction of the document itself, and the raw printed evidence SHALL remain visible alongside it.

#### Scenario: Correction is a primary action

- **WHEN** a reviewer selects a reviewable row
- **THEN** the correction affordance is available without expanding technical details

#### Scenario: Raw evidence stays visible after a correction

- **WHEN** a row has been corrected
- **THEN** the review row shows the corrected measurement and continues to show what the document printed
- **AND** the row is marked as restated by a person

### Requirement: Correction failures are actionable at the row that failed

A rejected correction SHALL be reported against the row the reviewer was editing, SHALL name the field or unit at fault, and SHALL state what would make the correction acceptable. A rejection SHALL NOT be reported only as a generic failure, and SHALL NOT be surfaced solely in a workspace-level message that can scroll out of view.

#### Scenario: An invalid unit is reported on the row

- **WHEN** a reviewer submits a unit the catalog cannot normalize
- **THEN** the error appears on that row, names the unit, and states that the unit is not recognized
- **AND** the entered values are preserved for correction rather than discarded

#### Scenario: A concurrent change is reported as a conflict

- **WHEN** a correction fails because the row's active revision changed since the form was opened
- **THEN** the row states that the result changed elsewhere and asks the reviewer to reload before retrying
- **AND** the failure is not reported as an unexpected server error
