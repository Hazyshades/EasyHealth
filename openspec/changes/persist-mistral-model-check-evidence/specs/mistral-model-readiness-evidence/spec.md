## ADDED Requirements

### Requirement: Regional Mistral model checks SHALL produce sanitized append-only evidence

When Mistral OCR is enabled, the worker SHALL call `models.list` against the configured regional endpoint before accepting work and SHALL persist one append-only readiness record for every check attempt. The record MUST identify the provider, region, requested model, whether that model was present, success state, check timestamp, adapter version, worker instance, latency when available, and only a stable privacy-safe error code on failure. It MUST NOT contain an API key, request headers, raw catalog response, raw SDK/network error text, document content, document identifiers, patient identifiers, or laboratory values.

#### Scenario: Requested model is present in the regional catalog

- **WHEN** `models.list` succeeds in the configured region and contains the configured model ID or alias
- **THEN** the worker SHALL persist a record with `provider=mistral`, the configured region, the configured requested model, `model_present=true`, and `success=true`
- **AND** the worker SHALL return the same sanitized evidence to its readiness caller
- **AND** the worker SHALL emit only sanitized readiness metadata

#### Scenario: Regional catalog request fails

- **WHEN** `models.list` fails because of authentication, network, timeout, or another provider error
- **THEN** the worker SHALL persist a record with `success=false` and the existing stable privacy-safe error code
- **AND** the worker SHALL NOT persist or log the provider response body or raw error message
- **AND** worker readiness SHALL fail closed

#### Scenario: Requested model is absent

- **WHEN** `models.list` succeeds but the configured model ID or alias is absent
- **THEN** the worker SHALL persist `model_present=false`, `success=false`, and `error_code=ocr_provider_unavailable`
- **AND** worker readiness SHALL fail closed

#### Scenario: Evidence persistence fails

- **WHEN** the Mistral check completes but the service cannot persist its sanitized evidence record
- **THEN** worker readiness SHALL fail with a fixed non-provider evidence-persistence error
- **AND** the worker SHALL NOT continue polling or processing documents as ready

### Requirement: Readiness evidence SHALL be service-only and append-only

The readiness evidence store SHALL be readable and writable only by `service_role`. Anonymous, authenticated, and public roles MUST have no table access. Direct updates and deletes MUST be rejected so a recorded check cannot be rewritten or removed through the normal database interface.

#### Scenario: Client attempts to read readiness evidence

- **WHEN** an anonymous or authenticated client queries the readiness table
- **THEN** the query SHALL be denied

#### Scenario: Service records a readiness check

- **WHEN** the worker inserts a sanitized readiness record through `service_role`
- **THEN** the insert SHALL succeed
- **AND** the stored columns SHALL be limited to the approved privacy-safe contract

#### Scenario: Existing readiness evidence is mutated

- **WHEN** any caller attempts to update or delete a readiness record
- **THEN** the operation SHALL be rejected

### Requirement: Operators SHALL be able to generate release evidence without processing documents

The worker SHALL provide an operator-only command that executes the same regional `models.list` verification and prints a sanitized pass/fail record containing the check timestamp, region, requested model, model-presence result, and stable error code when applicable. The command MUST use the worker secret environment and MUST NOT upload or process a patient document.

#### Scenario: Deployment reviewer verifies the configured model

- **WHEN** the operator runs the model-check command with valid worker settings
- **THEN** the command SHALL exit successfully only when the configured model is present in the configured regional catalog
- **AND** the corresponding persisted record SHALL be queryable for attachment to the EH-163 QA checklist and tracking Issue
- **AND** the output SHALL contain no secret or raw provider payload
