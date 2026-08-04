# Incomplete Laboratory Outcomes

## Purpose
Preserve recognized-but-incomplete, conflicting, and unknown laboratory results as first-class safe product states without guessing a concrete Registry 2.0 identity or hiding raw evidence.

## Requirements

### Requirement: Authoritative four-outcome serialization
The system SHALL serialize laboratory semantic identity from the active normalization revision using exactly `resolved`, `partial`, `ambiguous`, or `unmapped`. The serialized outcome SHALL include verification status, mapping confidence and band, missing axes, conflict/support reason codes, candidate count, relevant policy/version metadata, and consumer eligibility with exclusion reasons.

Only an active `resolved` revision that passes the reviewed Registry 2.0 binding boundary SHALL expose a non-null measurement definition or analyte identity. Candidate keys contained in decision evidence SHALL NOT be serialized or interpreted as active identity for `partial`, `ambiguous`, or `unmapped` rows.

A current-catalog preview MAY be returned for an extracted row without an active revision, but it SHALL be labeled `preview`, SHALL remain pending/unverified, and SHALL NOT grant downstream eligibility.

#### Scenario: Active partial revision wins over current preview
- **WHEN** an extracted row currently previews as resolved but its active persisted normalization revision is `partial`
- **THEN** the API SHALL serialize `partial`, null concrete identity, the persisted missing/conflict evidence, and `source = active_revision`

#### Scenario: Candidate evidence remains non-concrete
- **WHEN** an ambiguous or partial trace contains one or more candidate definition keys
- **THEN** the public outcome SHALL expose only candidate count and safe reason summaries, while measurement definition and analyte identity remain null

#### Scenario: Unaccepted row uses preview safely
- **WHEN** a current extracted row has no active normalization revision
- **THEN** the review API MAY serialize a current resolver preview with `source = preview`, but all definition-specific consumer eligibility SHALL be false

### Requirement: Raw result and provenance visibility
The system SHALL preserve and expose raw laboratory evidence independently of semantic resolution. For every outcome, the document review surface SHALL retain the source label, raw value text or numeric value, raw and normalized unit where present, raw reference range, specimen, modifier, page/source text, extraction confidence, extraction model/version, and stable extracted-row identity available from the existing provenance contract.

The UI SHALL render raw evidence before mapping explanation and SHALL NOT replace an incomplete raw result with a candidate display name, converted value, inferred unit, inferred specimen, or inferred reference range.

#### Scenario: Unmapped row remains visible
- **WHEN** no authorized Registry 2.0 candidate matches a laboratory row
- **THEN** the document review surface SHALL show the original result and provenance with `Measurement not recognized`

#### Scenario: Partial row keeps missing context visible
- **WHEN** a recognized row is partial because a required unit, value kind, specimen, modifier, timing, or method is missing
- **THEN** the UI SHALL preserve the raw result and list the missing context without claiming compatibility or conflict

#### Scenario: Ambiguous row does not choose a display identity
- **WHEN** multiple reviewed candidates remain admissible
- **THEN** the UI SHALL show `Multiple possible matches`, preserve the source result, and SHALL NOT render one candidate as the confirmed measurement

### Requirement: Safe English wording and technical details
The system SHALL use distinct English labels and guidance for all four outcomes. `resolved` SHALL use `Matched measurement`; `partial` SHALL use `More details needed`; `ambiguous` SHALL use `Multiple possible matches`; and `unmapped` SHALL use `Measurement not recognized`.

Technical details SHALL explain that mapping confidence is classification evidence rather than medical certainty. They SHALL include verification state, confidence, missing axes, conflict/support reason labels, candidate count, and version metadata. Incomplete-state details SHALL NOT present internal candidate keys, selected evidence keys, or conversion metadata as active identity. Full support traces remain outside this capability.

#### Scenario: Partial guidance explains incompleteness
- **WHEN** a row is partial
- **THEN** the UI SHALL explain that the result is recognized but required context is missing and that the raw result remains available

#### Scenario: Technical details are sanitized
- **WHEN** a user expands technical details for an incomplete row
- **THEN** the UI SHALL show reasons and versions without showing a candidate key as the active measurement identity

### Requirement: Incomplete rows remain reprocessable
The system SHALL keep a document-level **Reprocess document** action available for a document containing current `partial`, `ambiguous`, or `unmapped` laboratory rows. Reprocessing SHALL use the existing full-document pipeline, SHALL supersede current extraction rows according to the existing lineage contract, and SHALL preserve historical raw evidence and append-only normalization revisions.

EH-112 SHALL NOT introduce row-level reprocessing, delete prior decisions, mutate historical outcomes, or change the EH-104/EH-106 acceptance and promotion primitive.

#### Scenario: User reprocesses an incomplete document
- **WHEN** a user selects **Reprocess document** for a document with incomplete laboratory outcomes
- **THEN** the system SHALL queue a new full pipeline run while the prior raw result and normalization history remain durable

#### Scenario: Reprocess request has no candidate override
- **WHEN** the document reprocess endpoint is called
- **THEN** the request SHALL NOT accept a candidate measurement key or use prior decision evidence as forced identity

### Requirement: Definition-specific consumer exclusion
The system SHALL derive consumer eligibility from the active reviewed Registry 2.0 binding. Only eligible `resolved` rows SHALL enter definition-specific trend keys or series, conversion, abnormality interpretation, report biomarker context, or structured biomarker context.

Health Profile SHALL additionally require a reviewed assessment binding with `compatibility = compatible` before a row can affect readiness, data confidence, highlighted findings, state scores, or holistic assessment inputs. `partial`, `ambiguous`, and `unmapped` rows SHALL remain list-visible where raw results are shown but SHALL be excluded from all definition-specific consumers with a stable exclusion reason.

#### Scenario: Partial row is excluded from trends
- **WHEN** a partial row has a candidate key only in decision evidence
- **THEN** it SHALL remain visible in the result list but SHALL NOT appear in a trend selector or chart series

#### Scenario: Ambiguous row cannot affect assessment
- **WHEN** an ambiguous row has a high mapping confidence for its leading candidate
- **THEN** it SHALL NOT affect Health Profile readiness, confidence, highlights, or scores

#### Scenario: Resolved display-only binding is not score eligible
- **WHEN** a resolved reviewed definition lacks a reviewed assessment-compatible binding
- **THEN** it MAY remain visible and trend-eligible where appropriate but SHALL be assessment-ineligible with `assessment_binding_ineligible`

### Requirement: Privacy-safe outcome metrics
The system SHALL emit one aggregateable `resolution_outcome` metric after a new normalization revision is written. An idempotently reused write SHALL NOT emit a duplicate metric.

The metric SHALL be limited to outcome, mapping confidence band, sorted missing axes, sorted conflict reason codes, write kind, resolver/catalog/compatibility versions, and stable consumer exclusion reasons. It SHALL NOT contain profile, document, observation, revision, or extracted-row identifiers; raw labels, values, units, reference ranges, source text, filenames, candidate keys; or any other patient-linked content.

#### Scenario: New partial revision emits safe metric
- **WHEN** a new partial revision is successfully written
- **THEN** one metric SHALL record `partial`, its missing axes/reason codes, versions, and exclusions without raw or identifying data

#### Scenario: Retry reuses existing revision
- **WHEN** an idempotent acceptance retry reuses an existing normalization revision
- **THEN** the system SHALL NOT emit a second outcome metric

### Requirement: Four-outcome end-to-end regression corpus
The system SHALL maintain deterministic fixtures for resolved, partial, ambiguous, and unmapped laboratory outcomes. The fixtures SHALL verify authoritative serialization, nullable identity, raw-evidence preservation, English UI wording, technical-detail sanitization, document-level reprocess availability, trend exclusion, assessment exclusion, and metric field allowlisting.

The EH-106 consumer and EH-111 compatibility suites SHALL remain regression gates so EH-112 cannot weaken active-revision, conversion, or compatibility boundaries.

#### Scenario: Four-outcome corpus passes
- **WHEN** the EH-112 verifier runs
- **THEN** all four outcomes SHALL preserve their expected public state and no incomplete fixture SHALL obtain concrete identity, conversion, trend, or assessment eligibility

#### Scenario: Candidate key leak regression
- **WHEN** an incomplete fixture includes candidate keys in its persisted trace
- **THEN** the verifier SHALL fail if a public identity field, user-facing confirmed label, or metric payload exposes one as active identity
