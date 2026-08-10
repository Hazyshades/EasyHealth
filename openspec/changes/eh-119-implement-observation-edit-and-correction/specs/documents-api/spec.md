## ADDED Requirements

### Requirement: Biomarker review endpoint accepts a measurement correction

`PATCH /api/documents/[id]/biomarkers` SHALL accept an `edit-value` action carrying the extracted biomarker id, a measurement override limited to value, value text, value kind, ordinal, unit, reference low, reference high and observation date, a required non-blank correction reason, and the expected active revision id. The endpoint SHALL authenticate the session, SHALL verify document ownership, and SHALL derive the acting profile from the session rather than from the request body. The response SHALL return the resulting revision together with the definition keys the corrected input supports.

#### Scenario: Owner corrects a measurement

- **WHEN** an authenticated owner submits an `edit-value` action with a valid override and reason
- **THEN** the endpoint returns the new revision and the compatible definition keys computed from the corrected input

#### Scenario: Actor is not caller-supplied

- **WHEN** an `edit-value` request contains an actor or profile identifier in its body
- **THEN** the endpoint ignores it and records the session profile as the actor

#### Scenario: Non-owner correction is refused

- **WHEN** an authenticated user submits a correction for a document they do not own
- **THEN** the endpoint responds `404` and no revision is written

### Requirement: Correction rejections carry an actionable code

Every rejection from the biomarker review endpoint SHALL carry a stable machine-readable code alongside its message, and the HTTP status SHALL distinguish an invalid request from a concurrency conflict and from an unexpected failure. A validation failure SHALL respond `400` with the offending field named in the code. A stale expected active revision or a projection conflict SHALL respond `409`. A rejection raised by the writer contract SHALL respond `422`. No rejection produced by the correction contract SHALL surface as `500`.

#### Scenario: Invalid reference range is a 400 with a field code

- **WHEN** a correction submits a reference low greater than its reference high
- **THEN** the endpoint responds `400` with a code identifying the reference range

#### Scenario: Stale revision is a 409

- **WHEN** a correction supplies an expected active revision that is no longer active
- **THEN** the endpoint responds `409` with the stale-revision code

#### Scenario: Writer contract rejection is a 422, not a 500

- **WHEN** the writer refuses a correction because its payload violates the write contract
- **THEN** the endpoint responds `422` with the writer's code
- **AND** the response is not an unexpected-error `500`

### Requirement: Corrected measurements are returned by document reads

The document detail and per-document observations endpoints SHALL return the effective measurement — the raw extraction with any active override applied — together with the raw printed evidence, and SHALL indicate that a row carries a user correction. A consumer SHALL be able to distinguish a corrected measurement from an extracted one without reading verification status.

#### Scenario: Corrected value is served

- **WHEN** a client reads a document whose row carries an active measurement override
- **THEN** the response carries the corrected value, unit, reference bounds and date, and the raw printed value, unit and reference text
- **AND** the row is flagged as user-corrected

#### Scenario: Uncorrected rows are unchanged

- **WHEN** a client reads a document whose rows carry no override
- **THEN** the response shape and values are unchanged from before this capability existed
