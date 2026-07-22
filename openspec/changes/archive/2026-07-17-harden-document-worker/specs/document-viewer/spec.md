## MODIFIED Requirements

### Requirement: Document viewer stops polling on timeout
The viewer MUST stop the processing-status poll after a maximum duration without a status change, instead of polling indefinitely.

#### Scenario: Processing exceeds the poll timeout
- **WHEN** the document remains `processing` longer than the client poll timeout
- **THEN** the viewer stops the 8s poll and shows a recoverable state (not an infinite spinner)

### Requirement: Viewer surfaces worker-offline / stuck state
The viewer MUST surface a recoverable banner when processing is stuck or the worker is offline, offering Retry and Reprocess actions.

#### Scenario: Worker reported offline while processing
- **WHEN** the worker is reported offline (stale heartbeat) and the document is `processing`
- **THEN** the viewer shows an offline/stuck banner with Retry and Reprocess actions instead of only "Extraction in progress…"

#### Scenario: User retries from the stuck state
- **WHEN** the user invokes Retry from the stuck state
- **THEN** the viewer re-enters the processing poll

#### Scenario: User reprocesses from the stuck state
- **WHEN** the user invokes Reprocess from the stuck state
- **THEN** the viewer triggers the existing reprocess flow and re-enters the processing poll
