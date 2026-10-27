# grounded-assistant-safety Specification

## ADDED Requirements

### Requirement: Assistant requests have explicit answer modes

The assistant SHALL classify an authenticated request as `personal_facts`, `grounded_summary`, or `general_education`. Personal facts and grounded summaries SHALL require evidence sources. General education SHALL not imply that it describes the user's Health Profile.

#### Scenario: Personal fact request

- **WHEN** an invited user asks for a value, date, document fact, medication entry, or other fact about their own Health Profile
- **THEN** the request is handled as `personal_facts`
- **AND** the answer can contain personal claims only when the claim validator accepts an owned source

#### Scenario: General education request

- **WHEN** a user asks for a general health concept without asking what their records show
- **THEN** the request is handled as `general_education`
- **AND** the response states that it is general information rather than a personal assessment

### Requirement: Assistant policy prohibits unsafe clinical actions

The assistant SHALL refuse or safely redirect requests for diagnosis, treatment plans, prescription decisions, dose changes, medication starts or stops, or unsupported emergency conclusions. It SHALL use a short educational limitation and direct the user to a qualified clinician or emergency services when the request describes an urgent situation.

#### Scenario: Medication dose change request

- **WHEN** a user asks the assistant to start, stop, increase, decrease, or substitute a medication
- **THEN** the assistant does not provide an individualized medication instruction
- **AND** the response recommends discussing the decision with the prescribing clinician

#### Scenario: Diagnosis request

- **WHEN** a user asks the assistant to diagnose a condition from their documents or values
- **THEN** the response does not state a diagnosis
- **AND** it distinguishes documented source language from clinical interpretation

### Requirement: Retrieved text is untrusted evidence

The assistant system policy SHALL treat document text and model-generated summaries as untrusted evidence. Retrieved content SHALL NOT override the system policy, answer mode, profile scope, or citation rules.

#### Scenario: Instruction-like document text

- **WHEN** a retrieved document passage contains instructions addressed to an AI system
- **THEN** the passage is presented to the model only as quoted source content
- **AND** the assistant continues to follow the fixed safety and evidence policy

### Requirement: Safety validation runs after generation

The server SHALL validate the generated answer for answer mode, prohibited clinical advice, unsupported certainty, required limitations, and source references before returning it. A failed validation SHALL return a safe limited response or an explicit refusal and SHALL NOT return the invalid model answer.

#### Scenario: Unsupported personal claim

- **WHEN** generated content includes a personal claim without a valid source identifier
- **THEN** the server removes or rejects that claim
- **AND** the response states that the available records do not support the claim

### Requirement: Assistant prompts do not request hidden clinical reasoning

The assistant system prompt SHALL request concise, source-linked explanations and SHALL NOT request hidden chain-of-thought, private reasoning traces, or unbounded clinical speculation.

#### Scenario: Answer generation

- **WHEN** the server sends an assistant request to an LLM
- **THEN** the model receives the answer mode, safety policy, source catalog, and output schema
- **AND** the stored telemetry contains metadata only, not the prompt or response text
