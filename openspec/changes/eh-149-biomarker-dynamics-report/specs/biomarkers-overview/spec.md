# biomarkers-overview

## MODIFIED Requirements

### Requirement: Biomarkers overview page

The Biomarkers page SHALL display the existing observation table and trend chart plus a report-ready dynamics view with an inclusive period selector, min/max/latest statistics, numeric direction, source ledger, reference ranges, and explicit incompatibility warnings. Existing exact-definition grouping and safe preferred-unit conversion SHALL remain authoritative.

#### Scenario: User views dynamics for a compatible series

- **WHEN** a signed-in user selects a biomarker and period with compatible numeric history
- **THEN** the page shows the filtered chart and dynamics statistics
- **AND** the direction label is limited to numeric movement wording
- **AND** every point retains a source document and native range

#### Scenario: User sees incompatible evidence

- **WHEN** observations with the same display name cannot be safely combined
- **THEN** the page shows separate series
- **AND** displays an explanation instead of a merged trend

#### Scenario: Existing conversion guard remains in force

- **WHEN** a preferred-unit conversion is unsafe or not defined
- **THEN** the page uses lab-native values and units
- **AND** the dynamics report does not calculate across incompatible units
