## ADDED Requirements

### Requirement: Documents list failures are visible and recoverable

When the documents hub cannot obtain a list — because the server-provided initial payload failed or a client fetch to `GET /api/documents` failed — the hub SHALL render a visible error state with a Retry action instead of an empty-state message. A successful reload SHALL clear the error state. The empty state SHALL render only after a load succeeds with zero documents.

#### Scenario: Server initial list fails

- **WHEN** the server wrapper fails to load the initial Lab results list before rendering `/app/documents`
- **THEN** the hub shows an error card with a Retry action instead of the "no documents yet" empty state
- **AND** no server error details are exposed in the interface copy

#### Scenario: Client tab fetch fails

- **WHEN** switching tabs returns a non-ok response from `GET /api/documents`
- **THEN** the hub shows the same error card with Retry

#### Scenario: Successful reload clears the error

- **WHEN** any subsequent documents load succeeds after a failure
- **THEN** the error card is removed and the normal list, empty, or loading states apply as usual
