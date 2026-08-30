## ADDED Requirements

### Requirement: Registry verification failures are summarized
The Measurement Registry workflow SHALL append the bounded `verify:registry` diagnostic output to `$GITHUB_STEP_SUMMARY` when that command fails and SHALL preserve its non-zero exit status.

#### Scenario: Registry verifier fails in CI
- **WHEN** `pnpm verify:registry` exits non-zero
- **THEN** the job SHALL fail
- **AND** the job summary SHALL contain the final diagnostic output in a labeled fenced block.