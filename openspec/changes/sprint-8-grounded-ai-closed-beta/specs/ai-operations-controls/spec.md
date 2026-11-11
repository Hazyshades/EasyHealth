# ai-operations-controls Specification

## ADDED Requirements

### Requirement: Assistant requests use atomic per-profile quotas

The assistant SHALL reserve a request through an atomic server-side quota boundary before retrieval or generation. The quota SHALL enforce per-profile request limits and cost limits over a defined window. A denied request SHALL return HTTP 429 with a reset timestamp and SHALL not call an embedding or chat provider.

#### Scenario: Request within quota

- **WHEN** an invited profile has available quota
- **THEN** the reservation returns a unique request ID
- **AND** the assistant may continue to retrieval and generation

#### Scenario: Request over quota

- **WHEN** the profile exceeds its request or cost limit
- **THEN** the API returns 429 with a safe retry time
- **AND** no model call is made

### Requirement: Operational telemetry contains metadata only

Assistant request and AI invocation telemetry SHALL record profile ID, request ID, feature, mode, provider, model, latency, token counts, estimated cost, retrieval counts, outcome, and short error codes. It SHALL not store the question, prompt, answer, OCR text, document filename, source excerpt, or raw provider error.

#### Scenario: Successful assistant request

- **WHEN** an assistant response completes
- **THEN** request and invocation metadata record latency, token counts, provider/model, source counts, and outcome
- **AND** no raw health content is persisted in telemetry

#### Scenario: Failed provider call

- **WHEN** an embedding or chat provider fails
- **THEN** telemetry records a safe error taxonomy code
- **AND** the user receives a non-sensitive error response

### Requirement: Retrieval and provider metrics are queryable by operators

The system SHALL expose server-side aggregates or logs that distinguish assistant feature, provider, model, mode, structured result count, semantic result count, latency, estimated cost, quota denials, and error category. Access SHALL remain service-role/operator-only.

#### Scenario: Cost review

- **WHEN** an operator reviews assistant usage for a date range
- **THEN** the aggregate can group cost and latency by provider and model
- **AND** the result contains no document text or user question

### Requirement: Assistant feedback emits safe events

Feedback SHALL be associated with the assistant request ID and a controlled rating/category vocabulary. Feedback and analytics events SHALL not require document content or free-form medical text.

#### Scenario: Negative source feedback

- **WHEN** a user marks an answer as unhelpful and selects a controlled category
- **THEN** one feedback row is stored with the request context and category
- **AND** the event does not include the answer or source excerpt
