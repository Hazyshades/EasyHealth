## MODIFIED Requirements

### Requirement: AI provider selection page

The system SHALL provide an AI Settings page at `/app/settings/ai` where the user selects among available LLM providers including ChatGPT, DeepSeek, Tencent Hy3 (free), Nebius Fast, and Nebius Quality.

#### Scenario: User views AI settings

- **WHEN** a signed-in user opens `/app/settings/ai`
- **THEN** the page presents provider options with English labels: **ChatGPT**, **DeepSeek**, **Tencent Hy3 (free)**, **Nebius Fast**, and **Nebius Quality**
- **AND** shows the currently saved selection
- **AND** does not display fields for API keys or custom URLs

#### Scenario: Nebius Fast hint

- **WHEN** Nebius Fast is available
- **THEN** the UI shows a short English hint that it optimizes for speed and lower cost

#### Scenario: Nebius Quality hint

- **WHEN** Nebius Quality is available
- **THEN** the UI shows a short English hint that it optimizes for extraction and report quality

#### Scenario: User saves ChatGPT preference

- **WHEN** the user selects ChatGPT and saves
- **THEN** the client calls `PATCH /api/profile` with `ai_provider` set to `openai`
- **AND** the UI confirms success in English

#### Scenario: User saves Nebius Fast preference

- **WHEN** the user selects Nebius Fast and saves
- **THEN** the client calls `PATCH /api/profile` with `ai_provider` set to `nebius_fast`
- **AND** the UI confirms success in English

#### Scenario: User saves Nebius Quality preference

- **WHEN** the user selects Nebius Quality and saves
- **THEN** the client calls `PATCH /api/profile` with `ai_provider` set to `nebius_quality`
- **AND** the UI confirms success in English

### Requirement: Profile AI provider update API

The system SHALL expose `PATCH /api/profile` accepting `ai_provider` with values `openai`, `deepseek`, `owl_alpha`, `nebius_fast`, or `nebius_quality`.

#### Scenario: Valid Nebius provider update

- **WHEN** a signed-in user sends `PATCH /api/profile` with `{ "ai_provider": "nebius_fast" }` and Nebius is configured
- **THEN** the profile is updated
- **AND** the response reflects the new value

#### Scenario: Invalid provider rejected

- **WHEN** a request includes an unsupported `ai_provider` value
- **THEN** the API returns HTTP 400 with an English error message

#### Scenario: Nebius unavailable on server

- **WHEN** the user selects Nebius Fast or Nebius Quality but `NEBIUS_API_KEY` is not configured
- **THEN** the API returns HTTP 503 or 400 with an English message that the selected Nebius tier is temporarily unavailable
- **AND** does not persist the preference

### Requirement: Server LLM routing by profile preference

All server-side LLM calls for document processing, biomarker extraction, holistic synthesis, and report generation SHALL use models resolved from the session profile's `ai_provider`, including stage-aware routing for Nebius tiers.

#### Scenario: Nebius Fast profile document processing

- **WHEN** a signed-in user with `ai_provider` `nebius_fast` uploads a document for processing
- **THEN** the worker uses Nebius Fast stage-specific models for classify, extract, and summarize

#### Scenario: Nebius Quality profile report generation

- **WHEN** a signed-in user with `ai_provider` `nebius_quality` pays for report generation
- **THEN** report LLM generation uses the Nebius Quality report-stage model

#### Scenario: ChatGPT profile extraction unchanged

- **WHEN** a signed-in user with `ai_provider` `openai` triggers document extraction
- **THEN** the server uses OpenAI `gpt-4o-mini` as today

## ADDED Requirements

### Requirement: Nebius availability flags in profile API

`GET /api/profile` and successful `PATCH /api/profile` responses SHALL include `nebius_fast_available` and `nebius_quality_available` booleans.

#### Scenario: Nebius configured

- **WHEN** `NEBIUS_API_KEY` is set on the server
- **THEN** both `nebius_fast_available` and `nebius_quality_available` are true

#### Scenario: Nebius not configured

- **WHEN** `NEBIUS_API_KEY` is not set
- **THEN** both Nebius availability flags are false
- **AND** Nebius radio options are disabled in AI Settings

### Requirement: Default AI provider unchanged

The system SHALL default to ChatGPT (`openai`) for new profiles. Nebius tiers are opt-in only.

#### Scenario: New profile default

- **WHEN** a new profile is created
- **THEN** `ai_provider` is `openai`
