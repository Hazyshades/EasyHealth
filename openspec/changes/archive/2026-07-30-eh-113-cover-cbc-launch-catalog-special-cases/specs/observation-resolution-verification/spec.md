## MODIFIED Requirements

### Requirement: Resolver outcomes preserve incomplete CBC evidence

CBC resolution SHALL use the shared four-value outcome domain `resolved`, `partial`, `ambiguous`, and `unmapped`. Missing specimen, missing unit when policy requires it, missing value kind, missing method/modifier, and unresolved differential context SHALL be represented in `missingAxes` and structured candidate evidence. Observed incompatible unit family, specimen, method, modifier, or value kind SHALL remain hard conflicts.

#### Scenario: Missing CBC context is recognized but incomplete

- **WHEN** a CBC label matches one or more known definitions but required clinical axes are absent
- **THEN** the outcome is partial or ambiguous with the missing axes and evidence records
- **AND** `measurementDefinitionKey` is null

#### Scenario: CBC conflict is not a missing axis

- **WHEN** a CBC input provides a conflicting unit, specimen, method, modifier, or value kind
- **THEN** the candidate contains hard conflict evidence
- **AND** the conflicting axis is not represented as compatible evidence or concrete resolution

### Requirement: Concrete CBC resolution is the only conversion boundary

A CBC candidate key in `candidateKeys` or decision evidence SHALL NOT be treated as an active identity. Conversion, scoring, and reviewed assessment consumers SHALL accept only the active revision/read-boundary binding where the outcome is resolved, the definition is reviewed Registry 2.0, and the projection is synchronized.

#### Scenario: Candidate evidence cannot trigger conversion

- **WHEN** an incomplete or conflicting CBC result contains candidate keys in its evidence
- **THEN** conversion and reviewed consumer helpers return no usable policy/binding
- **AND** no observation projection is promoted to that candidate

#### Scenario: Active reviewed resolution is consumable

- **WHEN** a CBC observation has an active synchronized revision with resolved outcome and a reviewed Registry 2.0 definition
- **THEN** the reviewed conversion/assessment boundary may consume that identity
- **AND** its behavior is independent of raw labels and inactive candidates
