## ADDED Requirements

### Requirement: Nebius OpenAI-compatible client

The system SHALL connect to Nebius Token Factory using `NEBIUS_API_KEY` and configurable `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`).

#### Scenario: Nebius client configured

- **WHEN** `NEBIUS_API_KEY` is set on the server
- **THEN** `resolveModelForStage` can return Nebius-backed models for `nebius_fast` and `nebius_quality`

#### Scenario: Nebius client missing

- **WHEN** `NEBIUS_API_KEY` is not set
- **THEN** both Nebius providers are unavailable in AI Settings

### Requirement: Nebius region and base URL configuration

The system SHALL support `NEBIUS_REGION` (default `eu-north1`) and `NEBIUS_BASE_URL` for endpoint selection. Regional dedicated endpoint URLs SHALL be documented as future production config and SHALL NOT be assumed unless explicitly configured.

#### Scenario: Default global endpoint

- **WHEN** `NEBIUS_BASE_URL` is unset
- **THEN** the server uses `https://api.tokenfactory.nebius.com/v1`

### Requirement: Startup model catalog validation

When `NEBIUS_API_KEY` is set, the system SHALL validate configured model IDs against `GET /v1/models` at startup.

#### Scenario: Missing model in production

- **WHEN** `NODE_ENV` is `production` and a configured model ID is not in the Nebius catalog
- **THEN** startup fails with a clear error listing missing model IDs

#### Scenario: Missing model in development

- **WHEN** `NODE_ENV` is not `production` and a configured model ID is missing
- **THEN** the server logs a warning and continues

### Requirement: Fast flavor suffix resolution

The system SHALL NOT hardcode `*-fast` model IDs as guaranteed defaults. An optional env suffix (e.g. `NEBIUS_FAST_FLAVOR_SUFFIX`) MAY append to base model IDs only when the suffixed ID exists in the Nebius catalog.

#### Scenario: Fast suffix not in catalog

- **WHEN** a fast flavor suffix is configured but the suffixed model ID is absent from `/v1/models`
- **THEN** the server uses the base model ID without the suffix

### Requirement: Stage-aware model routing

The system SHALL resolve distinct model IDs per stage for Nebius providers: `classify`, `extract_text`, `extract_vision`, `summarize`, `report`, `synthesis`.

#### Scenario: Fast tier classification

- **WHEN** `ai_provider` is `nebius_fast` and the worker classifies a document
- **THEN** the env-configured fast classification model is used (default `Qwen/Qwen3-32B`)

#### Scenario: Quality tier text extraction

- **WHEN** `ai_provider` is `nebius_quality` and OCR text length exceeds 80 characters
- **THEN** the env-configured quality text extraction model is used (default `Qwen/Qwen3-235B-A22B-Instruct-2507`)

### Requirement: Structured JSON with retry

Classification and extraction for Nebius providers SHALL use `response_format: { type: "json_object" }`, Zod or existing parse validation, and **one retry** on invalid JSON before failing.

#### Scenario: Invalid JSON retry

- **WHEN** a classify or extract call returns JSON that fails validation
- **THEN** the server retries the same model once at temperature 0
- **AND** fails the stage if the retry also fails

#### Scenario: json_schema deferred

- **WHEN** operators read AI provider documentation
- **THEN** it notes `json_schema` may be enabled per model after QA verification

### Requirement: Fail-hard vision default for PHI

When `ALLOW_CROSS_PROVIDER_FALLBACK` is `false` (default), Nebius vision extraction failure SHALL fail the document job with a UI-safe English error. The system SHALL NOT silently send PHI to another provider.

#### Scenario: Vision fails with fallback disabled

- **WHEN** `ALLOW_CROSS_PROVIDER_FALLBACK` is `false` and Nebius vision extraction fails
- **THEN** the job fails with a clear English processing error
- **AND** `ai_invocations` records `success: false` and `provider_switch: false`

### Requirement: Opt-in cross-provider vision fallback

When `ALLOW_CROSS_PROVIDER_FALLBACK` is `true`, the system MAY retry vision extraction once with OpenAI `gpt-4o-mini` after Nebius vision failure.

#### Scenario: Vision fails with fallback enabled

- **WHEN** `ALLOW_CROSS_PROVIDER_FALLBACK` is `true` and Nebius vision fails
- **THEN** the worker retries with OpenAI `gpt-4o-mini` vision once
- **AND** the OpenAI invocation row has `provider_switch: true`

#### Scenario: Nebius vision success

- **WHEN** Nebius vision extraction succeeds
- **THEN** no cross-provider fallback is invoked

### Requirement: Nebius request metadata for ops filtering

Worker Nebius calls SHALL pass `user` metadata `easyhealth:{document_id}:{stage}` when supported.

#### Scenario: Classify metadata

- **WHEN** the worker classifies document `doc-123` via Nebius
- **THEN** the request includes `user` value `easyhealth:doc-123:classify`

### Requirement: Full model ID persistence

Resolved Nebius model IDs SHALL be persisted in `extraction_model` on extracted rows.

#### Scenario: Quality model recorded

- **WHEN** extraction uses `Qwen/Qwen3-235B-A22B-Instruct-2507`
- **THEN** `extraction_model` stores that full model ID
