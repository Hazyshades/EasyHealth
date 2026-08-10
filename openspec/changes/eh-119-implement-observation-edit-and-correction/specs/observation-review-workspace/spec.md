## ADDED Requirements

### Requirement: A review row exposes its correctable measurement

A review row SHALL carry the correctable measurement fields as discrete values —
value, value text, value kind, ordinal, unit, reference low, reference high and
observation date — in addition to the formatted raw evidence it displays. The
row projection SHALL remain free of candidate measurement or analyte
identifiers, and exposing correctable fields SHALL NOT introduce a second source
of truth for what the document printed.

#### Scenario: Correctable fields are available to the row

- **WHEN** the workspace builds a review row for an extracted result
- **THEN** the row carries the discrete correctable measurement fields as well
  as the formatted display value
- **AND** the row still carries no candidate measurement definition key or
  candidate analyte key

#### Scenario: Formatted evidence and correctable fields agree

- **WHEN** a row carries no override
- **THEN** the correctable fields equal the extracted measurement and the
  formatted display value is derived from them

### Requirement: The correction form is a primary row affordance

The correction form SHALL be rendered as part of the review row rather than
inside the progressive-disclosure technical details block, and SHALL be offered
only for rows the user may act on. Opening the form SHALL NOT change the
selected row, the current page, or the source highlight.

#### Scenario: Correction form is outside technical details

- **WHEN** a reviewable row is rendered
- **THEN** the correction affordance is present in the row body
- **AND** the technical details block continues to hold candidate evidence,
  versions, the decision trace and the mapping picker

#### Scenario: A stored non-reviewable row offers no correction form

- **WHEN** a row is rendered in the observations fallback path
- **THEN** no correction form is offered for it

#### Scenario: Opening the form preserves navigation state

- **WHEN** a reviewer opens the correction form on the selected row
- **THEN** the selected row, current page and source highlight are unchanged

### Requirement: Each row owns its correction error and busy state

A correction failure SHALL be displayed on the row that produced it, and a
correction in flight SHALL disable only that row's correction controls. The
workspace-level error line SHALL NOT be the only place a row-level failure
appears, and one row's failure SHALL NOT clear another row's error or block
another row's correction.

#### Scenario: A row-level failure stays on its row

- **WHEN** a correction on one row fails validation
- **THEN** the error is rendered within that row and remains visible while the
  reviewer edits the row
- **AND** other rows remain editable

#### Scenario: Only the saving row is disabled

- **WHEN** a correction is in flight on one row
- **THEN** that row's correction controls report saving and are disabled
- **AND** the correction controls of other rows remain enabled

### Requirement: A corrected row is identifiable without reading verification status

A review row SHALL state that a person restated the result whenever an active
override exists, independently of verification status, and SHALL continue to
show what the document printed. The workspace SHALL NOT present a corrected but
unverified row as verified, and SHALL NOT infer correction from
`manually_corrected` alone.

#### Scenario: A corrected pending row is labelled as restated

- **WHEN** a row carries an active override and its revision is `pending`
- **THEN** the row states that the result was restated by a person and its
  verification chip still reads as not verified

#### Scenario: Raw evidence remains visible on a corrected row

- **WHEN** a row carries an active override
- **THEN** the row shows the corrected measurement and the printed evidence it
  replaces
