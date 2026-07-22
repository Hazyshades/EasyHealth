## ADDED Requirements

### Requirement: AI provider selection page

The system SHALL provide an AI Settings page at `/app/settings/ai` where the user selects between ChatGPT and DeepSeek.

#### Scenario: User views AI settings

- **WHEN** a signed-in user opens `/app/settings/ai`
- **THEN** the page presents exactly two provider options labeled **ChatGPT** and **DeepSeek** in English
- **AND** shows the currently saved selection
- **AND** does not display fields for API keys or custom URLs

#### Scenario: User saves ChatGPT preference

- **WHEN** the user selects ChatGPT and saves
- **THEN** the client calls `PATCH /api/profile` with `ai_provider` set to `openai`
- **AND** the UI confirms success in English

#### Scenario: User saves DeepSeek preference

- **WHEN** the user selects DeepSeek and saves
- **THEN** the client calls `PATCH /api/profile` with `ai_provider` set to `deepseek`
- **AND** the UI confirms success in English

### Requirement: Default AI provider

The system SHALL default to ChatGPT (`openai`) for profiles without an explicit preference.

#### Scenario: New profile default

- **WHEN** a new profile is created
- **THEN** `ai_provider` is `openai`
- **AND** server LLM calls use the OpenAI ChatGPT model configured for the app

### Requirement: Profile AI provider update API

The system SHALL expose `PATCH /api/profile` accepting `ai_provider` with values `openai` or `deepseek` only.

#### Scenario: Valid provider update

- **WHEN** a signed-in user sends `PATCH /api/profile` with `{ "ai_provider": "deepseek" }`
- **THEN** the profile is updated
- **AND** the response reflects the new value

#### Scenario: Invalid provider rejected

- **WHEN** a request includes an unsupported `ai_provider` value
- **THEN** the API returns HTTP 400 with an English error message

#### Scenario: DeepSeek unavailable on server

- **WHEN** the user selects DeepSeek but `DEEPSEEK_API_KEY` is not configured on the server
- **THEN** the API returns HTTP 503 or 400 with an English message that DeepSeek is temporarily unavailable
- **AND** does not persist the preference

### Requirement: Server LLM routing by profile preference

All server-side LLM calls for biomarker extraction and report generation SHALL use the model resolved from the session profile's `ai_provider`.

#### Scenario: ChatGPT profile extraction

- **WHEN** a signed-in user with `ai_provider` `openai` triggers paid document extraction
- **THEN** the server uses the OpenAI ChatGPT model (`gpt-4o-mini` or configured default)

#### Scenario: DeepSeek profile extraction

- **WHEN** a signed-in user with `ai_provider` `deepseek` triggers paid document extraction
- **THEN** the server uses the configured DeepSeek model via server `DEEPSEEK_API_KEY`

#### Scenario: ChatGPT profile report generation

- **WHEN** a signed-in user with `ai_provider` `openai` pays for report generation
- **THEN** report LLM generation uses OpenAI ChatGPT

#### Scenario: DeepSeek profile report generation

- **WHEN** a signed-in user with `ai_provider` `deepseek` pays for report generation
- **THEN** report LLM generation uses DeepSeek

### Requirement: No user-supplied API credentials

The AI Settings UI and profile APIs SHALL NOT accept user API keys, secrets, or custom provider base URLs.

#### Scenario: API rejects credential fields

- **WHEN** a client sends `api_key` or `base_url` in profile settings payload
- **THEN** those fields are ignored or rejected
- **AND** only `ai_provider` enum is persisted

### Requirement: x402 unchanged

Changing AI provider preference SHALL NOT alter x402 payment requirements or prices for upload or report endpoints.

#### Scenario: Upload still requires payment

- **WHEN** a user uploads a document for extraction regardless of AI provider
- **THEN** unpaid requests still receive HTTP 402 per existing rules

### Requirement: English UI strings for AI settings

All labels, descriptions, and errors on the AI Settings page SHALL be in English.

#### Scenario: AI settings language

- **WHEN** the AI Settings page is rendered
- **THEN** all visible strings are English
