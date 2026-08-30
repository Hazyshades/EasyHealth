## ADDED Requirements

### Requirement: Compact typography has a named role
Compact metadata and counters SHALL use the named `text-caption` utility rather than literal text-size utilities.

#### Scenario: Component renders compact metadata
- **WHEN** compact metadata is displayed
- **THEN** it SHALL use the shared 0.6875rem caption token
- **AND** its foreground SHALL meet 4.5:1 contrast against its background.