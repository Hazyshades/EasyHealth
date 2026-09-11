## ADDED Requirements

### Requirement: Input identity version is separate from trace and release versions

Every newly persisted normalization revision SHALL store the Resolver input evidence hash with its corresponding `input_identity_format_version`. This identity-format version SHALL remain distinct from `resolver_trace_schema_version`, `resolver_version`, `normalization_version`, and Registry catalog manifest version/digest. The persisted trace SHALL continue to contain only its allowlisted privacy-safe fields; raw input and captured headings SHALL not be added to make the identity reproducible.

#### Scenario: New revision stores identity format metadata

- **WHEN** a trusted writer persists a new normalization revision
- **THEN** the revision SHALL contain the current input identity hash and identity-format version as a pair
- **AND** its trace schema and Registry release metadata SHALL remain separately versioned

#### Scenario: Legacy revision remains readable without reinterpretation

- **WHEN** a historical revision has an input hash but no supported identity-format version
- **THEN** the reader SHALL expose the hash as legacy metadata
- **AND** no current canonicalization SHALL be used to claim that the legacy hash is equal to a new-format identity

#### Scenario: Release metadata does not alter input identity

- **WHEN** identical prepared evidence is persisted under a different Registry or Resolver release
- **THEN** the input identity hash/version pair SHALL remain the identity of the prepared evidence
- **AND** the trace SHALL retain the release metadata that produced the decision
