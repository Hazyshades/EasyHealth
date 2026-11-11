# closed-beta-onboarding Specification

## ADDED Requirements

### Requirement: Assistant access requires invite and current consent

The assistant page and API SHALL require a server-set closed-beta invite flag, a valid Supabase session, and the current required profile consents. Users without the invite SHALL retain access to the existing app and SHALL receive a clear beta-access state instead of an unauthorized data response.

#### Scenario: Invited user with consent

- **WHEN** a signed-in profile has `closed_beta_enabled` and current required consents
- **THEN** the assistant page and request endpoint are available

#### Scenario: Non-invited user

- **WHEN** a signed-in profile has not been invited to the closed beta
- **THEN** the assistant route returns a beta-access response
- **AND** it does not retrieve documents, observations, embeddings, or invoke an LLM

#### Scenario: Consent is stale

- **WHEN** the invite flag is set but required consent is missing or not current
- **THEN** the assistant request is blocked until the existing consent gate is completed

### Requirement: Beta onboarding explains limitations before use

The assistant UI SHALL show the personal-data scope, medical-safety limitation, citation behavior, and feedback/support path before the first request. The text SHALL be English-only and shall not claim diagnosis, treatment, compliance, or production availability.

#### Scenario: First assistant visit

- **WHEN** an invited user opens the assistant for the first time
- **THEN** the page shows the usage limitation and evidence behavior before the input is submitted

### Requirement: Synthetic examples do not alter Health Profile data

The beta UI SHALL offer a clearly labeled synthetic example path for testing. Synthetic examples SHALL be deterministic, separated from personal retrieval, and SHALL never write observations, documents, medical events, or embeddings to the user's profile.

#### Scenario: Synthetic example

- **WHEN** a user selects a synthetic example
- **THEN** the assistant renders the example answer and source labels without reading or writing personal health data

### Requirement: Feedback is controlled and contextual

The assistant UI SHALL offer positive/negative feedback and a controlled category after an answer. Feedback SHALL be linked to the assistant request ID and source counts, but SHALL not collect document text or answer text by default.

#### Scenario: User reports missing evidence

- **WHEN** a user selects negative feedback and the missing-evidence category
- **THEN** the server stores the category and request context
- **AND** the UI confirms receipt without exposing internal telemetry
