## ADDED Requirements

### Requirement: Prospective acceptance and correction use shared preparation

Regular acceptance, automatic verification, confirmation, and current manual
correction SHALL obtain one prepared evidence record before Resolver
evaluation. The same record SHALL be used for eligibility, resolution,
identity hashing, trace construction, and the trusted writer payload. A
manual definition selection changes the explicit outcome; it SHALL NOT create
a second evidence-admission path.

#### Scenario: Current correction uses prepared evidence once

- **WHEN** a user submits a value correction or manual definition selection
- **THEN** the correction path SHALL prepare effective evidence through the
  shared seam before evaluating the selected/current definition
- **AND** the writer SHALL persist identity and trace data derived from that
  same prepared record

#### Scenario: Acceptance and automatic verification share preparation

- **WHEN** regular acceptance or automatic verification evaluates an extracted
  biomarker
- **THEN** eligibility and Resolver evaluation SHALL consume the same prepared
  evidence record
- **AND** the writer SHALL not rebuild evidence after eligibility succeeds

### Requirement: Historical reversal restores the saved decision contract

The service-only acceptance/correction writer SHALL provide an explicit historical-restore path for undo/reversal. Given a target revision belonging to the same extracted source, the path SHALL append and atomically activate a reversal revision by copying the target's persisted decision fields, resolver evidence, decision trace, input evidence hash, input identity format version, and release metadata. It SHALL preserve supersession/reversal links and SHALL NOT invoke the current Resolver or current panel-specimen policy to reconstruct the restored decision.

#### Scenario: Undo copies the historical decision

- **WHEN** a user undoes an active correction and selects a prior revision from the same extracted source
- **THEN** the writer SHALL append and activate a reversal revision containing the selected revision's saved decision evidence, hash, identity-format version, and release metadata
- **AND** the selected prior revision SHALL remain unchanged
- **AND** no current Resolver or panel-policy evaluation SHALL occur for the restored decision

#### Scenario: Restore fails closed on an invalid target

- **WHEN** a reversal target belongs to another extracted source, lacks required saved decision data, or fails the expected-active CAS check
- **THEN** the service-only writer SHALL reject the restore atomically
- **AND** it SHALL not create a partial revision or change the active observation projection

#### Scenario: New evaluation is explicit

- **WHEN** a caller wants current aliases, panel policy, or Resolver behavior applied to an observation
- **THEN** it SHALL use an explicit acceptance, correction, or reprocessing evaluation path
- **AND** it SHALL not label that newly evaluated result as a historical reversal
