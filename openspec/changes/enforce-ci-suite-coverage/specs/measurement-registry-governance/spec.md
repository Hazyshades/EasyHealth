## MODIFIED Requirements

### Requirement: Approved quality gates precede launch

Metric definitions, representative-corpus requirements, numerical thresholds, approval ownership, and complete CI verification coverage SHALL be documented before the launch manifest is approved. Missing gates, missing approval, an unclassified verification suite, or a required verification suite that is not reachable from a workflow runner SHALL block launch rather than fall back to Registry v1 or an undocumented local-only result.

#### Scenario: Recognition target passes but false-resolution review is missing

- **WHEN** expected rows are recognized but false concrete resolution has not been reviewed
- **THEN** the candidate release remains blocked

#### Scenario: A verification suite is not reachable from CI

- **WHEN** a `test:*` package script or one of its verification files has no workflow runner and no reviewed local-only disposition
- **THEN** the Registry release gate remains blocked
- **AND** the coverage report identifies the missing runner

#### Scenario: Required verification coverage and release evidence pass

- **WHEN** metric definitions, representative fixtures, thresholds, approvals, generated Registry 2.0 evidence, and every required verification suite are complete and reproducible
- **THEN** CI may pass the release gate
- **AND** the report records the suite-to-job coverage and the candidate input identity
