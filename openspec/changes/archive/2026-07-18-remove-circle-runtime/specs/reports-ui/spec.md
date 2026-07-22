## MODIFIED Requirements

### Requirement: Report submission
Submitting valid report input SHALL create a report for the signed-in user without presenting a payment price, wallet state, or payment interaction.

#### Scenario: Successful create flow
- **WHEN** a signed-in user submits valid data
- **THEN** the application creates the report and redirects to `/app/reports/[id]`

#### Scenario: Generation failure
- **WHEN** report generation fails
- **THEN** the create page shows an English error message and retains the entered context