# report-citation-validation

## ADDED Requirements

### Requirement: Validate report citation identity

The citation validator SHALL validate contract version, claim shape, source kind, source row identity, document identity, profile ownership, and persisted report scope before a report is publishable.

#### Scenario: Valid source citation passes

- **WHEN** a factual claim cites a source that resolves to the same profile and an in-scope document
- **THEN** the validator retains the claim and citation
- **AND** returns a `valid` or `limited` result with no identity error

#### Scenario: Cross-profile citation fails closed

- **WHEN** a claim cites a source row owned by another profile
- **THEN** the validator returns an invalid result
- **AND** the report cannot be persisted as shareable or exportable
- **AND** the response does not reveal the other profile's source details

### Requirement: Validate closed report sections

The validator SHALL require exactly one EH-148 section container for each canonical ID in order: `document_summary`, `latest_measurements`, `changes`, `clinician_questions`, `limitations`, and `source_ledger`. Each container SHALL have an `items` array and an `empty_state` whenever empty; the first four allow `no_data`, `not_applicable`, or `insufficient_evidence`, while limitations and source-ledger containers allow only `no_data`. It SHALL reject unknown, duplicate, missing, or claim-incompatible sections with `invalid` and `SCHEMA_INVALID`; limitations and source-ledger containers SHALL not accept model claims.

#### Scenario: Missing or incompatible section fails

- **WHEN** a candidate omits a canonical section or places a factual claim in `clinician_questions`/`limitations`/`source_ledger`
- **THEN** the validator returns `invalid` with `SCHEMA_INVALID`
- **AND** no candidate is persisted

#### Scenario: Empty section remains explicit

- **WHEN** a candidate has no comparable measurements or no user/model questions
- **THEN** the validator accepts the canonical section only with an allowed `empty_state`
- **AND** the publishable result includes a machine limitation when evidence is unavailable

### Requirement: Validate claim support

A factual claim SHALL have at least one valid citation from the same report payload. A non-factual patient question MAY omit a citation. Unknown, broken, cross-profile, source-kind, or out-of-scope identity references SHALL return an `invalid` result and block persistence; uncited or unsafe-but-in-scope claim content SHALL be removed or marked with a machine-generated limitation and stable issue code.

#### Scenario: Uncited factual claim is sanitized

- **WHEN** generated content contains a factual sentence with no citation
- **THEN** the claim is absent from publishable content
- **AND** the result includes `CLAIM_UNCITED`
- **AND** the user sees an explicit limitation rather than the unsupported sentence

### Requirement: Validator result is reusable

The validator SHALL return a structured result containing status, sanitized content, the exact non-empty validator version, stable issue codes, and a safe summary. Generation, owner reads, public shares, and exports SHALL consume the same result or a persisted validation status/version and SHALL NOT implement separate citation checks.

#### Scenario: Broken citation blocks public publication

- **WHEN** a persisted report has unresolved citation issues
- **THEN** the public share and export adapters reject it
- **AND** no source text, token, or health value is included in the error response
