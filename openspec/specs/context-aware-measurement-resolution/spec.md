# Context-Aware Measurement Resolution

## Purpose
Define deterministic, evidence-based measurement resolution that produces safe, explainable normalization outcomes.

## Requirements

### Requirement: Authoritative candidate generation
The system SHALL generate measurement candidates only from a Registry 2.0 definition key or an alias that the EH-110 authority policy marks active, source-applicable, and eligible for the input. Each generated candidate SHALL record the label authority identifier, match type, approval state, provenance, and fixture references. A deprecated, inactive, unapproved, or source-inapplicable alias SHALL not generate a candidate.

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

### Requirement: Structured candidate evidence matrix
The system SHALL evaluate every generated candidate for authorized label, value kind, normalized unit and unit family, specimen, modifier, timing, method, section/panel, neighbouring rows, and reference-range shape. Each accepted, missing, or rejected item SHALL include an evidence code, source, strength, observed value where present, expected values where applicable, and deterministic score contribution.

An observed mismatch for value kind, unit family/token, specimen, modifier, timing, or method SHALL be a hard conflict and SHALL make the candidate non-selectable. Absence of a definition-required axis SHALL be recorded as missing evidence and SHALL NOT be treated as compatibility. Section/panel, neighbouring-row, and reference-range-shape evidence SHALL only support an authorized candidate; they SHALL NOT generate a candidate, override a hard conflict, or satisfy a missing required axis.

#### Scenario: Value-kind mismatch is explicit conflict
- **WHEN** an authorized candidate requires a numeric value kind and the input has an observed qualitative value kind
- **THEN** that candidate SHALL contain a value-kind hard-conflict record and SHALL be non-selectable

#### Scenario: Missing specimen preserves recognition
- **WHEN** an authorized candidate requires a specimen but the input supplies none
- **THEN** the candidate SHALL record missing specimen evidence without fabricating a specimen

#### Scenario: Context cannot overcome a unit conflict
- **WHEN** a candidate has section and neighbouring-row support but its observed normalized unit conflicts with its unit policy
- **THEN** the candidate SHALL remain non-selectable and the context evidence SHALL NOT remove the unit conflict

### Requirement: Evidence-derived scoring and stable ranking
The system SHALL calculate a selectable candidate score from the configured evidence matrix: exact label 40; normalized label 36; OCR or bounded-fuzzy label 28; compatible value kind 15; compatible unit 15; compatible specimen 10; compatible modifier, timing, and method 5 each; section/panel and neighbour support 3 each; and reference-shape support 2. Missing evidence SHALL contribute zero. A hard-conflicted candidate SHALL have no selectable score.

The system SHALL serialize candidates in ascending definition-key order and rank selectable candidates by descending total score, descending label-authority rank, then ascending definition key for presentation only. Lexical key order SHALL NOT resolve a clinical tie.

#### Scenario: Identical inputs have identical evidence order
- **WHEN** the resolver receives the same input, registry release, authority policy, and resolver version twice
- **THEN** it SHALL return identical candidate ordering, scores, outcome, confidence, and evidence trace

#### Scenario: Equal leading candidates remain tied
- **WHEN** two reviewed compatible candidates have equal total score and label-authority rank
- **THEN** the resolver SHALL retain both candidates and SHALL NOT choose one by definition key

### Requirement: Safe outcome selection
The system SHALL return `resolved` only for one reviewed Registry 2.0 candidate with authoritative label evidence, no hard conflict, no missing definition-required axis, a selectable score of at least 55, and a score lead of at least five points over every other admissible reviewed candidate.

The system SHALL return `ambiguous` when more than one reviewed candidate remains admissible without a five-point leading margin. The system SHALL return `partial` when no reviewed candidate is admissible for concrete resolution but at least one authorized candidate is recognized, including provisional candidates or candidates with missing required axes. The system SHALL return `unmapped` when no authorized candidate is recognized. Only `resolved` SHALL expose a non-null measurement definition key.

#### Scenario: Unique complete reviewed candidate resolves
- **WHEN** one reviewed candidate has authoritative compatible evidence for every required axis, a score of at least 55, and a five-point lead
- **THEN** the resolver SHALL return `resolved` with that measurement definition key

#### Scenario: Recognized provisional candidate remains partial
- **WHEN** a provisional candidate is the only authorized compatible candidate
- **THEN** the resolver SHALL return `partial`, preserve the candidate and evidence, and expose a null measurement definition key

#### Scenario: Known label with missing identity axis remains partial
- **WHEN** an authorized reviewed candidate has no hard conflict but is missing a definition-required specimen, timing, method, modifier, or value kind
- **THEN** the resolver SHALL return `partial` and list the missing axis

#### Scenario: Unknown label remains unmapped
- **WHEN** no definition key or active authoritative alias matches the input
- **THEN** the resolver SHALL return `unmapped` with a null analyte key and measurement definition key

### Requirement: Mapping confidence is independent of extraction confidence
The system SHALL derive mapping confidence from resolver evidence rather than from extraction confidence or a fixed value per outcome. It SHALL calculate confidence as the leading applicable selectable score divided by 100, capped at 0.99; `unmapped` SHALL have confidence 0. A result SHALL use the high band at 0.85 or above, the medium band from 0.60 through 0.84, and the low band below 0.60.

For `ambiguous` and `partial`, confidence SHALL express support for the leading candidate while preserving the non-concrete outcome. `extractionConfidence` SHALL remain raw extraction metadata and SHALL NOT alter mapping score, confidence, band, or outcome.

#### Scenario: Extraction confidence cannot promote a mapping
- **WHEN** two otherwise identical inputs differ only in extraction confidence
- **THEN** the resolver SHALL return the same candidates, outcome, mapping confidence, and confidence band for both inputs

#### Scenario: Outcome and confidence are independently derived
- **WHEN** a recognized candidate has strong label and unit evidence but a missing required specimen
- **THEN** the resolver SHALL return `partial` while deriving its confidence from the candidate score rather than assigning a fixed partial confidence

### Requirement: Versioned normalization decision trace
The system SHALL persist a versioned resolver decision trace with every newly written normalization revision. The trace SHALL include input evidence snapshot identifiers, candidate authority metadata, per-axis accepted/missing/rejected evidence, score components and totals, candidate eligibility, selected and runner-up keys, missing axes, conflicts, final outcome, confidence derivation, catalog manifest version, and resolver version.

The normalization review DTO SHALL expose the structured trace. Manual selection SHALL be permitted only for a compatible reviewed candidate, SHALL append explicit manual-selection evidence, SHALL retain the automatic trace, and SHALL use the evidence-derived confidence policy. The writer SHALL preserve the existing atomic revision/projection publication boundary.

#### Scenario: Automatic resolution persists an explainable trace
- **WHEN** the normalization writer publishes an automatically resolved row
- **THEN** its active revision SHALL contain the versioned decision trace and the same outcome, candidate evidence, mapping confidence, catalog manifest version, and resolver version returned by the resolver

#### Scenario: Manual selection retains automatic evidence
- **WHEN** a reviewer selects a compatible reviewed candidate from an ambiguous or partial result
- **THEN** the persisted trace SHALL contain both the original automatic candidates and explicit manual-selection evidence

#### Scenario: Incompatible manual selection is rejected
- **WHEN** a reviewer attempts to select a candidate with a hard conflict or a provisional maturity
- **THEN** the normalization writer SHALL reject the selection without publishing a revision

### Requirement: Resolver regression coverage
The system SHALL maintain deterministic unit and corpus regression coverage for reviewed and provisional candidates, every hard-conflict axis, missing required axes, context-only support, equal and near-score ties, unknown labels, extraction-only proposals, deprecated or source-inapplicable aliases, persisted traces, and manual-selection constraints.

#### Scenario: Negative alias authority fixture remains unmapped
- **WHEN** a corpus fixture uses an alias disallowed by lifecycle, approval, or laboratory attribution
- **THEN** the resolver regression suite SHALL assert that the alias cannot create a candidate or concrete mapping

#### Scenario: Persistence regression preserves decision contract
- **WHEN** the normalization persistence regression writes a resolution
- **THEN** it SHALL assert that the stored trace reproduces the resolver output contract for the same resolver and manifest versions
