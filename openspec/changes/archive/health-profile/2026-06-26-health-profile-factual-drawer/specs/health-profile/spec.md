## MODIFIED Requirements

### Requirement: Health Profile page

The system SHALL provide a Health Profile page at `/app/profile` displaying a body-map visualization of factual current-state system or organ assessments derived from the user's biomarker observations.

#### Scenario: User with observations views profile

- **WHEN** a signed-in user with at least one completed lab document opens `/app/profile`
- **THEN** the page displays a body-map with per-system or per-organ current-state assessment indicators
- **AND** shows the count of records used to compute the profile
- **AND** keeps source document citations available on the page or in the selected drawer

#### Scenario: User with no data views profile

- **WHEN** a signed-in user with no observations opens `/app/profile`
- **THEN** the page displays an empty state with a CTA to upload a lab
- **AND** does not display diagnostic or risk labels

### Requirement: Educational system insights only

Health Profile free insights SHALL use educational and factual language and MUST NOT display diagnoses, treatment recommendations, disease-risk conclusions, or LLM-generated clinical narrative.

#### Scenario: Out-of-range marker displayed

- **WHEN** a biomarker value is outside the document's reference range
- **THEN** the profile shows the value, unit, date, and source document reference
- **AND** uses neutral phrasing such as "outside lab reference range"
- **AND** does not use labels such as Critical, Healthy, or disease names as conclusions

#### Scenario: Narrative insights are unavailable

- **WHEN** the selected drawer would otherwise show hypotheses, recommendations, or narrative interpretation
- **THEN** the page displays a paid report CTA instead of generating or showing a free LLM summary
- **AND** the CTA explains that AI insights require generating a report

### Requirement: Data coverage labeling

Per-system and overall profile indicators SHALL be labeled as current state assessments, with data confidence shown separately from the score.

#### Scenario: System badge shows assessment

- **WHEN** a body-system has biomarker observations
- **THEN** the badge shows a 0-100 score labeled as a current state assessment
- **AND** the selected drawer shows data confidence as a separate percentage
- **AND** the page does not describe the score as disease risk, diagnosis probability, or mortality risk

## ADDED Requirements

### Requirement: Factual side drawer

The Health Profile page SHALL open a right-side drawer when the user selects a body-map score or system entry.

#### Scenario: User selects a score

- **WHEN** the user clicks or keyboard-selects a body-map score
- **THEN** a side drawer opens for the selected system or organ
- **AND** the drawer displays the selected label, current state assessment score, data confidence, and factual details

#### Scenario: Drawer shows source data

- **WHEN** the selected system or organ has contributing observations
- **THEN** the drawer displays data cards with biomarker name, value, unit, reference-range status, observed date, and source document metadata
- **AND** the drawer identifies the source document or documents that contributed to the selection

### Requirement: Paid insights CTA in profile drawer

The Health Profile drawer SHALL gate LLM-generated insights behind the existing paid report flow.

#### Scenario: User wants deeper insights

- **WHEN** the user views the selected drawer
- **THEN** the drawer displays a "Generate report to see insights" CTA
- **AND** activating the CTA navigates to the report creation flow
- **AND** the profile page does not call an unpaid LLM endpoint
