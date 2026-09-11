## ADDED Requirements

### Requirement: Shared prepared evidence seam

The system SHALL expose one shared preparation seam for Resolver evidence. Thin adapters for review rows, writer rows, corrections, reprocessing, and candidate-corpus fixtures MAY translate source shapes, but the shared seam SHALL apply effective overrides, stated-axis evidence filtering, and reviewed panel-specimen policy in that order. It SHALL return one prepared Resolver input together with its canonical policy context.

#### Scenario: Review and writer rows share preparation

- **WHEN** review and writer adapters receive equivalent extracted evidence and the same measurement override
- **THEN** both SHALL produce equivalent prepared Resolver input and policy context
- **AND** both SHALL pass the same prepared record to Resolver evaluation and identity hashing

#### Scenario: Unstated specimen does not bypass the policy order

- **WHEN** an extraction row carries a concrete specimen value that is not evidenced by the row's label, source text, or captured section
- **THEN** the preparation seam SHALL treat that specimen as unstated before applying reviewed panel policy
- **AND** it SHALL not pass the unevidenced value as stated evidence

### Requirement: Panel policy admission has one owner

The preparation seam SHALL produce a discriminated panel-policy context distinguishing at least `stated`, `applied`, `no_match`, and `conflict`. The Resolver SHALL consume the prepared effective specimen and policy context without re-matching the raw captured heading. A policy conflict SHALL remain distinguishable from no match and SHALL fail closed for effective specimen admission.

#### Scenario: Stated and policy-derived specimens remain distinct

- **WHEN** one prepared row has a stated `whole_blood` specimen and another receives `whole_blood` from a reviewed CBC policy
- **THEN** their policy contexts SHALL identify `stated` and `applied` respectively
- **AND** their Resolver input identities SHALL differ even though their effective specimen values match

#### Scenario: Equivalent headings share policy context

- **WHEN** two captured headings match different reviewed heading forms for the same panel policy and analyte
- **THEN** both prepared records SHALL contain the same reviewed policy key and effective specimen
- **AND** neither identity SHALL contain the raw heading text

#### Scenario: Ambiguous policy match fails closed

- **WHEN** a captured heading matches zero or multiple applicable reviewed policies
- **THEN** the preparation seam SHALL return `no_match` or `conflict` respectively
- **AND** the Resolver SHALL not receive a fabricated policy-derived specimen

### Requirement: Resolver input identity is canonical and versioned

For every new prepared Resolver evaluation, the system SHALL build a canonical identity record and SHA-256 hash. The record SHALL use a fixed key order, explicit null representation, deterministic collection ordering, and an explicit identity-format version included in the hashed serialization. It SHALL include the prepared measurement evidence and resolution-relevant provenance, including effective specimen/source and policy context, while excluding raw captured headings, raw OCR/source content, extraction confidence, writer action state, Registry release metadata, and the request hash.

#### Scenario: Comparator text remains identity evidence

- **WHEN** prepared evidence contains a comparator or detection-limit value such as `< 0.20`
- **THEN** the canonical identity SHALL preserve the reported value text and text value kind
- **AND** the identity SHALL not turn the marker into a numeric value

#### Scenario: Null and equivalent context are canonicalized

- **WHEN** two prepared records differ only by omitted versus explicit null optional fields
- **THEN** their canonical identity serialization and hash SHALL be equal
- **AND** two equivalent reviewed policy headings SHALL hash according to the same policy context rather than their source wording

#### Scenario: Release metadata changes independently

- **WHEN** the same prepared evidence is evaluated under a different Registry/resolver release metadata tuple
- **THEN** the Resolver input identity hash SHALL remain unchanged
- **AND** the stored decision SHALL retain the release metadata separately

### Requirement: Identity format compatibility is explicit

Every newly persisted normalization revision SHALL store its input identity hash with the corresponding identity-format version. A legacy revision without a known identity-format version SHALL remain readable, but its input identity comparison with a different or unknown format SHALL be reported as unavailable rather than equal or unequal by assumption.

#### Scenario: Legacy prior identity is not silently reinterpreted

- **WHEN** reprocessing compares a current v1 identity with a prior revision that has a null or unsupported identity-format version
- **THEN** the comparison SHALL be marked unavailable
- **AND** the system SHALL not recompute or rewrite the legacy prior hash

### Requirement: EH-164 marker semantics remain unchanged

The shared preparation and identity seams SHALL preserve the EH-164 Health Profile invariant. A comparator or detection-limit marker MAY remain an accepted text input with `value: null` and `value_kind: "text"`, but it SHALL never become a numeric score or trend contribution through identity or reprocessing.

#### Scenario: Identity work does not remove an accepted marker

- **WHEN** a verified laboratory observation carries an accepted comparator text marker and a reviewed assessment binding
- **THEN** identity preparation SHALL retain the marker as textual evidence
- **AND** numeric score and trend projections SHALL continue to exclude it
