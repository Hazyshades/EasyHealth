# user-onboarding Specification

## ADDED Requirements

### Requirement: Closed-beta access follows existing onboarding gates

After the existing profile and consent gates pass, a closed-beta assistant SHALL require an operator-set invite flag. The invite gate SHALL not block the existing app shell or unrelated session-gated actions.

#### Scenario: Profile and consent complete without invite

- **WHEN** a user has completed profile and current consent onboarding but has no closed-beta invite
- **THEN** the user can access the existing app
- **AND** the assistant explains that beta access is not enabled

#### Scenario: Invite revoked

- **WHEN** an operator revokes the closed-beta flag
- **THEN** subsequent assistant requests are blocked
- **AND** previously stored feedback and non-PHI telemetry remain available to operators
