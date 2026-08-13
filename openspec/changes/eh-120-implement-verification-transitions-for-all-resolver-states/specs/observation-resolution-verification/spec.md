## ADDED Requirements

### Requirement: Automatic verification uses the trusted writer contract

The production automatic-verification runtime SHALL use a service-only writer path that recomputes the resolver decision from current source evidence and derives `auto_verified` from an approved automatic-promotion policy. It SHALL NOT accept a caller-selected verification status or actor type. The path SHALL retain EH-104 reviewed-definition, resolver-outcome, source-lineage, compare-and-swap, resolver-trace, and append-only revision invariants.

#### Scenario: Automatic writer promotes an approved resolved result

- **WHEN** the service-only automatic writer receives an active source whose current resolver decision is resolved, concrete, reviewed, compatible, and quality-gate approved
- **THEN** it creates or reuses an active revision with `verification_status = auto_verified`
- **AND** the revision contains system decision metadata and a persisted canonical resolver trace
- **AND** the linked observation projection remains a same-source pair

#### Scenario: Automatic writer refuses a protected or incomplete result

- **WHEN** the automatic writer receives a partial, ambiguous, unmapped, stale, non-reviewed, manually overridden, or human-verified source
- **THEN** it returns a stable non-promotion result or stale conflict
- **AND** it does not create an automatic verified revision or overwrite the protected revision

### Requirement: Verification transitions preserve resolver and lifecycle separation

The trusted writer and read projection SHALL treat resolver outcome, verification status, and source record lifecycle as independent values. A rejection or supersession transition SHALL NOT be represented by changing `verification_status`, and a verification reversal SHALL create an append-only pending successor while preserving the source record's active lifecycle unless a separate lifecycle transition is requested.

#### Scenario: Rejected source is not a rejected verification status

- **WHEN** an active laboratory source is rejected after it has a normalization revision
- **THEN** the source projection reports `record_status = rejected`
- **AND** the revision retains its original `verification_status` and resolver trace
- **AND** no revision is written with `verification_status = rejected`

#### Scenario: Reversal returns verification to pending without deleting history

- **WHEN** an eligible active verification is reversed with a valid expected revision and reason
- **THEN** the writer appends a pending successor revision with reversal metadata
- **AND** prior verification revisions remain immutable
- **AND** the source record remains `record_status = active`
