## MODIFIED Requirements

### Requirement: Documents list failures are visible and recoverable

When the Documents Hub cannot obtain a list — because the server-provided initial payload failed or any client request to `GET /api/documents` failed — the hub SHALL render a visible generic error state with a Retry action instead of an empty-state message. A failed server-provided initial payload SHALL render that error state immediately and SHALL NOT be replaced by an automatic client list request. A successful subsequent list load SHALL clear the error state. The empty state SHALL render only after a successful load with zero documents. A failed periodic refresh SHALL show the same error state; a successful periodic refresh SHALL retain visible rows without a full-page loading state.

#### Scenario: Server initial list fails

- **WHEN** the server wrapper fails to load the initial Lab results list before rendering `/app/documents`
- **THEN** the hub immediately shows an error card with a Retry action instead of a skeleton or the "no documents yet" empty state
- **AND** the hub does not automatically request `GET /api/documents` before the user selects Retry or changes the tab
- **AND** no server error details are exposed in the interface copy

#### Scenario: Client tab fetch fails

- **WHEN** switching tabs returns a non-ok response from `GET /api/documents`
- **THEN** the hub shows the same error card with Retry

#### Scenario: Periodic refresh fetch fails

- **WHEN** a periodic refresh for processing documents returns a non-ok response from `GET /api/documents` or rejects
- **THEN** the hub shows the same error card with Retry
- **AND** the hub does not show a full-page loading state before that error

#### Scenario: Successful reload clears the error

- **WHEN** a subsequent documents load succeeds after any list failure
- **THEN** the error card is removed and the normal list, empty, or loading states apply as usual
