## ADDED Requirements

### Requirement: Review projection exposes lifecycle-aware actions

The authenticated document review API and UI SHALL expose `resolution_status`, `verification_status`, `record_status`, persisted-versus-preview trace state, and stable action-exclusion reasons for each current or historical laboratory source row. The review surface SHALL keep extraction process status separate from verification and record lifecycle labels.

#### Scenario: Resolved pending row exposes verification action

- **WHEN** an owner opens an active resolved row with a reviewed concrete definition and pending verification
- **THEN** the review projection shows `Resolved`, `Not verified yet`, and `Active`
- **AND** it exposes only the individual or EH-122 batch verification actions allowed by the server policy

#### Scenario: Incomplete row keeps raw acceptance available

- **WHEN** an owner opens an active partial, ambiguous, or unmapped row
- **THEN** the projection explains the incomplete resolver outcome and shows raw evidence
- **AND** raw acceptance remains available where permitted
- **AND** verification and batch-verification actions are excluded with stable reasons

#### Scenario: Automatic verification is read-only in the UI

- **WHEN** a row has `verification_status = auto_verified`
- **THEN** the UI labels it as verified automatically
- **AND** it does not offer a user action that impersonates or replays the system decision
- **AND** an allowed correction or reversal remains a distinct user workflow

### Requirement: Owner rejection is confirmed and reason-coded

The document review interface SHALL provide rejection only for an active source row owned by the authenticated profile. Rejection SHALL require confirmation and an allowlisted reason code, SHALL be authorized and revalidated by the server, and SHALL preserve the source evidence and prior normalization history.

#### Scenario: Owner confirms rejection

- **WHEN** an owner selects a valid rejection reason and confirms an active source row
- **THEN** the server transitions the source to `record_status = rejected`
- **AND** the UI reports the completed lifecycle transition and retains the row in history

#### Scenario: Rejection is blocked for stale or foreign rows

- **WHEN** the row changed after the review loaded or belongs to another profile
- **THEN** the rejection request fails with a stale or authorization error
- **AND** the UI asks the owner to reload without claiming the row was rejected

#### Scenario: Rejection without a reason is not submitted

- **WHEN** the owner attempts to confirm rejection without a valid reason code
- **THEN** the UI prevents submission or the server returns a validation error
- **AND** no source, observation, or audit state changes

### Requirement: Superseded records remain visible as historical evidence

When a document is reprocessed, the review surface SHALL distinguish superseded source rows from current active rows. Superseded rows SHALL be read-only, retain their original raw evidence and decision trace availability, and SHALL not be offered verification, rejection, or batch-selection actions.

#### Scenario: Reprocessed row is shown as superseded

- **WHEN** a prior extracted row has been replaced by a newer extraction batch
- **THEN** the history view labels the prior row `Superseded`
- **AND** shows the replacement/reprocessing context where available
- **AND** does not include the row in current verification or raw-acceptance selection

#### Scenario: Current replacement remains independently reviewable

- **WHEN** a reprocess creates an active replacement row
- **THEN** the replacement is evaluated using its own current resolver preview or persisted revision
- **AND** a prior row's decision or trace is not silently copied as the replacement's verification

### Requirement: Lifecycle actions preserve existing review safety boundaries

Lifecycle-aware review actions SHALL use the existing authenticated owner assertion, no-store server route pattern, source-safe normalization writer, and EH-121 audit capture. Client state SHALL not authorize a transition, bypass incomplete-outcome restrictions, alter source ownership, or replace the EH-122 batch contract.

#### Scenario: Client cannot force a verified status

- **WHEN** a client submits a lifecycle or acceptance request with `verification_status`, `record_status`, or actor fields that are not derived by the server
- **THEN** the server ignores or rejects those fields
- **AND** it derives the transition from current source state, authenticated actor, and policy

#### Scenario: Existing raw and correction paths remain distinct

- **WHEN** a reviewer accepts an incomplete row or submits a manual value/mapping correction
- **THEN** the existing raw-acceptance or correction writer path is used
- **AND** the row is not silently converted into batch verification or automatic verification
