# document-structured-insights Specification

## ADDED Requirements

### Requirement: Accepted structured findings can enter assistant evidence

Accepted published instrumental findings, consultation notes, discharge summaries, prescriptions, referrals, and document summaries MAY enter the assistant source projection only when their owning document is active, upload-complete, processed, and profile-scoped. Unaccepted staging rows SHALL remain excluded.

#### Scenario: Accepted consultation note

- **WHEN** an active processed consultation note has an accepted published extracted note
- **THEN** the assistant can cite its structured fields with the source document identifier

#### Scenario: Unpublished finding

- **WHEN** an extracted finding is accepted but not published under the current structured insight boundary
- **THEN** the assistant excludes it until the existing publication contract makes it eligible
