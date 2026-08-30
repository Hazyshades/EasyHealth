## ADDED Requirements

### Requirement: Verification commands preserve failing outcomes
The repository SHALL reject a package script or CI run command that executes a verifier and then runs `rg`, `grep`, or `findstr` through a masking shell operator.

#### Scenario: Search follows a failing verifier with a masking operator
- **WHEN** a verification command uses `;` or `||` to run a search after a verifier
- **THEN** the fail-fast verifier SHALL exit non-zero
- **AND** identify the offending command

#### Scenario: Fail-fast verification chain
- **WHEN** a command joins verifier steps with `&&`
- **THEN** the fail-fast verifier SHALL accept the command because later steps cannot mask an earlier failure.