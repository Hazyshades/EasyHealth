## ADDED Requirements

### Requirement: Registry releases are reproducible

Each release SHALL include version, resolver/normalization versions, deterministic full-manifest digest, changelog, changed-record inventory, mapping classification, maturity, assessment bindings, and corpus results. Source ordering alone MUST NOT change the digest.

#### Scenario: Alias policy changes

- **WHEN** an alias value, status, source, or match type changes
- **THEN** the digest and changed-record inventory reflect the change

### Requirement: Activation preserves reviewed invariants

A normalization candidate SHALL activate automatically only when it is resolved to one reviewed concrete definition, has no hard conflicts, belongs to an approved mapping class, preserves manual decisions, and has approved assessment impact. Confidence alone MUST NOT authorize activation.

#### Scenario: Partial result has high evidence quality

- **WHEN** an analyte is recognized strongly but specimen evidence required for concrete identity is absent
- **THEN** the result remains partial and is not activated as a measurement definition

### Requirement: Launch corpus evaluation is measurable and non-mutating

A candidate-release corpus run SHALL report raw preservation, recognition, resolution states, false resolution, aliases, units, processing errors, manual corrections, and assessment impact without mutating active product data. Metrics SHALL be segmented by relevant panel, family, language, laboratory, value kind, and context availability.

#### Scenario: Candidate release is evaluated

- **WHEN** the launch corpus runs against a candidate registry/resolver
- **THEN** observations, trends, readiness, scores, and manual revisions remain unchanged
- **AND** a reproducible coverage and safety report is produced

### Requirement: Approved quality gates precede launch

Metric definitions, representative-corpus requirements, numerical thresholds, and approval ownership SHALL be documented before the launch manifest is approved. Missing gates or approval SHALL block launch rather than fall back to Registry v1.

#### Scenario: Recognition target passes but false-resolution review is missing

- **WHEN** expected rows are recognized but false concrete resolution has not been reviewed
- **THEN** the candidate release remains blocked
