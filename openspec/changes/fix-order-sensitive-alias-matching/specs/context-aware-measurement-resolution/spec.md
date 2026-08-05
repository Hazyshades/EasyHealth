## MODIFIED Requirements

### Requirement: Authoritative candidate generation
The system SHALL generate measurement candidates only from a Registry 2.0 definition key or an alias that the EH-110 authority policy marks active, source-applicable, and eligible for the input. Candidate generation SHALL NOT depend on the token order of the raw label: an input whose normalization token is a reordering of an admission-eligible alias's token SHALL generate the same candidate set as the ordered spelling. Each generated candidate SHALL record the label authority identifier, match type, approval state, provenance, and fixture references. A deprecated, inactive, unapproved, or source-inapplicable alias SHALL not generate a candidate.

An extraction or LLM-proposed key MAY be recorded as a candidate hint, but it SHALL NOT satisfy the authoritative-label requirement for a `resolved` outcome. A provisional alias or provisional definition SHALL NOT independently produce a `resolved` outcome.

#### Scenario: Active reviewed alias generates a candidate
- **WHEN** a raw label matches an active, reviewed, laboratory-applicable alias for a reviewed definition
- **THEN** the resolver SHALL include that definition with structured label-authority evidence

#### Scenario: Deprecated alias is rejected before scoring
- **WHEN** a raw label matches only a deprecated or source-inapplicable alias
- **THEN** the resolver SHALL produce no candidate from that alias and SHALL return `unmapped` when no other authorized candidate exists

#### Scenario: Extraction-only proposal remains incomplete
- **WHEN** an input has no authoritative raw-label match but has a proposed key for a reviewed definition
- **THEN** the resolver SHALL record the proposal as non-authoritative evidence and SHALL NOT return `resolved`

#### Scenario: Reordered parenthetical label generates the same candidates
- **WHEN** the resolver receives `Alanine aminotransferase (ALT)` and separately `ALT (alanine aminotransferase)`, with identical unit, specimen, value kind and reference evidence
- **THEN** both inputs SHALL generate the same candidate key set
- **AND** both SHALL produce the same outcome, the same missing axes, and the same conflict codes

#### Scenario: Label phrasing does not change the outcome across reprocessing
- **WHEN** the same source document is reprocessed and the extractor phrases a label with the abbreviation in a different position
- **THEN** the resolver outcome SHALL NOT change solely because of that repositioning

## ADDED Requirements

### Requirement: Reordering-invariance regression corpus
The resolver regression suite SHALL cover, for every launch-corpus label that contains a parenthetical abbreviation, both the printed ordering and the abbreviation-last ordering, and SHALL assert that the two produce identical outcomes, candidate key sets, missing axes and conflict codes. The suite SHALL fail when any label resolves in one ordering and returns `unmapped` in the other.

#### Scenario: Both orderings agree for every affected launch label
- **WHEN** the reordering-invariance suite runs over the launch corpus
- **THEN** every covered label SHALL report the same outcome in both orderings

#### Scenario: A regression in ordering invariance fails the suite
- **WHEN** a catalog or resolver change makes one ordering of a covered label return `unmapped` while the other resolves
- **THEN** the suite SHALL fail and name the label and both outcomes
