## MODIFIED Requirements

### Requirement: Biomarkers overview page

The system SHALL provide a Biomarkers page at `/app/biomarkers` displaying a table of accepted Registry 2.0 observations and a trend chart for a selected resolved concrete measurement definition. The table SHALL preserve factual incomplete observations with their raw presentation and resolver state. A definition-specific trend SHALL use the active `measurement_definition_key`, not a Registry v1 or legacy-shaped biomarker fallback key.

#### Scenario: User views biomarker table

- **WHEN** a signed-in user with observations opens `/app/biomarkers`
- **THEN** the page displays each factual observation with biomarker name, value, unit, reference range, observed date, and Registry 2.0 resolver state
- **AND** incomplete rows remain visible without fabricated concrete identity

#### Scenario: User selects a concrete measurement for trend chart

- **WHEN** the user selects a resolved concrete measurement definition from the trend control
- **THEN** the trend chart updates to show historical values with that active measurement-definition identity ordered by observed date
- **AND** it does not combine partial, ambiguous, unmapped, or different concrete definitions into the series

#### Scenario: User views an incomplete accepted row

- **WHEN** the table contains an accepted partial, ambiguous, or unmapped observation
- **THEN** the page presents it as factual source data
- **AND** it is not offered as a concrete definition-specific trend series
