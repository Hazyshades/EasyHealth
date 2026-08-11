## MODIFIED Requirements

### Requirement: Authoritative candidate generation

The system SHALL generate measurement candidates only from a Registry 2.0 definition key or an alias that the alias authority policy marks active, source-applicable, and eligible for the input. Alias comparison for multilingual labels SHALL use the measurement-label normalization contract and the original document label (`rawLabel` from verbatim extraction), not identifier-token stripping that erases non-Latin scripts. Each generated candidate SHALL record the label authority identifier, match type, approval state, provenance, locale when present on the alias, and fixture references. A deprecated, inactive, unapproved, or source-inapplicable alias SHALL not generate a candidate.

An extraction or LLM-proposed key or English display name MAY be recorded as a candidate hint (soft assist), but it SHALL NOT satisfy the authoritative-label requirement for a `resolved` outcome. A provisional alias or provisional definition SHALL NOT independently produce a `resolved` outcome. Soft assist MUST NOT automatically turn an `unmapped` or `ambiguous` row into `resolved` without sufficient registry alias or other authoritative evidence already required for concrete resolution.

#### Scenario: Active reviewed alias generates a candidate

- **WHEN** a raw label matches an active, reviewed, laboratory-applicable alias for a reviewed definition
- **THEN** the resolver SHALL include that definition with structured label-authority evidence

#### Scenario: Deprecated alias is rejected before scoring

- **WHEN** a raw label matches only a deprecated or source-inapplicable alias
- **THEN** the resolver SHALL produce no candidate from that alias and SHALL return `unmapped` when no other authorized candidate exists

#### Scenario: Extraction-only proposal remains incomplete

- **WHEN** an input has no authoritative raw-label match but has a proposed key for a reviewed definition
- **THEN** the resolver SHALL record the proposal as non-authoritative evidence and SHALL NOT return `resolved`

#### Scenario: Russian verbatim label matches without English key

- **WHEN** the raw label is a reviewed RU alias value and the LLM key is missing or wrong
- **THEN** the resolver MAY still generate the authorized candidate from the raw-label alias
- **AND** MUST NOT require the English key for authoritative admission

#### Scenario: Soft assist cannot alone resolve

- **WHEN** only an LLM English key hint points at a reviewed definition and no authorized alias matches the verbatim raw label
- **THEN** the outcome MUST NOT be `resolved`

## ADDED Requirements

### Requirement: Unknown measurements stay unmapped without catalog mutation

When no authorized alias or definition-key authority matches the input, the system SHALL return `unmapped`, preserve the raw extracted observation for review, and MUST NOT automatically create a new catalog measurement definition, analyte, or alias from the uploaded document. Later aggregation into a separate manual candidate-catalog workflow is out of band for automatic resolution.

#### Scenario: Unknown Spanish label remains raw

- **WHEN** a Spanish lab row label has no authorized alias
- **THEN** the resolver returns `unmapped` with null measurement definition key
- **AND** no registry write adds a definition from that row

#### Scenario: Needs-review preserves unknown row

- **WHEN** an unmapped row is shown in document review
- **THEN** the original label, value, unit, and reference range remain available for raw acceptance or rejection
