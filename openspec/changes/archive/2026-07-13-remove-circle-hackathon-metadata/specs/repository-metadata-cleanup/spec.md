## ADDED Requirements

### Requirement: Retire obsolete payment and hackathon metadata
The repository SHALL not retain active Circle, Arc, x402, Gateway, USDC-wallet, or hackathon skills, skill-lock entries, documentation, or planning metadata.

#### Scenario: Repository skills are inspected
- **WHEN** a maintainer inspects repository-local agent skills and `skills-lock.json`
- **THEN** no Circle-sourced skill or Circle payment/wallet capability is advertised
- **AND** unrelated repository-local skills remain available

#### Scenario: Active documentation is inspected
- **WHEN** a maintainer searches non-archived documentation and active OpenSpec artifacts
- **THEN** no Circle, Arc, x402, Gateway, or hackathon documentation remains
- **AND** unrelated product documentation remains intact

### Requirement: Preserve runtime and historical boundaries
The cleanup SHALL leave runtime code, dependency declarations, package lockfiles, migrations, environment files, and archived OpenSpec history unchanged.

#### Scenario: Retained boundaries are reviewed
- **WHEN** the cleanup diff is reviewed
- **THEN** no file under `src/`, `supabase/`, `.env*`, or `openspec/changes/archive/**` is modified
- **AND** package manifests and lockfiles are unchanged
