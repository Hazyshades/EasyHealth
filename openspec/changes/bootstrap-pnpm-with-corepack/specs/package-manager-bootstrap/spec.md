## ADDED Requirements

### Requirement: Pinned pnpm can be activated without global installation
The repository SHALL document Corepack commands that activate the exact pnpm version declared in `package.json` before a contributor runs package-manager commands.

#### Scenario: Fresh supported Node environment lacks pnpm on PATH
- **WHEN** a contributor follows the documented bootstrap commands
- **THEN** Corepack activates the declared pnpm version
- **AND** subsequent repository pnpm commands use that version

### Requirement: CI enables Corepack before package installation
The measurement-registry workflow SHALL enable Corepack after Node setup and before any pnpm setup or install command.

#### Scenario: CI verifies a pull request
- **WHEN** the workflow starts on a supported runner
- **THEN** Corepack is enabled before the workflow invokes pnpm
- **AND** dependency installation uses the repository lockfile

### Requirement: Package-manager declaration is verifiable
The repository SHALL provide a non-mutating verification command that fails when `package.json` does not declare the supported pinned pnpm version.

#### Scenario: Package-manager declaration drifts
- **WHEN** the declaration is absent, names another package manager, or pins a different pnpm version
- **THEN** the verification command SHALL exit non-zero and report the observed declaration.