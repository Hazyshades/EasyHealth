## ADDED Requirements

### Requirement: Repository formatting is pinned and repeatable
The repository SHALL declare Prettier as a root development dependency and expose `format` and `format:check` scripts that use that installed version.

#### Scenario: Contributor checks formatting
- **WHEN** a contributor runs `pnpm format:check`
- **THEN** the command SHALL validate tracked source and configuration files using the pinned formatter
- **AND** it SHALL not modify files

### Requirement: Generated artifacts are excluded from formatter traversal
The formatter configuration SHALL exclude dependency directories, build output, generated registry documents, archives, and binary fixtures.

#### Scenario: Contributor runs the formatter
- **WHEN** `pnpm format` runs
- **THEN** ignored generated or binary artifacts SHALL remain untouched.