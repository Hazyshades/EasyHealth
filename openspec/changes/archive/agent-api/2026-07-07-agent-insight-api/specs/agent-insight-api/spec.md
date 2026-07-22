## ADDED Requirements

### Requirement: Stateless agent insight endpoints

The system SHALL expose an agent-facing endpoint family under `/api/agent/*` that accepts health data in the request body and returns structured JSON insights, without requiring a browser cookie or any pre-uploaded user documents. The family SHALL include `POST /api/agent/quick-insight`, `POST /api/agent/trend-analysis`, `POST /api/agent/holistic-synthesis`, and `POST /api/agent/clinician-summary`.

#### Scenario: Clinician summary from body-supplied data

- **WHEN** a caller sends `POST /api/agent/clinician-summary` with a valid `data` payload of biomarkers and a settled payment
- **THEN** the system generates the summary from the body data alone, without reading any stored profile documents
- **THEN** the response is HTTP 200 with structured fields including `overview`, `key_findings`, `questions_for_clinician`, `when_to_seek_care`, and `disclaimer`

#### Scenario: No cookie required

- **WHEN** a headless agent with no `eh_profile_id` cookie calls any `/api/agent/*` insight endpoint with a valid settled payment
- **THEN** the request is not rejected with HTTP 401 for missing session
- **THEN** the handler executes using the request body as the sole data source

### Requirement: Request payload validation before payment

The system SHALL validate the agent request body against a schema before requiring or accepting payment, and SHALL reject malformed or empty payloads with HTTP 400 without charging or invoking the LLM.

#### Scenario: Malformed payload rejected without charge

- **WHEN** a caller sends an agent endpoint request whose `data` fails schema validation
- **THEN** the system returns HTTP 400 with a validation error
- **THEN** no `402` quote is issued, no settlement occurs, and no LLM call is made

#### Scenario: Valid payload proceeds to pricing

- **WHEN** a caller sends a well-formed `data` payload without payment
- **THEN** the system proceeds to compute a price and returns HTTP 402 with a quote

### Requirement: No PHI persisted in stateless mode

The system SHALL process agent-submitted health data in memory only and SHALL NOT persist that health data. Only payment metadata (payer, amount, network, transaction) SHALL be stored, and no health data SHALL be written on-chain.

#### Scenario: Stateless request leaves no health record

- **WHEN** an agent insight request completes successfully
- **THEN** the submitted biomarkers/findings are not stored in any table
- **THEN** only a `payment_receipts` row (payer, amount, network, gateway_tx) is created

### Requirement: Mandatory medical safety guardrails

Every agent insight response SHALL be educational only, SHALL NOT contain diagnoses, prescriptions, treatment plans, or risk scores, and SHALL include the mandatory medical disclaimer text.

#### Scenario: Disclaimer present in every insight

- **WHEN** any `/api/agent/*` insight endpoint returns HTTP 200
- **THEN** the response includes the `MEDICAL_DISCLAIMER` text
- **THEN** the content contains no diagnosis, prescription, or numeric risk score
