## MODIFIED Requirements

### Requirement: User decisions preserve Registry 2.0 outcome semantics

The system SHALL map a user acceptance of a `resolved` result with a reviewed selected definition to a `user_verified` active revision with user decision metadata. The system SHALL map a raw user acceptance of `partial`, `ambiguous`, or `unmapped` to a `pending` active revision with no invented concrete definition or verified decision metadata. The system SHALL map a user correction selecting a reviewed concrete definition to a `manually_corrected` active revision with user decision metadata.

The promotion primitive SHALL enforce the two identity tiers at their own thresholds rather than as one rule. A `resolved` outcome SHALL require both a measurement definition key and an analyte key. A `partial`, `ambiguous`, or `unmapped` outcome SHALL be rejected when it carries a measurement definition key, and SHALL be accepted when it carries only an analyte key. Rejecting an analyte-level identity on an incomplete outcome SHALL NOT be treated as protecting the concrete-identity invariant: it discards a claim the resolver was entitled to make and blocks acceptance of the row entirely.

A guard that the application writer's own payload cannot satisfy SHALL be treated as a defect in the guard until the contract it enforces is stated in a specification.

#### Scenario: Resolved reviewed acceptance is user verified
- **WHEN** a user accepts a resolved result whose selected Registry 2.0 definition is reviewed
- **THEN** the active revision has `verification_status = 'user_verified'` and complete user decision metadata

#### Scenario: Partial raw acceptance remains pending
- **WHEN** a user accepts a partial result without choosing a concrete definition
- **THEN** the active revision remains `pending`, has no verified decision metadata, and does not gain a fabricated definition

#### Scenario: Recognized partial acceptance keeps its analyte link
- **WHEN** a user accepts a `partial` or `ambiguous` result whose resolution carries an analyte key and no measurement definition key
- **THEN** the promotion succeeds, the active revision stores the analyte key with a null measurement definition key, and `verification_status` remains `pending`

#### Scenario: Incomplete outcome with a concrete definition is still rejected
- **WHEN** a resolution payload declares a `partial`, `ambiguous`, or `unmapped` outcome together with a measurement definition key
- **THEN** the promotion fails, no observation or revision is committed, and the caller receives the concrete-identity rejection

#### Scenario: Ambiguous or unmapped raw acceptance remains pending
- **WHEN** a user accepts an ambiguous or unmapped result as raw evidence
- **THEN** the active revision remains `pending` and downstream consumers do not receive a concrete Registry 2.0 identity

#### Scenario: Reviewed correction is manually corrected
- **WHEN** a user corrects a result to a reviewed concrete Registry 2.0 definition
- **THEN** the active revision has `verification_status = 'manually_corrected'` and complete user decision metadata
