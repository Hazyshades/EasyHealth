# ai-invocation-observability Specification

## ADDED Requirements

### Requirement: Assistant calls use the privacy-safe invocation boundary

Assistant chat and embedding calls SHALL use the existing `ai_invocations` metadata boundary with assistant-specific stages and safe error codes. The rows SHALL contain no prompt, response, OCR text, source excerpt, filename, or document content.

#### Scenario: Assistant generation logged

- **WHEN** an assistant answer is generated
- **THEN** an `ai_invocations` row records the assistant stage, profile, provider, model, latency, token counts, success, and provider-switch state
- **AND** no health content is stored in the row

#### Scenario: Embedding failure logged

- **WHEN** a semantic indexing embedding call fails
- **THEN** an assistant embedding error code is stored without the document text or provider payload
