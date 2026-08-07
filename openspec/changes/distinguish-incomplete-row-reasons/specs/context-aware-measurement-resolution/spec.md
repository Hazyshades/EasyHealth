## MODIFIED Requirements

### Requirement: Safe outcome selection
The system SHALL return `resolved` only for one reviewed Registry 2.0 candidate with authoritative label evidence, no hard conflict, no missing definition-required axis, a selectable score of at least 55, and a score lead of at least five points over every other admissible reviewed candidate.

The system SHALL return `ambiguous` when more than one reviewed candidate remains admissible without a five-point leading margin. The system SHALL return `partial` when no reviewed candidate is admissible for concrete resolution but at least one authorized candidate is recognized, including provisional candidates or candidates with missing required axes. The system SHALL return `unmapped` when no authorized candidate is recognized. Only `resolved` SHALL expose a non-null measurement definition key.

Admissibility SHALL be attributable. When a recognized candidate is excluded from concrete resolution, the resolver SHALL record which admissibility condition excluded it — definition maturity, definition source provenance, alias match authority, alias approval state, a missing definition-required axis, or the minimum selectable score — as candidate evidence. A candidate SHALL NOT be excluded silently, and a single boolean eligibility flag SHALL NOT be the only record of exclusion. This requirement governs explanation only: it SHALL NOT change which candidates are admissible, which outcome is returned, or candidate ranking.

#### Scenario: Unique complete reviewed candidate resolves
- **WHEN** one reviewed candidate has authoritative compatible evidence for every required axis, a score of at least 55, and a five-point lead
- **THEN** the resolver SHALL return `resolved` with that measurement definition key

#### Scenario: Recognized provisional candidate remains partial
- **WHEN** a provisional candidate is the only authorized compatible candidate
- **THEN** the resolver SHALL return `partial`, preserve the candidate and evidence, and expose a null measurement definition key
- **AND** record definition maturity as the admissibility condition that excluded it

#### Scenario: Known label with missing identity axis remains partial
- **WHEN** an authorized reviewed candidate has no hard conflict but is missing a definition-required specimen, timing, method, modifier, or value kind
- **THEN** the resolver SHALL return `partial` and list the missing axis

#### Scenario: Unknown label remains unmapped
- **WHEN** no definition key or active authoritative alias matches the input
- **THEN** the resolver SHALL return `unmapped` with a null analyte key and measurement definition key

#### Scenario: Score-floor exclusion is recorded
- **WHEN** a candidate is compatible on every axis but scores below the minimum selectable score
- **THEN** the resolver SHALL record the score floor as the excluding condition rather than reporting no reason

#### Scenario: Attribution does not alter selection
- **WHEN** the same input is resolved before and after admissibility attribution is introduced
- **THEN** the outcome, selected measurement definition key, candidate ranking, and confidence SHALL be unchanged
