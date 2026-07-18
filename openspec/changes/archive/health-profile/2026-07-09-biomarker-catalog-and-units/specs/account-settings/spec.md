## ADDED Requirements

### Requirement: Lab units setting

The Settings experience SHALL allow the user to choose lab unit system presentation: US conventional or SI (EU/international).

#### Scenario: User opens settings and sees lab units

- **WHEN** a signed-in user opens `/app/settings`
- **THEN** the page provides a lab units control (inline or linked subsection)
- **AND** the control shows the current preference defaulting to SI when unset

#### Scenario: User saves lab unit preference

- **WHEN** the user selects US conventional or SI and saves
- **THEN** the preference is stored on the profile
- **AND** a subsequent load of Settings shows the saved value
