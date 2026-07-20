## ADDED Requirements

### Requirement: Document observations expose active Registry 2.0 revision dimensions

`GET /api/documents/:id/observations` and the document bootstrap observation payload SHALL expose `resolution_status` from the observation projection and `resolver_result`, `verification_status`, and active-link state from its active normalization revision when one exists. The response SHALL preserve nullable Registry 2.0 analyte and measurement-definition identity and MUST NOT substitute Registry v1 fallback identity.

#### Scenario: Owner reads an accepted partial observation

- **WHEN** an authenticated document owner requests observations for a document containing an accepted partial result
- **THEN** the response identifies its `partial` resolver outcome and `pending` verification status from the active revision
- **AND** its concrete measurement-definition key is null

#### Scenario: Inactive historical revision exists

- **WHEN** an observation has historical inactive revisions and one active revision
- **THEN** the response uses only the active revision for resolver and verification dimensions
- **AND** it does not present an inactive candidate as current observation state
