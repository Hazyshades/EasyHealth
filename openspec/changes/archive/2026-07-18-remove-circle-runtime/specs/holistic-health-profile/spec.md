## MODIFIED Requirements

### Requirement: Synthesis refresh affordance
The Health Profile SHALL offer a refresh control for users with structured health data. The control SHALL not display a price, wallet balance, or payment state.

#### Scenario: Refresh control shown
- **WHEN** a signed-in user has at least one document with structured data
- **THEN** the synthesis section shows a Refresh synthesis control
- **AND** activating it starts a session-authorized refresh