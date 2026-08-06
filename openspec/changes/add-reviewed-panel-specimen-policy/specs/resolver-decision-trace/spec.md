## ADDED Requirements

### Requirement: The trace SHALL record a policy-derived specimen distinctly

The persisted decision-trace schema SHALL accept `specimen_from_reviewed_panel` as a valid accepted-evidence code, and resolution SHALL emit exactly that code when the specimen axis was satisfied by a reviewed panel policy rather than by a specimen the document stated. The allowlist SHALL be widened in both the TypeScript trace-code table and the database validation function, additively, so that every trace persisted under an earlier catalog release remains valid.

#### Scenario: Policy-derived specimen persists a valid trace

- **WHEN** a normalization revision is written for a row whose specimen came from a reviewed panel policy
- **THEN** the persisted trace contains `specimen_from_reviewed_panel` in that candidate's accepted evidence
- **AND** the database validation function accepts the trace

#### Scenario: Earlier traces stay valid

- **WHEN** a trace written before the policy existed is validated after the allowlist widens
- **THEN** validation still succeeds and the stored trace is not rewritten

#### Scenario: The two specimen codes are mutually exclusive on a candidate

- **WHEN** a candidate's specimen axis is satisfied
- **THEN** its accepted evidence contains exactly one of `specimen_compatible` or `specimen_from_reviewed_panel`

### Requirement: A catalog release change SHALL be visible in the trace

When the set of reviewed panel policies changes, the catalog manifest version and digest recorded on the revision and inside the trace SHALL change with it, so two revisions produced under different policy sets are distinguishable without re-running the resolver.

#### Scenario: Revisions before and after a policy change are distinguishable

- **WHEN** a row is reprocessed after a panel policy is added
- **THEN** the new revision records the updated catalog manifest version and digest
- **AND** the prior revision retains its original values
