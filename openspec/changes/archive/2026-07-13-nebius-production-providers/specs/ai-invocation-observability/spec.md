## ADDED Requirements

### Requirement: AI invocation metadata table

The system SHALL record LLM call metadata in `ai_invocations` without storing raw prompts, raw model responses, OCR text, or image data.

#### Scenario: Successful worker call logged

- **WHEN** the worker completes an LLM call
- **THEN** a row is inserted with `profile_id`, `document_id`, `stage`, `provider`, `model_id`, `latency_ms`, `input_tokens`, `output_tokens`, `success: true`, and `provider_switch: false` (unless a cross-provider switch occurred)

#### Scenario: Failed call logged

- **WHEN** an LLM call fails after retries
- **THEN** a row is inserted with `success: false`, a short `error_code`, and no PHI content

#### Scenario: Provider switch logged

- **WHEN** a call uses a different provider than the profile selection due to opt-in cross-provider fallback
- **THEN** the invocation row has `provider_switch: true`

#### Scenario: No PHI in logs

- **WHEN** any `ai_invocations` row is stored
- **THEN** it contains no raw prompts, responses, or document content

### Requirement: provider_switch column

The `ai_invocations` table SHALL include `provider_switch boolean NOT NULL DEFAULT false`.

#### Scenario: Same-provider call

- **WHEN** a Nebius Fast profile uses only Nebius models successfully
- **THEN** all invocation rows have `provider_switch: false`

### Requirement: App-side LLM invocation logging

Reports, holistic synthesis, and doctor summary routes SHALL write `ai_invocations` rows with `document_id` null when no document context exists.

#### Scenario: Report logged

- **WHEN** a paid report is generated
- **THEN** an `ai_invocations` row is created with `stage` `report`

### Requirement: Data Lab is dev and eval only

Project documentation SHALL state that Data Lab is for dev/eval only in this project. With ZDR enabled, Nebius does not store chat completion logs and Data Lab imports are empty. Production debugging SHALL use Nebius Inference Observability, `ai_invocations` metadata, and de-identified QA fixtures — not Data Lab.

#### Scenario: Ops docs explain Data Lab limits

- **WHEN** an operator reads `docs/06-ai/ai-providers.md` or `docs/07-ops/env-vars.md`
- **THEN** ZDR/Data Lab constraints and the production observability stack are documented in English

### Requirement: RLS on ai_invocations

`ai_invocations` SHALL have RLS so users read only their `profile_id` rows.

#### Scenario: Cross-profile access denied

- **WHEN** a client queries another profile's invocations
- **THEN** no rows are returned
