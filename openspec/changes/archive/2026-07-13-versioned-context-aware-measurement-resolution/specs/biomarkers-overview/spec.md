## ADDED Requirements

### Requirement: Measurement-compatible trend series
The Biomarkers overview SHALL group trend points only when their active measurement definitions are compatible with the selected series.

#### Scenario: RDW variants are not mixed
- **WHEN** a user has RDW-CV and RDW-SD observations
- **THEN** the page SHALL NOT plot them in one trend series
- **AND** each factual observation remains accessible with its unit and source provenance

#### Scenario: Unresolved observation is displayed but not trended
- **WHEN** an observation has no active resolved measurement definition
- **THEN** the page may display its factual raw result
- **AND** it SHALL NOT be mixed into a normalized biomarker trend
