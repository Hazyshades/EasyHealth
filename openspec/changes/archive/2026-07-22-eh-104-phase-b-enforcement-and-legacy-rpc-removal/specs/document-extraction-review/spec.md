## ADDED Requirements

### Requirement: Acceptance and correction use only the v2 promotion path

Laboratory acceptance and correction entry points SHALL invoke the EH-106
atomic writer that delegates to
`promote_observation_normalization_revision_v2`. After Phase B, those entry
points SHALL NOT call or fall back to
`promote_observation_normalization_revision`. Resolved reviewed user acceptance
SHALL continue to map to `user_verified`; raw acceptance of
`partial|ambiguous|unmapped` SHALL continue to map to `pending` with empty
decision metadata. Manual correction to a reviewed concrete definition SHALL
continue to map to `manually_corrected` with user actor metadata.

#### Scenario: Accept resolved reviewed row after Phase B

- **WHEN** a user accepts a resolved reviewed laboratory extraction row
- **THEN** the writer creates or reuses the same-source observation and
  revision through the v2 path
- **AND** the active revision is `user_verified` with user decision metadata

#### Scenario: Accept incomplete raw row after Phase B

- **WHEN** a user accepts a partial, ambiguous, or unmapped extraction row as
  raw evidence
- **THEN** the active revision remains `pending` with null decision metadata
- **AND** the row is not stored as a verified concrete measurement

#### Scenario: Legacy promotion RPC is not referenced

- **WHEN** static verification scans acceptance and correction modules
- **THEN** no active caller references the legacy promotion function name
