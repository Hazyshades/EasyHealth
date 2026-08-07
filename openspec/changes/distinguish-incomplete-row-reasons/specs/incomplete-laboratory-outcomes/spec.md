## MODIFIED Requirements

### Requirement: Authoritative four-outcome serialization
The system SHALL serialize laboratory semantic identity from the active normalization revision using exactly `resolved`, `partial`, `ambiguous`, or `unmapped`. The serialized outcome SHALL include verification status, mapping confidence and band, missing axes, conflict/support reason codes, candidate count, an incomplete reason class for every non-`resolved` outcome, relevant policy/version metadata, and consumer eligibility with exclusion reasons.

Only an active `resolved` revision that passes the reviewed Registry 2.0 binding boundary SHALL expose a non-null measurement definition or analyte identity. Candidate keys contained in decision evidence SHALL NOT be serialized or interpreted as active identity for `partial`, `ambiguous`, or `unmapped` rows.

A current-catalog preview MAY be returned for an extracted row without an active revision, but it SHALL be labeled `preview`, SHALL remain pending/unverified, and SHALL NOT grant downstream eligibility. The reason class SHALL be serialized for a preview on the same terms as for an active revision.

#### Scenario: Active partial revision wins over current preview
- **WHEN** an extracted row currently previews as resolved but its active persisted normalization revision is `partial`
- **THEN** the API SHALL serialize `partial`, null concrete identity, the persisted missing/conflict evidence, and `source = active_revision`

#### Scenario: Candidate evidence remains non-concrete
- **WHEN** an ambiguous or partial trace contains one or more candidate definition keys
- **THEN** the public outcome SHALL expose only candidate count and safe reason summaries, while measurement definition and analyte identity remain null

#### Scenario: Unaccepted row uses preview safely
- **WHEN** a current extracted row has no active normalization revision
- **THEN** the review API MAY serialize a current resolver preview with `source = preview`, but all definition-specific consumer eligibility SHALL be false

#### Scenario: Preview row carries its reason class
- **WHEN** an extracted row with no active normalization revision serializes a `partial` preview
- **THEN** the payload SHALL include the reason class explaining that outcome

### Requirement: Safe English wording and technical details
The system SHALL use distinct English labels and guidance for all four outcomes. `resolved` SHALL use `Matched measurement`; `partial` SHALL use `More details needed`; `ambiguous` SHALL use `Multiple possible matches`; and `unmapped` SHALL use `Measurement not recognized`.

Guidance for a non-`resolved` outcome SHALL be specific to its reason class and SHALL be accurate about who can act. Guidance SHALL NOT state that context is missing when the outstanding condition is catalog review. Where the reason class is `axis_not_stated`, the guidance SHALL name each missing axis in clinical English at row level, without requiring technical details to be expanded.

Technical details SHALL explain that mapping confidence is classification evidence rather than medical certainty. They SHALL include verification state, confidence, missing axes, conflict/support reason labels, the reason class, candidate count, and version metadata. Incomplete-state details SHALL NOT present internal candidate keys, selected evidence keys, or conversion metadata as active identity. Full support traces remain outside this capability.

Reason and axis labels SHALL be rendered in clinical English. An unlabelled internal code or axis token SHALL NOT reach the reviewer.

#### Scenario: Partial guidance explains incompleteness
- **WHEN** a row is partial because the document did not state a required axis
- **THEN** the UI SHALL explain that the result is recognized, name the missing axis, and state that the raw result remains available

#### Scenario: Catalog-blocked partial guidance does not claim missing context
- **WHEN** a row is partial solely because its definition maturity is not `reviewed`
- **THEN** the UI SHALL state that the measurement is recognized and awaiting catalog review
- **AND** SHALL NOT state that required context is missing

#### Scenario: Technical details are sanitized
- **WHEN** a user expands technical details for an incomplete row
- **THEN** the UI SHALL show reasons and versions without showing a candidate key as the active measurement identity

#### Scenario: Every rendered reason has a clinical label
- **WHEN** any reason code or clinical axis is rendered to a reviewer
- **THEN** it SHALL appear as clinical English rather than an internal token

### Requirement: Privacy-safe outcome metrics
The system SHALL emit one aggregateable `resolution_outcome` metric after a new normalization revision is written. An idempotently reused write SHALL NOT emit a duplicate metric.

The metric SHALL be limited to outcome, incomplete reason class, mapping confidence band, sorted missing axes, sorted conflict reason codes, write kind, resolver/catalog/compatibility versions, and stable consumer exclusion reasons. It SHALL NOT contain profile, document, observation, revision, or extracted-row identifiers; raw labels, values, units, reference ranges, source text, filenames, candidate keys; or any other patient-linked content.

#### Scenario: New partial revision emits safe metric
- **WHEN** a new partial revision is successfully written
- **THEN** one metric SHALL record `partial`, its reason class, missing axes/reason codes, versions, and exclusions without raw or identifying data

#### Scenario: Retry reuses existing revision
- **WHEN** an idempotent acceptance retry reuses an existing normalization revision
- **THEN** the system SHALL NOT emit a second outcome metric

#### Scenario: Reason class is a closed enumeration
- **WHEN** the metric records a reason class
- **THEN** the value SHALL be one of the defined classes and SHALL carry no free text
