## ADDED Requirements

### Requirement: Generated Next.js artifacts can be cleaned cross-platform
The repository SHALL expose a `clean` command that removes only root `.next` and `out` directories on supported Windows and Unix-like environments.

#### Scenario: Stale generated artifacts exist
- **WHEN** a contributor runs `pnpm clean`
- **THEN** `.next` and `out` SHALL be absent
- **AND** the command SHALL succeed when either directory is already absent

### Requirement: Validation starts from clean generated artifacts
The root typecheck and build commands SHALL invoke the clean command before validating or generating Next.js output.

#### Scenario: A deleted route has stale validator output
- **WHEN** a contributor runs the root typecheck command
- **THEN** stale `.next` declarations SHALL not participate in type checking.