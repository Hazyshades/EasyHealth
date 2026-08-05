## MODIFIED Requirements

### Requirement: Review shows provenance

The extraction review UI SHALL show source page and source text snippet when
present on the extracted row, and SHALL state explicitly when no source page was
recorded. Provenance SHALL be shown both on the row and, for the current row, in
the document pane.

#### Scenario: Source snippet displayed

- **WHEN** an extracted biomarker includes `source_page` and `source_text`
- **THEN** the review UI surfaces page number and snippet for user verification

#### Scenario: Missing source page is stated

- **WHEN** an extracted biomarker has no `source_page`
- **THEN** the review UI labels the row as having no recorded source page rather
  than omitting provenance

### Requirement: Review UI separates extraction and mapping certainty

The UI SHALL display resolver state, verification state, confidence band,
evidence, release versions, and revision relationship without presenting mapping
confidence as extraction or clinical certainty. Resolver state and verification
state SHALL be presented as two independent indicators that are readable without
opening technical details, and an absent verification decision SHALL read as not
yet verified rather than be omitted.

#### Scenario: Partial specialty result is reviewed

- **WHEN** a specialty result is recognized but incomplete
- **THEN** the UI explains missing metadata and permits raw acceptance
- **AND** does not imply that the printed result itself is invalid

#### Scenario: Resolution and verification are read separately

- **WHEN** a row is resolved but its normalization revision is still pending
- **THEN** the row shows the matched-measurement state and the not-yet-verified
  state as two distinct indicators

### Requirement: Technical mapping controls use progressive disclosure

The ordinary review action SHALL not require registry, resolver, specimen, or
candidate knowledge. Candidate evidence, versions, manual mapping, and
correction history SHALL be available under optional technical details, using
the same disclosure for extracted rows and for the observations-only recovery
list. Manual correction MUST require source evidence and MUST NOT encourage
selection of an unstated specimen.

#### Scenario: Sample antibody result has missing specimen

- **WHEN** a reviewer sees a recognized qualitative antibody result without specimen evidence
- **THEN** the primary UI permits raw acceptance without a mapping decision
- **AND** any manual specimen-specific options remain inside technical review with an evidence warning

#### Scenario: Observations-only recovery uses the same disclosure

- **WHEN** the document has no current extracted rows and the recovery list is
  shown
- **THEN** each observation exposes the same technical-details disclosure as an
  extracted row

## ADDED Requirements

### Requirement: Raw acceptance is offered explicitly

For every row awaiting review whose resolver outcome is not `resolved`, the
review UI SHALL state that the result can be accepted exactly as reported and
that choosing a measurement is optional. The acceptance action SHALL remain
enabled for such rows without any mapping decision, and the acceptance control
SHALL restate that accepted results are preserved as reported.

#### Scenario: Incomplete row advertises raw acceptance

- **WHEN** a row awaiting review is partial, ambiguous or unmapped
- **THEN** the row states that it can be accepted as reported and that mapping is
  optional

#### Scenario: Accepting requires no mapping

- **WHEN** the reviewer accepts a selection containing only incomplete rows
- **THEN** the acceptance proceeds without requiring a measurement to be chosen

#### Scenario: Stored rows do not advertise raw acceptance

- **WHEN** a row has already been accepted and stored
- **THEN** the raw-acceptance affordance is not shown for that row
