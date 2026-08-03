## ADDED Requirements

### Requirement: Every launch-corpus measurement has typed Registry 2.0 evidence
The Registry 2.0 catalog SHALL provide a typed definition for every measurement represented by the mandatory launch corpus. A definition SHALL identify its analyte, provenance, property, scale, value kind, specimen policy, and unit policy. Definitions established only from fixture evidence SHALL be `provisional` and SHALL have no assessment bindings.

#### Scenario: A fixture-only numeric measurement has a known unit
- **WHEN** the corpus evaluates total protein `67 g/L` or ECP `11 ng/mL`
- **THEN** the resolver records a candidate whose unit policy accepts the source unit
- **AND** the row is included in unit coverage without receiving an assessment binding

#### Scenario: A qualitative ELISA result is intentionally unitless
- **WHEN** the corpus evaluates a qualitative anti-Toxocara, anti-Opisthorchis, anti-Echinococcus, or anti-Trichinella IgG result with no unit
- **THEN** the result is recognised by its typed provisional definition
- **AND** absence of a numeric unit does not constitute a unit conflict
- **AND** the result is not eligible for a concrete runtime identity or assessment binding

### Requirement: Provisional definitions preserve non-concrete safety
A provisional launch-catalog definition SHALL support recognition and compatible-unit evidence but SHALL NOT by itself produce a concrete measurement definition key, a trend identity, conversion policy, or assessment input.

#### Scenario: Known measurement with absent specimen remains partial
- **WHEN** a total bilirubin, ALT, AST, CRP, or another typed launch row lacks required specimen or method evidence
- **THEN** the resolver preserves the recognised candidate evidence and returns `partial` or `ambiguous`
- **AND** it SHALL NOT infer a concrete serum, plasma, manual, or automated identity

### Requirement: Display-only fixture placeholders do not shadow typed definitions
The runtime catalog SHALL NOT retain a display-only sample-fixture definition that aliases the same launch label as an existing typed reviewed definition and rejects that definition's accepted source unit.

#### Scenario: Existing reviewed definition handles an exact source label
- **WHEN** the corpus evaluates total bilirubin, ALT, AST, or CRP with a compatible source unit
- **THEN** the resolver evidence SHALL NOT include a shadow display-only candidate with `unit_not_accepted`
- **AND** the expected incomplete result remains non-concrete if source context is insufficient
