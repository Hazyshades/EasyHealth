## MODIFIED Requirements

### Requirement: Holistic synthesis section

The Health Profile SHALL include an LLM-generated **holistic synthesis** section that combines accepted biomarkers, instrumental findings, consultation notes, discharge summaries, prescriptions, and referrals across the user's documents into one educational narrative with source references.

#### Scenario: User with mixed document types

- **WHEN** a signed-in user has structured data from multiple document types including at least one lab observation or accepted extraction
- **THEN** the Health Profile page displays a holistic synthesis block citing contributing document filenames and dates
- **AND** the synthesis uses educational language only

#### Scenario: User with labs only

- **WHEN** a user has only lab data and no other structured document data
- **THEN** the holistic synthesis is generated from biomarker data and lab document summaries only

### Requirement: Synthesis caching

The system SHALL cache holistic synthesis per profile and regenerate when underlying structured data changes (hash of inputs). Users MAY pay to force refresh via the paid synthesis endpoint.

#### Scenario: Cached synthesis served

- **WHEN** structured inputs have not changed since the last synthesis
- **THEN** `GET /api/health-profile` returns the cached synthesis without a new LLM call

#### Scenario: New document updates synthesis

- **WHEN** a new document with accepted structured data is added
- **THEN** the next health profile request triggers synthesis regeneration or marks cache stale

## ADDED Requirements

### Requirement: Paid synthesis refresh affordance

The Health Profile SHALL display a control to refresh holistic synthesis via paid x402 when the user chooses to regenerate.

#### Scenario: Refresh button shown

- **WHEN** a user has at least one document with structured data
- **THEN** the holistic synthesis section includes a Refresh synthesis control with visible USDC price

### Requirement: Instrumental observations on profile

The Health Profile chart and drawer SHALL include observations sourced from instrumental numeric measures with distinct labeling.

#### Scenario: Instrumental EF on chart

- **WHEN** a user has an instrumental observation for ejection fraction
- **THEN** the Health Profile displays the value on the biomarker timeline with instrumental source labeling
