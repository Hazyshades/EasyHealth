## MODIFIED Requirements

### Requirement: Raw result and provenance visibility

The system SHALL preserve and expose raw laboratory evidence independently of semantic resolution. For every outcome, the document review surface SHALL retain the source label (verbatim `raw_name` / printed label), raw value text or numeric value, raw and normalized unit where present, raw reference range, specimen, modifier, page/source text, extraction confidence, extraction model/version, and stable extracted-row identity available from the existing provenance contract.

The UI SHALL render raw evidence before mapping explanation and SHALL NOT replace an incomplete raw result with a candidate display name, converted value, inferred unit, inferred specimen, or inferred reference range. When a row is `resolved`, the UI MAY additionally show the canonical English measurement display name without hiding the original label. Specimen, modifier and method SHALL be rendered only when the source document stated them; the stored `unspecified` and `none` defaults SHALL NOT be rendered as reported evidence. The same raw-evidence block SHALL be used for extracted rows and for the observations-only recovery list, and the per-document observations read SHALL therefore expose extraction confidence.

#### Scenario: Unmapped row remains visible

- **WHEN** no authorized Registry 2.0 candidate matches a laboratory row
- **THEN** the document review surface SHALL show the original result and provenance with `Measurement not recognized`

#### Scenario: Partial row keeps missing context visible

- **WHEN** a recognized row is partial because a required unit, value kind, specimen, modifier, timing, or method is missing
- **THEN** the UI SHALL preserve the raw result and list the missing context without claiming compatibility or conflict

#### Scenario: Ambiguous row does not choose a display identity

- **WHEN** multiple reviewed candidates remain admissible
- **THEN** the UI SHALL show `Multiple possible matches`, preserve the source result, and SHALL NOT render one candidate as the confirmed measurement

#### Scenario: Unstated axes are not presented as evidence

- **WHEN** a stored row carries the default `unspecified` specimen and `none` modifier
- **THEN** the UI SHALL omit those axes instead of presenting them as reported values

#### Scenario: Recovery list renders the same raw evidence

- **WHEN** the document has no current extracted rows and linked observations are listed instead
- **THEN** each observation SHALL show the same reported name, value, reference range, provenance and extraction confidence as an extracted row

#### Scenario: Non-English original label is not treated as missing

- **WHEN** a RU or ES row preserves a non-empty verbatim original label and is unmapped or partial
- **THEN** the UI MUST NOT imply that the source label text is missing
- **AND** MUST still show that original label as raw evidence

### Requirement: Safe English wording and technical details

The system SHALL use distinct English labels and guidance for all four outcomes. `resolved` SHALL use `Matched measurement`; `partial` SHALL use `More details needed`; `ambiguous` SHALL use `Multiple possible matches`; and `unmapped` SHALL use `Measurement not recognized`. Product chrome and system messages remain English in this change; translated UI copy is out of scope.

Technical details SHALL explain that mapping confidence is classification evidence rather than medical certainty. They SHALL include verification state, confidence, missing axes, conflict/support reason labels, candidate count, and version metadata. Incomplete-state details SHALL NOT present internal candidate keys, selected evidence keys, or conversion metadata as active identity. Full support traces remain outside this capability.

#### Scenario: Partial guidance explains incompleteness

- **WHEN** a row is partial
- **THEN** the UI SHALL explain that the result is recognized but required context is missing and that the raw result remains available

#### Scenario: Technical details are sanitized

- **WHEN** a user expands technical details for an incomplete row
- **THEN** the UI SHALL show reasons and versions without showing a candidate key as the active measurement identity

#### Scenario: English guidance with foreign-language raw evidence

- **WHEN** a Russian or Spanish raw label is shown for an unmapped row
- **THEN** the outcome label remains the English `Measurement not recognized`
- **AND** the foreign-language raw label remains visible as source evidence
