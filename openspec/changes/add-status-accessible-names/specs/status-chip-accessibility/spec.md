## ADDED Requirements

### Requirement: Status chips provide non-color status cues
Status chips SHALL render a variant-specific decorative icon for success, warning, error, and info variants.

#### Scenario: User scans a status chip without color
- **WHEN** a status chip is rendered
- **THEN** its icon and text SHALL remain visible on one line
- **AND** the icon SHALL be hidden from assistive technology because the text provides its meaning.