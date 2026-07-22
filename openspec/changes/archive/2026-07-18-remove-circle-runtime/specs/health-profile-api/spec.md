## MODIFIED Requirements

### Requirement: Session-authorized synthesis refresh route
`POST /api/health-profile/synthesis` SHALL regenerate holistic synthesis for the signed-in user's profile without payment negotiation.

#### Scenario: Authenticated synthesis refresh
- **WHEN** a signed-in user requests synthesis refresh
- **THEN** the endpoint returns regenerated educational synthesis JSON
- **AND** no payment header, wallet state, or payment settlement is required

#### Scenario: Unauthenticated synthesis refresh
- **WHEN** a request lacks a valid Supabase Auth session
- **THEN** the endpoint returns HTTP 401 before language-model work