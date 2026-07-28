## MODIFIED Requirements

### Requirement: Structured candidate evidence matrix
The system SHALL evaluate every generated candidate for authorized label, value kind, normalized unit and unit family, specimen, modifier, timing, method, section/panel, neighbouring rows, and reference-range shape. Each compatible, missing, or conflicting item SHALL include an evidence code, source, strength, observed value where present, expected values or policy where applicable, and deterministic score contribution. `unit`, `value_kind`, and `specimen` SHALL be first-class missing axes when the definition requires them.

The system SHALL evaluate the definition's unit policy as follows:

- For `missingUnitPolicy = reject`, a missing input unit SHALL produce `unit_missing`, add `unit` to the candidate's missing axes, and make the candidate non-selectable while preserving its authorized-label recognition in the trace.
- For `missingUnitPolicy = ambiguous`, a missing input unit SHALL produce `unit_missing`, add `unit` to the candidate's missing axes, contribute zero unit score, and prevent concrete resolution.
- For `missingUnitPolicy = display_only`, a missing input unit SHALL be compatible with the absence of a numeric-unit requirement, SHALL NOT add a missing axis, and SHALL NOT contribute a numeric-unit score.
- For a non-display unit policy, an observed accepted normalized token in an accepted dimension SHALL be compatible; an observed incompatible dimension or token SHALL be a hard conflict; and an unknown non-empty token SHALL be an explicit unsupported-unit hard conflict rather than missing or compatible evidence.

A definition requiring numeric value kind SHALL accept only observed `numeric`; an absent value kind SHALL produce missing evidence and add `value_kind` to missing axes; and observed `qualitative` or `ordinal` SHALL be a hard conflict. A definition requiring `qualitative` or `ordinal` SHALL accept either observed non-numeric representation, while retaining the observed representation in evidence. A definition with value kind `unspecified` SHALL impose no value-kind requirement or score.

The definition's identity-bearing `specimen` field SHALL be the sole specimen compatibility policy. A non-`unspecified` definition specimen with absent input SHALL produce `specimen_missing` and add `specimen` to missing axes. A different supported specimen or an unknown non-empty specimen token SHALL be a hard conflict. The registry SHALL NOT maintain an independently editable `allowedSpecimens` policy.

An observed mismatch for value kind, unit family/token, specimen, modifier, timing, or method SHALL make the candidate non-selectable. Absence of a definition-required axis SHALL be recorded as missing evidence and SHALL NOT be treated as compatibility. Section/panel, neighbouring-row, and reference-range-shape evidence SHALL only support an authorized candidate; they SHALL NOT generate a candidate, override a hard conflict, or satisfy a missing required axis.

#### Scenario: Missing ambiguous unit preserves recognition without resolution
- **WHEN** an authorized numeric candidate declares `missingUnitPolicy = ambiguous` and the input supplies no unit
- **THEN** the candidate SHALL contain `unit_missing`, list `unit` in missing axes, remain recognized, and SHALL NOT be eligible for `resolved`

#### Scenario: Missing rejected unit is non-selectable
- **WHEN** an authorized candidate declares `missingUnitPolicy = reject` and the input supplies no unit
- **THEN** the candidate SHALL preserve label recognition but SHALL be non-selectable with explicit rejected-unit policy evidence

#### Scenario: Qualitative result does not require numeric unit
- **WHEN** an authorized qualitative or ordinal candidate declares `missingUnitPolicy = display_only`, the input has a compatible non-numeric value kind, and no unit is supplied
- **THEN** the unit axis SHALL be complete without a fabricated unit, a missing-unit axis, or a numeric-unit score

#### Scenario: Unknown observed unit is a hard conflict
- **WHEN** a numeric candidate receives a non-empty unit token that the normalizer cannot assign to a reviewed supported dimension
- **THEN** the candidate SHALL contain an unsupported-unit hard conflict and SHALL be non-selectable

#### Scenario: Percent cannot satisfy absolute-count policy
- **WHEN** an absolute cell-count candidate receives a percent unit, or a percentage candidate receives an absolute cell-count unit
- **THEN** the candidate SHALL contain a unit-family hard conflict in either direction and SHALL remain non-selectable

#### Scenario: Missing numeric value kind is incomplete
- **WHEN** an authorized numeric candidate receives no observed value kind
- **THEN** the candidate SHALL contain value-kind missing evidence, list `value_kind` in missing axes, and SHALL NOT be eligible for `resolved`

#### Scenario: Numeric and non-numeric value kinds conflict
- **WHEN** a numeric candidate receives an observed qualitative or ordinal value kind
- **THEN** that candidate SHALL contain a value-kind hard-conflict record and SHALL be non-selectable

#### Scenario: Ordinal extraction is compatible with qualitative definition
- **WHEN** the parser represents a qualitative laboratory result such as `Negative` as ordinal and the authorized definition requires qualitative or ordinal
- **THEN** the candidate SHALL accept the non-numeric representation, retain the observed value kind in evidence, and SHALL NOT require a numeric unit

#### Scenario: Missing specimen preserves incomplete evidence
- **WHEN** an authorized candidate requires a specimen but the input supplies none
- **THEN** the candidate SHALL contain `specimen_missing`, list `specimen` in missing axes, and SHALL NOT fabricate compatible or conflicting specimen evidence

#### Scenario: Urine and blood specimens conflict
- **WHEN** a urine candidate receives serum, plasma, or whole-blood specimen evidence, or a blood candidate receives urine specimen evidence
- **THEN** the candidate SHALL contain a specimen hard conflict and SHALL remain non-selectable in either direction

#### Scenario: Context cannot overcome a compatibility conflict
- **WHEN** a candidate has section and neighbouring-row support but its observed unit, value kind, or specimen conflicts with definition policy
- **THEN** the candidate SHALL remain non-selectable and contextual evidence SHALL NOT remove the conflict

### Requirement: Safe outcome selection
The system SHALL return `resolved` only for one reviewed Registry 2.0 candidate with authoritative label evidence, no hard conflict, no missing definition-required unit, specimen, modifier, timing, method, or value-kind axis, a selectable score of at least 55, and a score lead of at least five points over every other admissible reviewed candidate.

The system SHALL return `ambiguous` when more than one complete reviewed candidate remains admissible without a five-point leading margin. The system SHALL return `partial` when no reviewed candidate is admissible for concrete resolution but at least one authorized candidate is recognized, including provisional candidates, policy-rejected candidates, or candidates with missing required axes. The system SHALL return `unmapped` when no authorized candidate is recognized. Only `resolved` SHALL expose a non-null active measurement definition key; candidate keys retained in `partial` or `ambiguous` evidence SHALL NOT be treated as concrete identity.

#### Scenario: Unique complete reviewed candidate resolves
- **WHEN** one reviewed candidate has authoritative compatible evidence for every required axis, a score of at least 55, and a five-point lead
- **THEN** the resolver SHALL return `resolved` with that measurement definition key

#### Scenario: Recognized provisional candidate remains partial
- **WHEN** a provisional candidate is the only authorized compatible candidate
- **THEN** the resolver SHALL return `partial`, preserve the candidate and evidence, and expose a null measurement definition key

#### Scenario: Known label with missing identity axis remains partial
- **WHEN** an authorized reviewed candidate has no hard conflict but is missing a definition-required unit, specimen, modifier, timing, method, or value kind
- **THEN** the resolver SHALL return `partial`, expose a null measurement definition key, and list every missing axis

#### Scenario: Conflicted candidate key is evidence only
- **WHEN** an authorized candidate has a hard compatibility conflict
- **THEN** the resolver SHALL retain the candidate and conflict in decision evidence but SHALL NOT expose its key as active identity

#### Scenario: Unknown label remains unmapped
- **WHEN** no definition key or active authoritative alias matches the input
- **THEN** the resolver SHALL return `unmapped` with a null analyte key and measurement definition key

### Requirement: Versioned normalization decision trace
The system SHALL persist a versioned resolver decision trace with every newly written normalization revision. The trace SHALL include input evidence snapshot identifiers, candidate authority metadata, per-axis compatible/missing/conflicting evidence, score components and totals, candidate eligibility, selected and runner-up keys, missing axes including unit, conflicts, final outcome, confidence derivation, catalog manifest version, resolver version, and compatibility-policy version.

The normalization review DTO SHALL expose the structured trace. Its active measurement definition key SHALL be non-null only when the active revision outcome is `resolved` and the key equals the trace's selected candidate key. Manual selection SHALL be permitted only for a compatible reviewed candidate, SHALL append explicit manual-selection evidence, SHALL retain the automatic trace, and SHALL use the evidence-derived confidence policy. The writer SHALL preserve the existing atomic revision/projection publication boundary.

#### Scenario: Automatic resolution persists an explainable compatibility trace
- **WHEN** the normalization writer publishes an automatically evaluated row
- **THEN** its active revision SHALL contain the versioned unit, value-kind, and specimen evidence and the same outcome, missing axes, conflicts, mapping confidence, catalog manifest version, resolver version, and compatibility-policy version returned by the resolver

#### Scenario: Incomplete active revision exposes no concrete key
- **WHEN** the active normalization revision is `partial`, `ambiguous`, or `unmapped`
- **THEN** its read DTO SHALL expose a null active measurement definition key even when candidate keys exist inside the decision trace

#### Scenario: Manual selection retains automatic evidence
- **WHEN** a reviewer selects a compatible reviewed candidate from an ambiguous or partial result
- **THEN** the persisted trace SHALL contain both the original automatic candidates and explicit manual-selection evidence

#### Scenario: Incompatible manual selection is rejected
- **WHEN** a reviewer attempts to select a candidate with a hard conflict, a required missing axis, or provisional maturity
- **THEN** the normalization writer SHALL reject the selection without publishing a revision

### Requirement: Resolver regression coverage
The system SHALL maintain deterministic table-driven and end-to-end regression coverage for reviewed and provisional candidates; missing, compatible, unsupported, and conflicting unit policy outcomes; numeric, qualitative, ordinal, and missing value kinds; supported, missing, unknown, and conflicting specimens; every other hard-conflict axis; context-only support; equal and near-score ties; unknown labels; extraction-only proposals; deprecated or source-inapplicable aliases; persisted active traces; read-boundary identity; manual-selection constraints; and conversion eligibility.

The launch regression matrix SHALL cover percent versus absolute count in both directions; serum, plasma, whole-blood, and urine conflicts; missing specimen; missing and unknown units; qualitative results without units; missing and conflicting value kind; and conversion denial for incomplete outcomes. The matrix SHALL preserve the launch corpus baseline with zero false concrete resolutions.

#### Scenario: Negative alias authority fixture remains unmapped
- **WHEN** a corpus fixture uses an alias disallowed by lifecycle, approval, or laboratory attribution
- **THEN** the resolver regression suite SHALL assert that the alias cannot create a candidate or concrete mapping

#### Scenario: Persistence regression preserves compatibility decision contract
- **WHEN** the normalization persistence regression writes and reads a resolution
- **THEN** it SHALL assert that the active stored trace and read DTO reproduce the resolver compatibility output for the same catalog, resolver, and policy versions

#### Scenario: Matrix rejects false concrete compatibility
- **WHEN** a fixture supplies an incompatible unit family, incompatible specimen, conflicting value kind, unknown observed token, or required missing axis
- **THEN** the regression SHALL assert that no concrete measurement definition key is exposed and no conversion is performed

## ADDED Requirements

### Requirement: Conversion requires an active resolved reviewed binding
The system SHALL make conversion available only through a binding derived from the active normalization revision/read boundary. A conversion binding SHALL require an active revision whose outcome is `resolved`, whose non-null measurement definition key equals the selected candidate key in its persisted trace, and whose definition is reviewed with Registry 2.0 review provenance and reviewed conversion metadata.

A bare candidate key, a proposed key, or a key present only inside partial or ambiguous decision evidence SHALL NOT authorize conversion. Inactive revisions, `partial`, `ambiguous`, `unmapped`, provisional, missing-axis, and conflicted outcomes SHALL return no conversion binding. Conversion presentation consumers SHALL use this guarded binding rather than direct candidate-key lookup.

#### Scenario: Active resolved reviewed identity permits conversion
- **WHEN** an active `resolved` revision binds to a reviewed definition with reviewed conversion metadata and its active key equals the selected trace key
- **THEN** the conversion consumer SHALL be permitted to apply that definition's reviewed conversion rule for display

#### Scenario: Partial candidate cannot trigger conversion
- **WHEN** a partial result retains a reviewed candidate key in decision evidence but exposes no active concrete identity
- **THEN** conversion lookup SHALL return no binding and the consumer SHALL preserve the native value and unit

#### Scenario: Ambiguous candidate cannot trigger conversion
- **WHEN** an ambiguous result retains two or more reviewed candidate keys in decision evidence
- **THEN** no candidate key SHALL authorize conversion and the consumer SHALL preserve the native value and unit

#### Scenario: Inactive or mismatched revision cannot trigger conversion
- **WHEN** a normalization revision is inactive or its concrete key does not equal the selected candidate key in its trace
- **THEN** conversion lookup SHALL return no binding even if the key names a reviewed definition
