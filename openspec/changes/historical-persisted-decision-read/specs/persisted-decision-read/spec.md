## ADDED Requirements

### Requirement: Read source and quality are orthogonal

The persisted-decision reader SHALL return independent `source` and `quality` fields. `source` SHALL be `persisted`, `preview`, or `none`; `quality` SHALL be `available`, `unavailable`, or `conflict`. `source` SHALL describe where the decision came from, while `quality` SHALL describe completeness and internal coherence of the available data. A `preview` result SHALL be explicitly marked `notPersisted`.

#### Scenario: Complete active revision is persisted and available

- **WHEN** an observation has one active coherent normalization revision with valid stored decision evidence
- **THEN** the read result SHALL have `source = persisted` and `quality = available`
- **AND** it SHALL identify the stored revision as the decision source

#### Scenario: Persisted data can be unavailable or conflicting

- **WHEN** an active revision lacks required historical evidence or contains disagreeing persisted fields
- **THEN** the result SHALL retain `source = persisted`
- **AND** it SHALL report `quality = unavailable` or `quality = conflict` respectively
- **AND** it SHALL not encode either condition as a different source

#### Scenario: No persisted decision and no preview exist

- **WHEN** an observation has no active revision and the caller supplies no preview
- **THEN** the result SHALL have `source = none` and `quality = unavailable`
- **AND** it SHALL not present a current Resolver explanation

### Requirement: Active persisted decisions are read without Resolver recomputation

When an active normalization revision exists, the reader SHALL select that revision and derive outcome, identity, evidence, trace, release metadata, and consumer eligibility from persisted data. It SHALL NOT invoke the current Resolver, current panel policy, or current alias evaluation for the active read.

#### Scenario: Current Resolver would produce a different outcome

- **WHEN** the current Registry or Resolver would produce a different result for the same source row than the active persisted revision
- **THEN** the read result SHALL expose the persisted outcome and stored trace
- **AND** it SHALL not expose the current Resolver result as the historical decision

#### Scenario: All persisted consumers share one read

- **WHEN** normalization review, document biomarker details, reports, and structured context read the same active observation
- **THEN** each consumer SHALL receive the same persisted outcome and source/quality result
- **AND** no consumer SHALL independently recompute the active decision

### Requirement: Persisted inconsistencies remain explicit conflicts

The reader SHALL check available persisted outcome, selected identity, operational evidence, technical trace, trace schema, input identity metadata, release metadata, and source lineage for consistency. When persisted fields disagree, it SHALL return `quality = conflict` with stable conflict codes and preserve the conflicting values for technical inspection. It SHALL not choose a winner, downgrade conflict to unavailable, repair rows, or invoke the current Resolver.

#### Scenario: Outcome disagrees with stored trace

- **WHEN** an active revision has `resolver_result = resolved` but its persisted technical trace has a different outcome
- **THEN** the read result SHALL have `source = persisted` and `quality = conflict`
- **AND** it SHALL identify the outcome/trace disagreement without recomputing the decision

#### Scenario: Selected identity disagrees with winning candidate

- **WHEN** a resolved revision's stored measurement definition key differs from the technical trace winning candidate
- **THEN** the read result SHALL preserve the stored values and report a conflict code
- **AND** it SHALL not expose either value as silently corrected identity

### Requirement: Missing historical data is unavailable without live fallback

A persisted read SHALL report `quality = unavailable` when required legacy trace data, supported identity metadata, trace schema data, or current catalog enrichment is unavailable. It SHALL preserve safe stored outcome/raw evidence where possible and SHALL not substitute a current Resolver trace or outcome.

#### Scenario: Legacy revision has no technical trace

- **WHEN** an active historical revision predates persisted technical traces
- **THEN** the read result SHALL have `source = persisted` and `quality = unavailable`
- **AND** it SHALL explain that the historical technical trace is unavailable
- **AND** it SHALL not display a recomputed current trace

#### Scenario: Current catalog cannot enrich historical identity

- **WHEN** a stored measurement definition key is absent or no longer satisfies current catalog enrichment requirements
- **THEN** the read result SHALL retain the stored outcome, key, and trace
- **AND** it SHALL report unavailable catalog enrichment
- **AND** concrete consumers requiring a current binding SHALL fail closed

### Requirement: Preview is explicit and non-persisted

The reader MAY evaluate a current Resolver preview only when no active persisted revision exists and the caller explicitly requests preview. A preview SHALL have `source = preview`, `quality = available` when its in-memory result is coherent, and `notPersisted = true`. It SHALL remain pending/unverified and SHALL not grant definition-specific eligibility.

#### Scenario: Unaccepted row receives preview

- **WHEN** an extracted row has no active normalization revision and the caller explicitly requests a current preview
- **THEN** the result SHALL be marked `source = preview` and `notPersisted = true`
- **AND** the result SHALL not be presented as historical persisted rationale or downstream eligibility

#### Scenario: Active revision suppresses preview

- **WHEN** an active revision exists and a caller also supplies a current preview
- **THEN** the reader SHALL ignore the preview for the active read
- **AND** the result SHALL retain `source = persisted`

### Requirement: EH-164 marker semantics survive read quality states

The persisted-decision reader SHALL preserve comparator/detection-limit markers as accepted textual Health Profile evidence with `value: null` and `value_kind: "text"`. An unavailable or conflicting read SHALL not remove the marker or convert it into a numeric score or trend contribution.

#### Scenario: Conflicting marker decision remains textual

- **WHEN** a comparator marker is attached to an active persisted observation whose decision data is conflicting
- **THEN** the raw marker SHALL remain available as text evidence
- **AND** numeric score and trend consumers SHALL not receive a fabricated numeric value
