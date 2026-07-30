## MODIFIED Requirements

### Requirement: Measurement definitions encode reviewed CBC compatibility axes

The biomarker catalog SHALL use Registry 2.0 measurement definitions as the sole runtime identity for CBC results. Each CBC definition SHALL make its analyte, property/scale, specimen, timing, method, value kind, unit dimensions, accepted units, missing-unit policy, aliases, maturity, and provenance explicit. `allowedSpecimens` SHALL be authoritative for specimen compatibility; validation SHALL reject a definition whose singular canonical specimen contradicts its allowed specimen set.

#### Scenario: Reviewed CBC definition is concrete-eligible

- **WHEN** a CBC definition is marked reviewed
- **THEN** it has Registry 2.0 review provenance, a complete identity, a coherent unit policy, and provenance-safe aliases
- **AND** only this definition can be selected for a resolved concrete outcome

#### Scenario: Contradictory specimen metadata is rejected

- **WHEN** a definition's canonical specimen and `allowedSpecimens` disagree
- **THEN** registry validation reports an error
- **AND** the contradictory definition is not eligible for runtime resolution

### Requirement: Missing unit policy is enforced by the catalog contract

Numeric CBC definitions SHALL declare `missingUnitPolicy` as `reject` or `ambiguous` according to reviewed clinical evidence. Qualitative or display-only definitions MAY use `display_only` and SHALL not require numeric unit evidence. Unknown unit tokens and incompatible unit dimensions SHALL never be accepted as compatible numeric evidence.

#### Scenario: Missing unit is rejected for a rejecting policy

- **WHEN** a numeric CBC row has no unit and the candidate policy is `reject`
- **THEN** that candidate is non-selectable
- **AND** the result cannot be resolved to it

#### Scenario: Missing unit is incomplete for an ambiguous policy

- **WHEN** a numeric CBC row has no unit and the candidate policy is `ambiguous`
- **THEN** it remains recognized but incomplete
- **AND** the result is partial or ambiguous with unit missing evidence

#### Scenario: Qualitative CBC result has no numeric unit

- **WHEN** a qualitative/display-only CBC result has no unit
- **THEN** lack of a numeric unit does not create a numeric-unit conflict
- **AND** value-kind and semantic identity rules still apply

### Requirement: Value-kind compatibility is explicit

The catalog SHALL distinguish absent value kind from conflicting value kind. A numeric definition with absent value kind is incomplete; a numeric definition with qualitative or ordinal input is conflicting. A qualitative definition SHALL define whether ordinal extraction is compatible or requires explicit conversion before resolution.

#### Scenario: Numeric value kind is missing

- **WHEN** a CBC input omits `valueKind` for a numeric candidate
- **THEN** `value_kind` is a missing axis
- **AND** the candidate is not concrete-eligible

#### Scenario: Qualitative and numeric kinds conflict

- **WHEN** a numeric CBC definition receives a qualitative or incompatible ordinal value kind
- **THEN** the candidate is rejected with hard value-kind conflict evidence
- **AND** it cannot become a reviewed concrete binding
