## MODIFIED Requirements

### Requirement: Review UI separates extraction and mapping certainty

The UI SHALL display resolver state, confidence band, evidence, release versions, revision relationship, and independent persisted-decision source and quality without presenting mapping confidence as extraction or clinical certainty. It SHALL distinguish `persisted`, `preview`, and `none` sources from `available`, `unavailable`, and `conflict` quality, and SHALL show stable conflict details when persisted decision data disagrees.

#### Scenario: Partial specialty result is reviewed

- **WHEN** a specialty result is recognized but incomplete
- **THEN** the UI SHALL explain missing metadata and permit raw acceptance
- **AND** it SHALL not imply that the printed result itself is invalid

#### Scenario: Persisted conflict is reviewed

- **WHEN** an active revision has conflicting outcome, selected identity, trace, or version fields
- **THEN** the UI SHALL label the decision as persisted with conflicting data
- **AND** it SHALL show conflict details without presenting current Resolver output as historical rationale

#### Scenario: Legacy persisted trace is unavailable

- **WHEN** an active historical revision has no supported technical trace
- **THEN** the UI SHALL label the decision as persisted with unavailable historical evidence
- **AND** it SHALL not display a current preview in place of the missing trace

#### Scenario: No active revision has an explicit preview

- **WHEN** a row has no active revision and the review caller requests a current preview
- **THEN** the UI SHALL label the result as preview and non-persisted
- **AND** it SHALL keep preview state separate from persisted decision history
