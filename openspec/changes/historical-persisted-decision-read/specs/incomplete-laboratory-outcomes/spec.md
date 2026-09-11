## MODIFIED Requirements

### Requirement: Authoritative four-outcome serialization

The system SHALL serialize laboratory semantic identity from the active normalization revision using exactly `resolved`, `partial`, `ambiguous`, or `unmapped`. The serialized outcome SHALL include verification status, mapping confidence and band, missing axes, conflict/support reason codes, candidate count, relevant policy/version metadata, consumer eligibility with exclusion reasons, and independent persisted-decision source and quality metadata.

Only an active `resolved` revision that passes the reviewed Registry 2.0 binding boundary SHALL expose a non-null measurement definition or analyte identity. Candidate keys contained in decision evidence SHALL NOT be serialized or interpreted as active identity for `partial`, `ambiguous`, or `unmapped` rows. A persisted revision with unavailable or conflicting technical data SHALL retain its stored four-outcome value but SHALL expose the quality state and SHALL not be re-resolved.

A current-catalog preview MAY be returned for an extracted row without an active revision, but it SHALL be labeled `source = preview`, `notPersisted = true`, and SHALL remain pending/unverified without granting downstream eligibility. A row with no active revision and no requested preview SHALL have `source = none` and `quality = unavailable`.

#### Scenario: Active partial revision wins over current preview

- **WHEN** an extracted row currently previews as resolved but its active persisted normalization revision is `partial`
- **THEN** the API SHALL serialize `partial`, null concrete identity, the persisted missing/conflict evidence, and `source = persisted`
- **AND** it SHALL not invoke or expose the current preview as the historical outcome

#### Scenario: Candidate evidence remains non-concrete

- **WHEN** an ambiguous or partial trace contains one or more candidate definition keys
- **THEN** the public outcome SHALL expose only candidate count and safe reason summaries, while measurement definition and analyte identity remain null

#### Scenario: Unaccepted row uses preview safely

- **WHEN** a current extracted row has no active normalization revision and the caller explicitly requests preview
- **THEN** the review API MAY serialize a current resolver preview with `source = preview` and `notPersisted = true`
- **AND** all definition-specific consumer eligibility SHALL be false

#### Scenario: Persisted fields conflict

- **WHEN** an active revision's stored outcome disagrees with its technical trace or selected identity
- **THEN** the API SHALL serialize the stored four-outcome value with `source = persisted` and `quality = conflict`
- **AND** it SHALL preserve conflict codes without choosing a corrected identity or invoking the current resolver

#### Scenario: Historical technical trace is unavailable

- **WHEN** an active legacy revision has no supported technical trace
- **THEN** the API SHALL serialize its stored outcome with `source = persisted` and `quality = unavailable`
- **AND** it SHALL not substitute a current-catalog explanation
