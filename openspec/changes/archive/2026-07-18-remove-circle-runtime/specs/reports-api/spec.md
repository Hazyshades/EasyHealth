## MODIFIED Requirements

### Requirement: Session-authorized report generation API
`POST /api/reports` SHALL generate and persist an educational report for the signed-in user's profile without payment negotiation.

#### Scenario: Authenticated report generation
- **WHEN** a signed-in user submits valid report-generation input
- **THEN** the application generates, persists, and returns the report
- **AND** no payment header, wallet state, or payment settlement is required

#### Scenario: Unauthenticated report generation
- **WHEN** a request lacks a valid Supabase Auth session
- **THEN** the endpoint returns HTTP 401 before invoking the language model