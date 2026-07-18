## MODIFIED Requirements

### Requirement: Health Profile page

The system SHALL provide a Health Profile page at `/app/profile` displaying a body-map visualization of factual current-state system or organ assessments derived from the user's biomarker observations and a holistic synthesis section when structured data exists.

#### Scenario: User with observations views profile

- **WHEN** a signed-in user with at least one completed lab document opens `/app/profile`
- **THEN** the page displays a body-map with per-system or per-organ current-state assessment indicators
- **AND** shows the count of records used to compute the profile
- **AND** keeps source document citations available on the page or in the selected drawer
- **AND** displays holistic synthesis when available

#### Scenario: User with no data views profile

- **WHEN** a signed-in user with no observations and no accepted non-lab structured data opens `/app/profile`
- **THEN** the page displays an empty state with a CTA to upload documents
- **AND** does not display diagnostic or risk labels

### Requirement: Educational system insights only

Health Profile free insights SHALL use educational and factual language for deterministic marker displays. The holistic synthesis block MAY use one LLM-generated educational narrative that cites uploaded record content and MUST NOT display new diagnoses, treatment recommendations, or disease-risk conclusions beyond what is stated in source documents.

#### Scenario: Out-of-range marker displayed

- **WHEN** a biomarker value is outside the document's reference range
- **THEN** the profile shows the value, unit, date, and source document reference
- **AND** uses neutral phrasing such as "outside lab reference range"
- **AND** does not use labels such as Critical, Healthy, or disease names as conclusions

#### Scenario: Holistic synthesis displayed

- **WHEN** holistic synthesis is available for the user
- **THEN** the profile displays the synthesis with source document references
- **AND** includes the standard medical disclaimer
- **AND** does not replace the paid report CTA in the system drawer for deeper specialty reports

### Requirement: Source document citations

The Health Profile page SHALL list contributing documents with filename and observed date below the visualization, including labs, instrumental reports, and consultations that contributed to holistic synthesis.

#### Scenario: Multiple documents contribute to profile

- **WHEN** the profile is computed from multiple completed documents
- **THEN** the footer lists each contributing document with filename and observed date
- **AND** displays "Used N records" where N is the count of documents used in synthesis and/or biomarker aggregation

## ADDED Requirements

### Requirement: Holistic synthesis on profile page

The Health Profile page SHALL render a dedicated holistic synthesis section when `GET /api/health-profile` returns `holistic_synthesis`.

#### Scenario: Synthesis loading state

- **WHEN** synthesis is being generated
- **THEN** the page shows an English loading or refresh state without blocking deterministic marker display
