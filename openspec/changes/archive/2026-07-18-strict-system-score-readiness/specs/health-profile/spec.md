## MODIFIED Requirements

### Requirement: Data coverage labeling

Per-system and overall profile indicators SHALL be labeled as current state assessments, with data confidence shown separately from score readiness and the score.

#### Scenario: Scoreable system badge shows assessment

- **WHEN** a scoreable named body-system satisfies every configured `scoreRequiredGroups` group with usable numeric markers and document lab reference ranges
- **THEN** the badge shows a 0-100 score labeled as a current state assessment
- **AND** the selected drawer shows data confidence as a separate percentage
- **AND** the page does not describe the score as disease risk, diagnosis probability, or mortality risk

#### Scenario: Unscored system badge shows no numeric assessment

- **WHEN** a named body-system has no data, incomplete required groups, or required markers without usable document reference ranges
- **THEN** the badge shows `—` instead of `0/100`
- **AND** the page does not present the unavailable assessment as a poor health result

### Requirement: Factual side drawer

The Health Profile page SHALL open a right-side drawer when the user selects a body-map system or system entry.

#### Scenario: User selects a scoreable system

- **WHEN** the user clicks or keyboard-selects a scoreable body-map system or system entry
- **THEN** a side drawer opens for the selected system or organ
- **AND** the drawer displays the selected label, current state assessment score, data confidence, and factual details

#### Scenario: User selects an unscored named system

- **WHEN** the user selects a named system whose score is unavailable
- **THEN** the drawer displays `No data` or `Not scored · incomplete core` as applicable
- **AND** lists missing `scoreRequiredGroups` markers
- **AND** lists required markers present without a usable document reference range separately
- **AND** lists supporting extended or display markers already in the record
- **AND** provides an upload-document CTA

#### Scenario: User selects General

- **WHEN** the user selects General
- **THEN** the drawer displays `Not scored · supporting / specialty data`
- **AND** explains that its markers do not drive named-system assessments
- **AND** keeps every marker display factual and source-attributed

#### Scenario: Drawer shows source data

- **WHEN** the selected system or organ has contributing observations
- **THEN** the drawer displays data cards with biomarker name, value, unit, reference-range status, observed date, and source document metadata
- **AND** the drawer identifies the source document or documents that contributed to the selection

### Requirement: Expanded body systems on profile map

After at least one biomarker observation exists, the Health Profile body map SHALL display all eight named systems derived from the biomarker catalog: cardiovascular, metabolic, thyroid, liver, kidney, blood, nutrients, and inflammation.

#### Scenario: S3 map after first biomarker observation

- **WHEN** the user has one or more biomarker observations
- **THEN** the body map includes every named system, including systems without observations
- **AND** every unavailable system has an interactive unscored badge
- **AND** General is shown only when at least one marker is unmapped, specialty, or routed to General

#### Scenario: Inflammation markers appear as inflammation system

- **WHEN** the user has CRP, hs-CRP, or ESR observations
- **THEN** the body map includes an inflammation system assessment
- **AND** does not leave those markers solely under General when cataloged

#### Scenario: Nutrients system shows vitamin markers

- **WHEN** the user has vitamin D, B12, or folate observations
- **THEN** they appear under the nutrients system on the body map

### Requirement: Core-only system state scoring

System state scores on the Health Profile SHALL be computed only from usable catalog `core` contribution groups and document lab reference ranges, using the document's lab ranges rather than external optimal targets.

#### Scenario: Complete required groups unlock score

- **WHEN** every `scoreRequiredGroups` group for a named system contains at least one usable numeric marker with a document lab reference range
- **THEN** the system displays a numeric score calculated from usable `core` contribution groups
- **AND** extended and display markers do not contribute to readiness or the numeric score

#### Scenario: Correlated core markers do not receive duplicate score weight

- **WHEN** two or more usable core markers belong to the same configured `scoreContributionGroup`
- **THEN** the numeric score uses at most one deterministic contribution from that group
- **AND** the other markers remain available as factual observations

#### Scenario: Incomplete groups keep assessment unavailable

- **WHEN** one or more required groups is missing or contains only markers without usable document reference ranges
- **THEN** the named system score is unavailable and displayed as `—`
- **AND** the system is not assigned a soft fallback score, unknown-reference score, or `0`

#### Scenario: Extended marker out of range does not drive equal-weight core score

- **WHEN** only an extended marker is out of lab range and all usable core markers are in range
- **THEN** the system state score remains based on usable core markers
- **AND** the extended out-of-range value may still be listed factually in the drawer

## ADDED Requirements

### Requirement: Overall assessment availability

The Health Profile SHALL calculate the overall current-state assessment from scoreable named systems only.

#### Scenario: No named systems are scoreable

- **WHEN** fewer than three named systems satisfy their `scoreRequiredGroups`
- **THEN** the profile shows `Insufficient data for overall assessment` instead of a numeric overall score
- **AND** provides a dismiss control

#### Scenario: User dismisses insufficient-data state

- **WHEN** the user dismisses the insufficient-data overall state while no named system is scoreable
- **THEN** the profile hides the overall assessment block for that user in that browser

#### Scenario: Dashboard insufficient-data card remains visible

- **WHEN** fewer than three named systems are scoreable and the Dashboard renders its health-assessment widget
- **THEN** the widget displays the insufficient-data explanation and scoreable-system denominator
- **AND** it provides no dismiss control
- **AND** a profile-page dismissal does not hide the Dashboard widget or leave an empty dashboard grid cell

#### Scenario: New scoreable evidence overrides dismissal

- **WHEN** a previously dismissed profile later has at least three scoreable named systems
- **THEN** the profile shows the numeric overall assessment
- **AND** computes it as the average of scoreable named-system scores only
- **AND** displays the number of scoreable named systems out of eight

### Requirement: Profile display states before S3

The Health Profile SHALL distinguish absent data from uploaded documents that did not yield recognized biomarker observations.

#### Scenario: User has no uploaded or accepted data

- **WHEN** the user has no observations and no accepted non-lab structured data
- **THEN** the page displays the existing onboarding empty state with an upload CTA
- **AND** does not render the S3 body map

#### Scenario: Uploaded document has no recognized biomarkers

- **WHEN** the user has uploaded or processed document data but zero recognized biomarker observations
- **THEN** the page displays an uploaded / no recognized lab data state
- **AND** does not render the S3 body map
