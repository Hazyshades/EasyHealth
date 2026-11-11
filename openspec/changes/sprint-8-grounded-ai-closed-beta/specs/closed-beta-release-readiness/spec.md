# closed-beta-release-readiness Specification

## ADDED Requirements

### Requirement: Closed-beta release has explicit go/no-go gates

The release checklist SHALL require evidence for migration status, RLS and profile isolation, safety and citation fixtures, quota behavior, provider configuration, privacy-safe telemetry, retention, document deletion, backup restore, incident contacts, rollback, release notes, known limitations, and named sign-off. A local code inspection alone SHALL not mark a production gate passed.

#### Scenario: Missing production evidence

- **WHEN** restore, deletion, rollback, or incident evidence is absent
- **THEN** the release state is `PENDING` or `BLOCKED`
- **AND** the checklist identifies the exact evidence still required

#### Scenario: All gates signed

- **WHEN** every required gate has current evidence and named approval
- **THEN** the release state can become `GO`
- **AND** the record includes the evaluated commit and migration revision

### Requirement: Rollback and restore are tested before beta enablement

The release process SHALL exercise a reversible deployment rollback and a backup restore in a non-production or approved production-like environment. The result SHALL record timestamps, commands or run identifiers, migration state, and observed outcome.

#### Scenario: Restore test fails

- **WHEN** a restore test cannot reproduce the assistant schema and data invariants
- **THEN** the closed beta remains blocked
- **AND** the issue is recorded with the failure evidence

### Requirement: Known limitations are visible to beta users

Release notes and the assistant limitation copy SHALL document unavailable semantic retrieval, evidence gaps, provider outages, quotas, and the difference between document text and verified structured observations. The product SHALL not describe planned behavior as implemented.

#### Scenario: Semantic index unavailable

- **WHEN** semantic retrieval is disabled or unavailable in the deployed environment
- **THEN** the assistant shows the limitation and uses only allowed evidence tiers
- **AND** the release record states the disabled capability
