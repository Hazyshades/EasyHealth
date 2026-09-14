## ADDED Requirements

### Requirement: Reprocessing compares stored prior with current next

A reprocessing diff SHALL read the prior input identity hash/version, Resolver outcome tuple, and release metadata from the stored active revision. It SHALL compute the next values from the current prepared evidence and deployed release. It SHALL never substitute a hash recomputed from the current row for the stored prior hash.

#### Scenario: Prior hash remains historical

- **WHEN** the current prepared evidence differs from the evidence that produced the active revision
- **THEN** the diff prior snapshot SHALL retain the active revision's stored hash and identity-format version
- **AND** the next snapshot SHALL carry the current prepared evidence hash/version

#### Scenario: Next reprocessing input uses the shared seam

- **WHEN** reprocessing evaluates the current extracted row
- **THEN** the next input, Resolver evaluation, trace, and identity hash SHALL
  derive from one shared prepared evidence record
- **AND** the prior snapshot SHALL remain entirely sourced from stored
  revision metadata

### Requirement: Input, outcome, and release changes are independent facts

Each reprocessing dry-run row SHALL record three independent change facts:

- `inputChange`: `changed`, `unchanged`, or `unavailable` when identity formats cannot be compared;
- `outcomeChange`: `changed` or `unchanged` for the explicit Resolver outcome tuple;
- `releaseChange`: `changed`, `unchanged`, or `unavailable` when prior release metadata is absent.

The facts SHALL be computed independently and SHALL not be collapsed into one hash-equality result.

#### Scenario: Input changes while outcome stays equal

- **WHEN** prepared evidence changes but Resolver result, definition key, analyte key, and confidence band remain equal
- **THEN** `inputChange` SHALL be `changed`
- **AND** `outcomeChange` SHALL be `unchanged`
- **AND** the diff SHALL not mislabel the input as historically unchanged

#### Scenario: Release changes without input or outcome change

- **WHEN** the prepared input and Resolver outcome tuple remain equal but the deployed Registry/resolver release tuple changes
- **THEN** `inputChange` SHALL be `unchanged`
- **AND** `outcomeChange` SHALL be `unchanged`
- **AND** `releaseChange` SHALL be `changed`

#### Scenario: Outcome changes without input change

- **WHEN** the prepared input identity remains equal but the current release produces a different Resolver outcome tuple
- **THEN** `inputChange` SHALL be `unchanged`
- **AND** `outcomeChange` SHALL be `changed`
- **AND** `releaseChange` SHALL be recorded independently

### Requirement: Incompatible identity comparison is unavailable

Reprocessing SHALL report `inputChange = unavailable` when either side lacks a supported identity-format version or when the formats are not declared compatible. It SHALL report `releaseChange = unavailable` when the prior release tuple is absent. Unavailable SHALL NOT be treated as equality and SHALL NOT be used to infer a changed input.

#### Scenario: Legacy prior blocks automatic equality

- **WHEN** a legacy active revision has a hash but no supported identity-format version
- **THEN** the input comparison SHALL be unavailable
- **AND** the dry-run SHALL retain both the legacy hash and the current next hash without rewriting the legacy row

### Requirement: Revision application follows an explicit contract

A reprocessing dry-run SHALL be non-mutating and SHALL retain all three change facts regardless of apply eligibility. Revision creation and activation SHALL be separate explicit decisions. A hash comparison alone SHALL NOT create, activate, or supersede a revision.

The default automatic policy SHALL make an input or outcome change apply-eligible subject to existing manual-decision protections. A release-only change SHALL be audit-only unless an explicit release-refresh intent is selected. An unavailable comparison SHALL not qualify a row for automatic apply. Any applied row SHALL use the service-only normalization writer and its expected-active CAS boundary.

#### Scenario: Changed input with equal outcome creates an explicit candidate

- **WHEN** `inputChange = changed`, `outcomeChange = unchanged`, and the row is not protected by a manual decision
- **THEN** the dry-run SHALL mark the row as input-changed
- **AND** apply SHALL create and activate a new append-only revision only when the explicit apply decision permits it

#### Scenario: Release-only change is not implicit mutation

- **WHEN** `releaseChange = changed` while input and outcome are unchanged
- **THEN** the dry-run SHALL record the release change
- **AND** default apply SHALL not create or activate a revision
- **AND** an explicit release-refresh intent MAY select a separate apply decision

#### Scenario: Manual protection blocks automatic activation

- **WHEN** input or outcome changes for an active user-verified or manually-corrected revision under default protection
- **THEN** the dry-run SHALL retain the change facts and classify the row as protected
- **AND** automatic apply SHALL not supersede or activate a new revision

### Requirement: Applied reprocessing remains append-only

When the explicit apply contract selects a reprocessing candidate, the system SHALL create a new normalization revision through the existing service-only writer, link the prior revision, and activate the new revision atomically. It SHALL not update the historical revision's hash, identity version, decision trace, or release metadata in place.

#### Scenario: Applied candidate preserves prior history

- **WHEN** an operator applies an eligible reprocessing row with a successful expected-active check
- **THEN** a new revision is appended and activated
- **AND** the prior revision remains unchanged and auditable
- **AND** the reprocessing row records the applied revision id

### Requirement: EH-164 remains a reprocessing invariant

Reprocessing SHALL preserve comparator/detection-limit markers as accepted textual Health Profile evidence with `value: null` and `value_kind: "text"`; no reprocessing apply decision SHALL make such a marker a numeric score or trend contributor.

#### Scenario: Reprocessing a censored marker

- **WHEN** a current prepared row contains a comparator text marker
- **THEN** its next observation projection SHALL retain textual marker semantics
- **AND** Health Profile numeric score and trend consumers SHALL continue to exclude it
