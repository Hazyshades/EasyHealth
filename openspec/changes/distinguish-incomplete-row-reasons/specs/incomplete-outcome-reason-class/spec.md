## ADDED Requirements

### Requirement: Every non-resolved row carries an attributable reason class

The system SHALL classify every `partial`, `ambiguous` and `unmapped` laboratory row with
exactly one reason class describing why concrete resolution did not occur. The class SHALL
be an additional projected field and SHALL NOT extend, replace or reorder the four-outcome
enum.

The classes SHALL be `unit_or_value_conflict`, `axis_not_stated`, `definition_not_reviewed`
and `no_candidate`. When more than one applies, precedence SHALL be that order: a hard
conflict outranks a missing axis, and a missing axis outranks definition maturity, so the
reviewer is always shown the most actionable true reason first.

The class SHALL be derived only from evidence the resolver recorded. No consumer SHALL
re-read the measurement catalog or re-evaluate an admissibility condition to determine it.

#### Scenario: Provisional-only candidate is attributed to the catalog
- **WHEN** a row's only recognized candidate is compatible on every axis, carries no hard
  conflict, and is blocked solely because its definition maturity is not `reviewed`
- **THEN** the reason class SHALL be `definition_not_reviewed`

#### Scenario: Missing axis outranks maturity
- **WHEN** a row's only candidate is both provisional and missing a definition-required axis
- **THEN** the reason class SHALL be `axis_not_stated`, because stating the axis remains
  useful after the definition is reviewed

#### Scenario: Hard conflict outranks a missing axis
- **WHEN** a candidate is rejected by an incompatible unit or value kind and also lacks a
  required axis
- **THEN** the reason class SHALL be `unit_or_value_conflict`

#### Scenario: Unrecognized label is not attributed to maturity
- **WHEN** no authorized candidate is recognized for a row
- **THEN** the reason class SHALL be `no_candidate`

#### Scenario: Class is derived without an active revision
- **WHEN** an extracted row has no active normalization revision and is served as a preview
- **THEN** the reason class SHALL still be present and correct, without depending on a
  persisted decision trace

### Requirement: A reason the reviewer cannot act on is never presented as one they can

The system SHALL distinguish, in every presentation of an incomplete row, whether the
outstanding evidence is owed by the source document or by catalog review. For a class the
reviewer cannot resolve, the interface SHALL state that the wait is on catalog review, SHALL
NOT describe context as missing from the reader's perspective, and SHALL NOT offer or imply
an action that would supply clinical evidence.

Raw acceptance SHALL remain available for every such row.

#### Scenario: Catalog-blocked row does not request evidence
- **WHEN** a row is classified `definition_not_reviewed`
- **THEN** the interface SHALL state that the measurement is recognized and awaiting catalog
  review, SHALL confirm the raw result is preserved, and SHALL NOT ask for a specimen,
  method, modifier or timing

#### Scenario: Document-blocked row names what is missing
- **WHEN** a row is classified `axis_not_stated`
- **THEN** the interface SHALL name each axis the document did not state, in clinical
  English, without requiring technical details to be expanded

#### Scenario: Neither class forces a mapping
- **WHEN** a reviewer accepts a row of either class as reported
- **THEN** acceptance SHALL succeed without selecting a measurement definition

### Requirement: The reason class is free of patient-linked and candidate identity

The reason class SHALL be a closed enumeration. It SHALL NOT carry a candidate key,
measurement definition key, analyte key, raw label, value, unit, reference range, source
text, or any free-text field.

#### Scenario: Serialized class leaks no identity
- **WHEN** an incomplete row is serialized with its reason class
- **THEN** the payload SHALL contain no candidate key and no patient-linked content beyond
  what the existing outcome contract already permits
