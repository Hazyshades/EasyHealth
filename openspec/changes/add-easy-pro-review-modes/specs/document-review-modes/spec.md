## ADDED Requirements

### Requirement: Profile stores a laboratory review mode default
The system SHALL expose an authenticated profile setting named `review_mode_default` with the values `easy` and `pro`. The setting SHALL be readable and writable through the existing profile API and Settings surface. Existing profiles SHALL resolve to `pro` unless the owner chooses another value.

#### Scenario: Existing profile keeps the current workflow
- **WHEN** an existing profile has no stored review mode default
- **THEN** the profile API and Settings surface report `pro`
- **AND** a new laboratory Document starts in Pro mode

#### Scenario: Owner changes the default
- **WHEN** an authenticated owner saves `easy` as `review_mode_default`
- **THEN** the profile API persists and returns `easy`
- **AND** the setting applies to subsequently created laboratory Documents

### Requirement: Laboratory Documents persist an effective review mode
The system SHALL persist an effective `review_mode` of `easy` or `pro` on each laboratory Document and SHALL expose it in the owner-scoped Document review bootstrap. A new laboratory Document SHALL snapshot the owner's profile default at upload reservation time. Non-laboratory Documents SHALL remain outside this policy.

#### Scenario: New laboratory Document snapshots the profile default
- **WHEN** an owner uploads a Document whose normalized type is `lab_result`
- **THEN** the upload reservation stores the current profile `review_mode_default` on the Document
- **AND** a later profile setting change does not silently change that Document's effective mode

#### Scenario: Non-laboratory Document is outside the mode policy
- **WHEN** an owner opens an imaging or consultation Document
- **THEN** its review payload does not expose laboratory Easy controls
- **AND** existing non-laboratory review behavior remains unchanged

### Requirement: Owner can choose the Document mode before initial acceptance
The system SHALL allow the Document owner to switch a laboratory Document between Easy and Pro before the first accepted or manually corrected normalization revision. The switch SHALL be persisted with an owner-scoped conditional update and SHALL reject a stale or already locked selection without discarding extracted data or existing manual work.

#### Scenario: Owner switches an unreviewed Document to Easy
- **WHEN** a laboratory Document has no accepted or manually corrected normalization revision and its owner selects Easy
- **THEN** the server persists `review_mode = easy`
- **AND** the bootstrap reports that pre-acceptance mode selection remains available

#### Scenario: Manual work blocks a silent switch to Easy
- **WHEN** a laboratory Document already has a persisted manual correction or mapping decision before the owner selects Easy
- **THEN** the server rejects the switch or requires the existing manual decision to be explicitly restored first
- **AND** the server does not delete or rewrite that decision

#### Scenario: Rejection alone does not lock mode selection
- **WHEN** the owner explicitly rejects one extracted result and no accepted or corrected normalization revision exists
- **THEN** the rejected result remains retained according to the existing lifecycle contract
- **AND** the Document may still be switched between Easy and Pro

### Requirement: Initial review mode locks on the first accepted write
The system SHALL lock the initial review boundary when the first owner action creates an accepted or manually corrected normalization revision. The lock SHALL be recorded atomically with that revision. Once the boundary is locked, the owner SHALL NOT switch a Pro Document back to Easy.

#### Scenario: Easy acceptance locks the Document
- **WHEN** the owner explicitly accepts an extracted result in Easy mode
- **THEN** the acceptance and the Document review lock commit together
- **AND** the Document reports `review_mode = easy` with a non-null lock timestamp

#### Scenario: Concurrent mode write loses without a partial result
- **WHEN** two review requests attempt the first accepted write under different modes
- **THEN** one request commits the revision and lock
- **AND** the other request receives a stale-mode conflict without creating a second active revision or observation

### Requirement: Easy review preserves extracted evidence and allows explicit decisions
Easy review SHALL present the extracted laboratory evidence as read-only, including the extracted name, value or text, unit, reference information, dates, source location or text, and extraction confidence when available. Easy SHALL allow explicit acceptance and rejection with the existing rejection reason contract. Easy acceptance SHALL use the existing deterministic normalization writer without a user-supplied measurement override or manual identity selection.

#### Scenario: Owner accepts extracted evidence in Easy mode
- **WHEN** the owner explicitly accepts one or more reviewable extracted rows in Easy mode
- **THEN** the system records the extracted measurement and its provenance through the existing acceptance writer
- **AND** the raw evidence and source fields remain unchanged
- **AND** the UI does not ask the owner to choose a Registry definition or edit the measurement

#### Scenario: Easy keeps an incomplete outcome as reported
- **WHEN** the deterministic Resolver cannot produce one safe concrete measurement identity for an Easy acceptance
- **THEN** the system preserves the extracted result under the existing incomplete or raw outcome contract
- **AND** the system does not require a manual mapping before recording the accepted result

#### Scenario: Owner rejects extracted evidence in Easy mode
- **WHEN** the owner chooses a valid rejection reason and confirms rejection in Easy mode
- **THEN** the existing lifecycle rejection transition runs
- **AND** the raw source row remains available according to the existing audit and history contract

### Requirement: Easy blocks manual review mutations on the server
The server SHALL deny Easy-mode requests for measurement correction, manual Registry mapping, correction undo, batch verification, and batch verification reversal. The denial SHALL apply even when the caller bypasses the Easy client surface. Easy SHALL continue to allow explicit acceptance, valid rejection, read-only history, and reprocess operations that preserve the Document mode.

#### Scenario: Direct correction request is denied in Easy
- **WHEN** an authenticated owner posts a correction or edit-value request for an Easy laboratory Document
- **THEN** the server returns a mode-policy error
- **AND** no observation, normalization revision, or raw extraction field changes

#### Scenario: Direct batch verification request is denied in Easy
- **WHEN** an authenticated owner posts a batch verification or reversal request for an Easy laboratory Document
- **THEN** the server returns a mode-policy error
- **AND** no verification decision is created or reversed

#### Scenario: Reprocess preserves Easy mode
- **WHEN** the owner starts a permitted Document reprocess while the Document is in Easy mode
- **THEN** the reprocess starts through the existing pipeline
- **AND** the Document remains in Easy mode with its existing lock state

### Requirement: Pro review retains the current correction and verification workflow
Pro review SHALL retain the current technical details, measurement correction, manual mapping, batch verification, rejection, undo, and append-only history behavior, subject to the existing Registry and lifecycle contracts. Pro actions SHALL continue to require the existing correction reasons, stale snapshot checks, and validation rules.

#### Scenario: Owner corrects a Pro result
- **WHEN** the owner submits a valid Pro measurement correction with a reason
- **THEN** the server creates the existing append-only correction revision
- **AND** the raw extracted evidence remains unchanged
- **AND** the correction is visible in the existing history surface

#### Scenario: Pro mode remains usable after profile default changes
- **WHEN** a laboratory Document already has `review_mode = pro` and the owner changes the profile default
- **THEN** the Document continues to expose Pro controls
- **AND** the Document mode does not change without an explicit Document action

### Requirement: Owner can explicitly escalate an Easy Document to Pro
After an Easy Document has an accepted revision, the system SHALL provide an authenticated owner-only action to enter Pro mode. Escalation SHALL be a forward transition from Easy to Pro, SHALL require an explicit confirmation, and SHALL preserve the Easy acceptance and its revision history. The system SHALL NOT provide a reverse Pro-to-Easy transition after the initial lock.

#### Scenario: Owner enters Pro after Easy acceptance
- **WHEN** the owner confirms the explicit `Enter Pro mode` action for a locked Easy Document
- **THEN** the server changes the effective Document mode to `pro`
- **AND** the earlier Easy acceptance remains active and visible in history
- **AND** the review surface exposes Pro correction and mapping controls

#### Scenario: Escalation cannot erase the original acceptance
- **WHEN** the owner creates a Pro correction after escalating an Easy Document
- **THEN** the system appends a new normalization revision that records Pro as its mode at write
- **AND** the prior Easy acceptance remains in the revision chain and change history
- **AND** raw extraction and source provenance remain unchanged

### Requirement: Review mode is visible and accessible in the review surface
The laboratory Document review surface SHALL identify the current mode, explain the available actions, and expose lock or conflict state without relying on color alone. Mode controls and action buttons SHALL be keyboard reachable, have visible focus, and reflow without horizontal scrolling on narrow screens.

#### Scenario: Easy surface explains its boundary
- **WHEN** the owner opens an unlocked Easy laboratory Document
- **THEN** the surface identifies Easy mode
- **AND** it explains that acceptance keeps the extracted result as reported and that manual editing is unavailable
- **AND** only the allowed Easy actions are exposed

#### Scenario: Locked mode explains the next available action
- **WHEN** the owner opens a locked Easy Document
- **THEN** the surface indicates that the initial review mode is locked
- **AND** it offers the explicit Pro escalation action when escalation is available
- **AND** it does not offer a switch back to Easy
