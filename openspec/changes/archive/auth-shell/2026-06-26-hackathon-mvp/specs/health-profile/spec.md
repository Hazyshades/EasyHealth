## ADDED Requirements

### Requirement: Health Profile page

The system SHALL provide a Health Profile page at `/app/profile` displaying a body-map visualization of educational system insights derived from the user's biomarker observations.

#### Scenario: User with observations views profile

- **WHEN** a signed-in user with at least one completed lab document opens `/app/profile`
- **THEN** the page displays a body-map with per-system data coverage indicators
- **AND** shows the count of records used to compute the profile

#### Scenario: User with no data views profile

- **WHEN** a signed-in user with no observations opens `/app/profile`
- **THEN** the page displays an empty state with a CTA to upload a lab
- **AND** does not display diagnostic or risk labels

### Requirement: Educational system insights only

Health Profile insights SHALL use educational language and MUST NOT display diagnoses, treatment recommendations, or clinical risk scores.

#### Scenario: Out-of-range marker displayed

- **WHEN** a biomarker value is outside the document's reference range
- **THEN** the profile shows the value, unit, date, and source document reference
- **AND** uses neutral phrasing such as "outside lab reference range"
- **AND** does not use labels such as Critical, Healthy, or disease names as conclusions

### Requirement: Source document citations

The Health Profile page SHALL list contributing documents with filename and observed date below the visualization.

#### Scenario: Multiple documents contribute to profile

- **WHEN** the profile is computed from multiple completed documents
- **THEN** the footer lists each contributing document with filename and observed date
- **AND** displays "Used N records" where N is the count of completed documents

### Requirement: Medical disclaimer on profile

The Health Profile page SHALL display the standard medical disclaimer at the bottom of the page.

#### Scenario: Disclaimer always visible

- **WHEN** any user views the Health Profile page
- **THEN** the text "This is not medical advice. Consult a healthcare professional." is displayed

### Requirement: Data coverage labeling

Per-system and overall scores SHALL be labeled as data coverage, not health scores.

#### Scenario: System badge shows coverage

- **WHEN** a body-system has biomarker observations
- **THEN** the badge shows a percentage labeled as coverage or data coverage
- **AND** does not use health score or wellness grade terminology
