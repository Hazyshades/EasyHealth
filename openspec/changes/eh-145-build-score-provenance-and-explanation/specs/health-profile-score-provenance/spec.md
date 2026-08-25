## ADDED Requirements

### Requirement: Score provenance SHALL be deterministic and versioned

The Health Profile assessment payload SHALL include a stable score algorithm version and per-system provenance that is produced by the same readiness and contribution selection logic as the displayed score. The payload SHALL remain additive to the existing score, confidence, readiness, marker, source, and job fields.

#### Scenario: Scoreable system reports the algorithm and contributors

- **WHEN** a named system satisfies every configured readiness group and produces a numeric `state_score`
- **THEN** the system provenance includes `algorithm_version`, every readiness group, and one contributor entry for each selected score-contribution group
- **AND** each contributor includes its observation identity, assessment key, calculated contribution value, marker status, lab reference range, and observed date
- **AND** the contributor list is exactly the set of markers used to calculate the returned score

#### Scenario: Contribution alternatives do not receive duplicate votes

- **WHEN** two usable markers belong to the same score-contribution group
- **THEN** the same deterministic group member selected by the score calculation appears as the contributor
- **AND** the other marker appears in the system exclusion list with a duplicate-contribution reason
- **AND** the returned numeric score is unchanged by the explanation projection

#### Scenario: Null score remains explainable

- **WHEN** a named system has observations but one or more required readiness groups are not satisfied
- **THEN** `state_score` is null
- **AND** provenance contains all readiness groups with their status and acceptable keys
- **AND** no observation is presented as a contributor to a numeric score
- **AND** otherwise usable candidates are marked as unavailable because score readiness is incomplete

### Requirement: Readiness and exclusion reasons SHALL be machine-readable

Every observation that does not contribute to a named-system score SHALL be represented either in that system's provenance or in the profile-level excluded-observation list with a stable reason code. Reasons SHALL distinguish assessment admission failures from score-selection failures and SHALL not imply that the source laboratory result is invalid.

#### Scenario: Pre-projection assessment failure is retained

- **WHEN** a laboratory observation is rejected from Health Profile projection because it has no active revision, incomplete resolution, candidate-only identity, or no eligible assessment binding
- **THEN** the profile-level provenance includes the observation with the existing exact assessment exclusion reason
- **AND** the item retains its source document identity and page when available
- **AND** the UI describes it as excluded from this assessment rather than invalid laboratory data

#### Scenario: Marker-level score exclusion is retained

- **WHEN** a projected marker is non-numeric, has no usable document reference range, has a specimen mismatch, is non-core/supporting, is outside any contribution group, or belongs to a non-scoreable system
- **THEN** the marker appears in the relevant system exclusion list with a specific stable reason code
- **AND** no missing reference range is invented
- **AND** the marker remains available as factual data in the existing marker list

#### Scenario: Profile-level list includes unassigned exclusions

- **WHEN** an excluded observation cannot be associated with a reviewed body-system binding
- **THEN** it remains in `score_provenance.excluded_observations` with an unassigned/general system indicator
- **AND** the profile UI provides an expandable list for the item even when no body-system drawer can display it

### Requirement: Provenance SHALL identify the document evidence used

Each contributor and excluded observation SHALL carry the source document id when available, source page, source snippet, and validated source-region metadata. A source link SHALL navigate to the existing document viewer and preserve the recorded page; exact rectangles MAY be indicated only when the existing exact, page-coherent source-region predicate passes.

#### Scenario: Contributor links to its source page

- **WHEN** a score contributor has a source document and source page
- **THEN** the explanation shows the document filename, page, and lab reference range used
- **AND** an accessible source link opens that document on the recorded page with existing Health Profile return context

#### Scenario: Page-only provenance remains safe

- **WHEN** source-region metadata is missing, fuzzy, ambiguous, unresolved, invalid, or on a different page from the recorded source page
- **THEN** the explanation provides the document/page link when possible
- **AND** it labels the evidence as page-only or unavailable
- **AND** it does not render or describe the rectangle as an exact visual match

#### Scenario: Source range is shown without clinical interpretation

- **WHEN** a contributor is displayed
- **THEN** the explanation shows the document-native reference bounds and the calculated contribution value
- **AND** it does not add a diagnosis, disease label, or recommendation

### Requirement: Health Profile UI SHALL expose expandable explanation evidence

The body-system drawer SHALL include an accessible expandable score-explanation section. The section SHALL show the algorithm version, all readiness groups, contributors, exclusions, document references, and an explicit empty state when no observation contributed. The profile page SHALL expose excluded observations not reachable through a selected drawer.

#### Scenario: User expands a system explanation

- **WHEN** the user selects a body system and expands its score explanation
- **THEN** the user can inspect every readiness group, contributor, contribution-group id, reference range, source page/link, and exclusion reason for that system
- **AND** the existing factual marker and primary-source sections remain available

#### Scenario: User reviews excluded observations globally

- **WHEN** the profile payload contains excluded observations that are not shown in a rendered system drawer
- **THEN** the profile page shows an expandable excluded-observation section
- **AND** each item includes the reason, source context, and a source link when available

#### Scenario: Explanation is unavailable for a legacy cached payload

- **WHEN** the API returns an older immutable assessment payload without score provenance
- **THEN** the existing score and factual profile remain usable
- **AND** the UI does not fabricate contributors, reasons, algorithm versions, or source ranges
