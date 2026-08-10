## MODIFIED Requirements

### Requirement: Observation identity does not require a resolved measurement

An observation SHALL use its own stable identifier and source extraction linkage as persistence identity. `analyte_key` and `measurement_definition_key` SHALL be nullable semantic links governed by `resolution_status`; the system MUST NOT require a legacy biomarker key or raw-text-derived synthetic key to store a valid raw result.

"Governed by `resolution_status`" SHALL mean each link is gated at its own threshold, not that both are gated at the same one. `measurement_definition_key` SHALL be null unless `resolution_status` is `resolved`. `analyte_key` SHALL be permitted on any `resolution_status`, and SHALL be present exactly when the resolver recognized a single analyte. Every writer, primitive, and constraint that enforces this requirement SHALL implement the same reading; a layer that gates both links identically SHALL be treated as non-conforming.

#### Scenario: Raw unmapped observation is stored

- **WHEN** a user accepts an extracted result with no catalog match
- **THEN** the observation is persisted with raw provenance and `resolution_status = unmapped`
- **AND** both semantic identity links remain null

#### Scenario: Recognized analyte without a concrete definition is stored

- **WHEN** a user accepts an extracted result whose resolution recognized one analyte but could not select a reviewed concrete definition
- **THEN** the observation is persisted with `resolution_status` of `partial` or `ambiguous`, a non-null `analyte_key`, and a null `measurement_definition_key`
- **AND** no writer, primitive, or constraint rejects the row for carrying the analyte link

#### Scenario: Concrete result is resolved

- **WHEN** one reviewed concrete definition is selected
- **THEN** both analyte and measurement-definition links are stored
- **AND** downstream definition-specific consumers use the measurement-definition link
