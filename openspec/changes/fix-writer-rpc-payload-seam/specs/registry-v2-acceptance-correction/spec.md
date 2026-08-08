## MODIFIED Requirements

### Requirement: Writer integration preserves EH-104 invariants

The acceptance and correction integration SHALL preserve the v2 primitive's lock order, same-source/document/profile checks, expected-active CAS, idempotent no-op behavior, and active-revision projection synchronization. Writer code SHALL surface primitive failures and SHALL NOT silently repair a divergent projection or reattach a revision to a different source.

Surfacing a primitive failure SHALL include failures that are not JavaScript `Error` instances. A database client that rejects a call with a plain object SHALL have its message reported; a generic placeholder SHALL NOT replace it.

The payload the application writer produces SHALL be exercised against the deployed primitive in an automated test. A fixture that constructs the payload by hand, or a writer test that substitutes the database, SHALL NOT satisfy this requirement: neither crosses the boundary where the two contracts meet, and a shape agreed on only in the application is not an agreement.

#### Scenario: Source or profile mismatch is rejected
- **WHEN** a writer supplies an observation and revision that do not share the required extracted source, document, or profile ownership
- **THEN** v2 promotion fails and neither active revision nor observation projection changes

#### Scenario: Idempotent retry remains a no-op
- **WHEN** a writer retries a completed v2 promotion with an otherwise complete matching target
- **THEN** the primitive returns its idempotent no-op outcome without rewriting promotion metadata

#### Scenario: The writer's own payload is accepted by the primitive
- **WHEN** the resolution payload the application writer builds for a recognized but incomplete row is submitted to the deployed promotion primitive
- **THEN** the promotion succeeds and one observation is written
- **AND** the assertion uses the writer's real payload shape rather than a fixture-authored equivalent

#### Scenario: A non-Error database rejection reaches the caller
- **WHEN** the primitive rejects a write with a plain object carrying a message
- **THEN** the API response reports that message rather than a generic writer failure
