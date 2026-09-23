# reports-api

## MODIFIED Requirements

### Requirement: Report output schema and safety

Generated report content SHALL pass the EH-150 citation validator before it is persisted as publishable content. The stored payload SHALL conform to the EH-148 contract, include the mandatory educational disclaimer, and record validation status/version. A limited result is publishable only when all remaining factual claims have valid citations and the limitations are visible.

#### Scenario: Broken citation prevents publication

- **WHEN** generation produces a missing, unknown, cross-profile, or out-of-scope citation
- **THEN** the server sanitizes it or returns a validation failure according to the issue policy
- **AND** it does not persist a shareable/exportable report containing the broken claim

#### Scenario: Successful validated report is persisted

- **WHEN** all factual claims resolve to in-scope sources for the session profile
- **THEN** the server persists the validated structured payload and validator metadata
- **AND** the response contains the same validated content that was stored
