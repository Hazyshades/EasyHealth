## ADDED Requirements

### Requirement: The trace evidence-code allowlist SHALL admit order-insensitive alias admission
The persisted decision-trace schema SHALL accept `alias_token_set_match` as a valid accepted-evidence code, and the resolver SHALL emit exactly that code when a candidate is admitted through the derived order-insensitive alias projection. The allowlist SHALL be widened in both the TypeScript trace-code table and the database validation function, and widening SHALL be additive so that every trace persisted under an earlier resolver version remains valid.

#### Scenario: Order-insensitive admission persists a valid trace
- **WHEN** a normalization revision is written for a row whose candidate was admitted through the token-set projection
- **THEN** the persisted trace SHALL contain `alias_token_set_match` in that candidate's accepted evidence
- **AND** the database validation function SHALL accept the trace

#### Scenario: Previously persisted traces stay valid
- **WHEN** a trace written under resolver version `8` is validated after the allowlist is widened
- **THEN** validation SHALL still succeed and the stored trace SHALL NOT be rewritten

#### Scenario: Unknown evidence codes are still rejected
- **WHEN** a trace declares an evidence code outside the widened allowlist
- **THEN** the write SHALL be rejected with `invalid_resolver_decision_trace`

### Requirement: A resolver-version change SHALL be visible in the trace
When candidate admission behaviour changes, the resolver version recorded on the revision and inside the trace SHALL change with it, so that two revisions produced by different admission policies are distinguishable without re-running the resolver.

#### Scenario: Revisions written before and after the change are distinguishable
- **WHEN** a row is reprocessed after the order-insensitive admission ships
- **THEN** the new revision SHALL record the incremented resolver version
- **AND** the prior revision SHALL retain its original resolver version
