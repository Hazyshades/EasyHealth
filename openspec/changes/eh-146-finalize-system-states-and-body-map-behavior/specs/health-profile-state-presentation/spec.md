## ADDED Requirements

### Requirement: Health Profile state axes are explicit

The Health Profile SHALL represent score evidence and assessment lifecycle as separate axes. A named system SHALL be either `scored` when it has a numeric current-state assessment or `insufficient` when its strict readiness result has no score. The profile assessment lifecycle SHALL be one of `current`, `processing`, `outdated`, or `error`, derived from the assessment job and current persisted version.

#### Scenario: Scoreable system is shown as a current-state assessment

- **WHEN** a named system has a non-null strict-readiness score and the assessment lifecycle is `current`
- **THEN** the map badge, system selector, and drawer show the numeric value as a `Current state assessment`
- **AND** the UI does not call the value a diagnosis, disease risk, probability, or prediction

#### Scenario: Missing evidence is shown as insufficient, not failed

- **WHEN** a named system has a null score because required groups are missing or unusable
- **THEN** the map badge and selector show an em dash and a neutral insufficient-data treatment
- **AND** the drawer explains the readiness gap and preserves the factual markers
- **AND** the UI does not use a red danger/failure treatment or a zero score for the missing evidence

#### Scenario: Assessment processing does not replace evidence state

- **WHEN** the assessment job is queued or processing and no persisted assessment version exists
- **THEN** the API returns lifecycle `processing`
- **AND** the page states that the assessment is being updated while retaining any deterministic fallback/factual data already available

#### Scenario: Existing snapshot is identified as outdated

- **WHEN** the assessment job is queued or processing and a persisted assessment version exists
- **THEN** the API returns lifecycle `outdated`
- **AND** the map and cards identify the displayed snapshot as the last completed assessment while the update is pending

#### Scenario: Assessment failure is not a health result

- **WHEN** the assessment job is `retryable_failed` or `failed`
- **THEN** the API returns lifecycle `error`
- **AND** the page explains the update failure, preserves the last completed snapshot when one exists, and exposes retry only for retryable/failed jobs
- **AND** the error state does not change into a diagnosis, risk label, or dangerous health color

### Requirement: Lifecycle metadata is returned with the Health Profile response

`GET /api/health-profile` SHALL return explicit assessment lifecycle metadata alongside the existing nullable score/readiness payload, including the derived display state and whether a persisted current version exists. The lifecycle metadata SHALL be derived at read time and SHALL NOT be persisted inside append-only assessment payloads.

#### Scenario: Client receives a complete lifecycle contract

- **WHEN** an authenticated profile requests `/api/health-profile`
- **THEN** the response includes the existing assessment job status and error fields
- **AND** includes `assessment.display_state` and `assessment.has_current_version`
- **AND** the response keeps nullable system/overall scores and readiness details unchanged

### Requirement: Body-map states are discoverable and accessible

The Health Profile body map SHALL expose each system as a keyboard-operable control with a visible focus indicator, an accessible name containing its score/readiness state, and a tooltip or equivalent hover/focus description. Selecting a system SHALL open the existing factual drawer without changing the system's source or authorization boundary.

#### Scenario: Keyboard user opens a system drawer

- **WHEN** a keyboard user tabs to a body-map system control and presses Enter or Space
- **THEN** the same system drawer opens as for pointer activation
- **AND** the control exposes button semantics, pressed state, and dialog affordance
- **AND** Escape, Back, or Close returns the user to the map without losing the selected system URL context

#### Scenario: User can understand a badge without opening the drawer

- **WHEN** a user hovers or focuses a system badge or selector
- **THEN** a tooltip or accessible description identifies the system, numeric/current-state or insufficient state, and the non-diagnostic boundary
- **AND** unavailable scores are rendered as `—`, never as `0`

#### Scenario: Deep link selects the requested system

- **WHEN** a user opens `/app/profile?system=<named-system>&returnTo=<safe-internal-path>`
- **THEN** the matching system selector is active and the body-map drawer opens for that system after profile data loads
- **AND** changing or clearing the selection updates the existing same-origin query context
- **AND** browser back/forward and an invalid system value reconcile to a safe unselected state without external navigation

### Requirement: Drawer and card copy remains factual

The system drawer and overall assessment card SHALL display score, data confidence, source metadata, and lifecycle/readiness messages as factual product-state information. They SHALL include or remain adjacent to the medical disclaimer and SHALL not imply diagnosis, treatment, disease risk, or a clinical emergency.

#### Scenario: Drawer distinguishes score from data confidence

- **WHEN** a user opens a scored system drawer
- **THEN** the drawer labels the numeric value `Current state assessment`
- **AND** shows `Data confidence` separately
- **AND** lists marker values, lab-reference status, observed date, and source document metadata

#### Scenario: Overall card explains insufficient evidence neutrally

- **WHEN** fewer than three named systems are scoreable
- **THEN** the overall card says `Insufficient data for overall assessment` and shows the scoreable-system denominator
- **AND** the card does not style that state as a health failure or disease risk
- **AND** a profile-only dismissal does not remove the dashboard's persistent explanation

### Requirement: Body-map presentation remains usable on mobile

The Health Profile SHALL preserve all named systems, selectors, drawer access, disclaimers, and source links on narrow viewports. The body-map container SHALL adapt its minimum height and allow system controls to wrap without requiring horizontal scrolling or hiding state labels.

#### Scenario: Narrow viewport shows the complete map flow

- **WHEN** a user opens Health Profile on a viewport narrower than the desktop map breakpoint
- **THEN** the body map fits the available width without horizontal page overflow
- **AND** all system selectors remain reachable by touch and keyboard
- **AND** selecting a system opens the same factual drawer and source links as on desktop
