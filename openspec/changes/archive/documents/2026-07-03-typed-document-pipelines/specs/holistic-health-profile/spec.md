## ADDED Requirements

### Requirement: Holistic synthesis section

The Health Profile SHALL include an LLM-generated **holistic synthesis** section that combines accepted biomarkers, instrumental findings, and consultation notes across the user's documents into one educational narrative with source references.

#### Scenario: User with mixed document types

- **WHEN** a signed-in user has at least one lab with accepted observations and at least one instrumental or consultation document with accepted structured data
- **THEN** the Health Profile page displays a holistic synthesis block citing contributing document filenames and dates
- **AND** the synthesis uses educational language only

#### Scenario: User with labs only

- **WHEN** a user has only lab data and no instrumental or consultation structured data
- **THEN** the holistic synthesis is generated from biomarker data and lab document summaries only

### Requirement: Synthesis caching

The system SHALL cache holistic synthesis per profile and regenerate when underlying structured data changes (hash of inputs).

#### Scenario: Cached synthesis served

- **WHEN** structured inputs have not changed since the last synthesis
- **THEN** `GET /api/health-profile` returns the cached synthesis without a new LLM call

#### Scenario: New document updates synthesis

- **WHEN** a new document with accepted structured data is added
- **THEN** the next health profile request triggers synthesis regeneration or marks cache stale

### Requirement: Synthesis safety

Holistic synthesis SHALL NOT present new diagnoses, treatment plans, or disease-risk scores. It SHALL summarize what appears across uploaded records.

#### Scenario: Synthesis disclaimer

- **WHEN** holistic synthesis is displayed
- **THEN** the standard medical disclaimer is shown adjacent to or within the synthesis section

### Requirement: Deterministic markers preserved

The existing deterministic body-map and per-system biomarker assessments SHALL remain unchanged and continue to be computed without an LLM.

#### Scenario: Body map still deterministic

- **WHEN** a user views the Health Profile with biomarker observations
- **THEN** body-map scores and drawer marker cards are computed deterministically from observations
- **AND** holistic synthesis is additive, not a replacement for marker cards
