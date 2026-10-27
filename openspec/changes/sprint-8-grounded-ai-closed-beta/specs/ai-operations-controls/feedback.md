# Assistant feedback contract

## ADDED Requirements

### Requirement: Feedback categories are controlled

The feedback endpoint SHALL accept only a request ID issued by the assistant boundary, a positive or negative rating, and a controlled category. It SHALL reject unknown categories, oversized payloads, missing ownership, and client-supplied profile IDs.

#### Scenario: Feedback for an owned request

- **WHEN** a user submits a valid rating and category for their own recent assistant request
- **THEN** the event is stored with the request context
- **AND** no answer or document text is stored
