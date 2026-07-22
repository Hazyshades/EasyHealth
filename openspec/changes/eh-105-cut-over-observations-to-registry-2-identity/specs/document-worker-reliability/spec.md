## ADDED Requirements

### Requirement: Instrumental persistence gates document completion

The worker SHALL not mark an instrumental document or its processing job completed until source materialization, instrumental observation persistence, and completion-status writes have succeeded. It SHALL inspect and handle Supabase errors for every mutation in the instrumental replacement and completion path.

#### Scenario: Instrumental observation write is rejected

- **WHEN** an instrumental materialization write is rejected, including because a removed legacy column is referenced
- **THEN** the worker marks the job/document failure path rather than completed
- **AND** it retains the previously current instrumental source snapshot

#### Scenario: Final completion update fails

- **WHEN** an instrumental snapshot materializes but a required document or job completion-status update fails
- **THEN** the worker does not return successful completion
- **AND** the failure is observable for retry or diagnosis

