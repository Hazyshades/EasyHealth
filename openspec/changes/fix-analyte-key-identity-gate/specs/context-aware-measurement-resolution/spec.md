## MODIFIED Requirements

### Requirement: Safe outcome selection
The system SHALL return `resolved` only for one reviewed Registry 2.0 candidate with authoritative label evidence, no hard conflict, no missing definition-required axis, a selectable score of at least 55, and a score lead of at least five points over every other admissible reviewed candidate.

The system SHALL return `ambiguous` when more than one reviewed candidate remains admissible without a five-point leading margin. The system SHALL return `partial` when no reviewed candidate is admissible for concrete resolution but at least one authorized candidate is recognized, including provisional candidates or candidates with missing required axes. The system SHALL return `unmapped` when no authorized candidate is recognized. Only `resolved` SHALL expose a non-null measurement definition key.

Semantic identity is two-tiered and the tiers have different thresholds. The measurement definition key is the concrete tier and requires `resolved`. The analyte key is the weaker tier: a non-`resolved` outcome SHALL expose an analyte key when the candidates the resolver considered viable converge on exactly one analyte, and SHALL expose a null analyte key otherwise. Recognizing which analyte a row measures is not the same claim as selecting which definition it matches, and the weaker claim SHALL NOT be discarded because the stronger one could not be made.

The analyte tier SHALL be derived only from candidates that survived hard-conflict evaluation. A candidate made non-selectable by a value-kind, unit, specimen, modifier, timing, or method conflict SHALL NOT contribute its analyte, because the resolver has already ruled it out and an identity partly derived from a rejected candidate is not evidence.

#### Scenario: Unique complete reviewed candidate resolves
- **WHEN** one reviewed candidate has authoritative compatible evidence for every required axis, a score of at least 55, and a five-point lead
- **THEN** the resolver SHALL return `resolved` with that measurement definition key

#### Scenario: Recognized provisional candidate remains partial
- **WHEN** a provisional candidate is the only authorized compatible candidate
- **THEN** the resolver SHALL return `partial`, preserve the candidate and evidence, and expose a null measurement definition key

#### Scenario: Known label with missing identity axis remains partial
- **WHEN** an authorized reviewed candidate has no hard conflict but is missing a definition-required specimen, timing, method, modifier, or value kind
- **THEN** the resolver SHALL return `partial` and list the missing axis

#### Scenario: Incomplete outcome converging on one analyte keeps the analyte tier
- **WHEN** an outcome is `partial` or `ambiguous` and every viable candidate belongs to the same analyte
- **THEN** the resolver SHALL expose that analyte key with a null measurement definition key

#### Scenario: Incomplete outcome spanning analytes exposes neither tier
- **WHEN** an outcome is `partial` or `ambiguous` and the viable candidates belong to more than one analyte
- **THEN** the resolver SHALL expose a null analyte key and a null measurement definition key

#### Scenario: Hard-conflicted candidate does not contribute an analyte
- **WHEN** the only candidate carrying a second analyte was made non-selectable by a hard conflict
- **THEN** that analyte SHALL NOT participate in the convergence test and the surviving analyte SHALL be exposed

#### Scenario: Unknown label remains unmapped
- **WHEN** no definition key or active authoritative alias matches the input
- **THEN** the resolver SHALL return `unmapped` with a null analyte key and measurement definition key
