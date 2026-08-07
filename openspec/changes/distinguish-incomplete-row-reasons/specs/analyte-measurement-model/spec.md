## MODIFIED Requirements

### Requirement: Catalog maturity controls resolver and assessment behavior

Every definition SHALL have maturity `provisional`, `reviewed`, or `retired`. Only a reviewed active definition MAY be selected as a resolved concrete measurement. A provisional definition MAY support recognition and review but MUST NOT authorize automatic concrete resolution or assessment. A retired definition MUST NOT be a new resolver candidate.

When definition maturity is the condition that prevents concrete resolution, that fact SHALL be observable outside the catalog. The resolver SHALL record it as candidate evidence, and the recognition outcome SHALL remain distinguishable from an outcome caused by evidence the source document did not state. Maturity SHALL remain a catalog property: recording it as evidence SHALL NOT make it a clinical axis, an input to compatibility, or a value a reviewer can supply or override.

#### Scenario: Provisional specialty antibody matches

- **WHEN** a printed specialty antibody label matches a provisional launch record
- **THEN** the resolver returns partial recognition with the matching analyte or candidate
- **AND** does not treat the record as a reviewed concrete measurement or assessment input
- **AND** records definition maturity as the condition that blocked concrete resolution

#### Scenario: Maturity is not offered as a reviewer decision

- **WHEN** a row is incomplete solely because its definition is provisional
- **THEN** manual correction SHALL NOT offer that definition for selection
- **AND** the reviewer SHALL NOT be presented with maturity as a field to supply or change

#### Scenario: Retired definitions never reach admissibility

- **WHEN** a label matches only a retired definition
- **THEN** no candidate SHALL be generated
- **AND** the outcome SHALL be attributed to the absence of a candidate rather than to maturity
