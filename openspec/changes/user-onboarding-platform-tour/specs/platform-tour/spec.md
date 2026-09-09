# platform-tour Specification

## Purpose

Optional product orientation for authenticated EasyHealth users after the mandatory Profile and consent gates have completed.

## ADDED Requirements

### Requirement: Ready users receive a non-blocking platform tour

The system SHALL offer a Driver.js platform tour only after the authenticated app shell and dashboard initial data are ready. The tour MUST be optional and MUST NOT block access to `/app` or any session-gated action.

#### Scenario: New ready user starts the tour

- **WHEN** a user has a valid session, a ready Profile, current required consent, and the dashboard has finished its initial loading
- **THEN** the system starts the current platform tour version when no terminal decision exists for that version
- **AND** the dashboard remains available behind the tour overlay

#### Scenario: Tour never replaces mandatory gates

- **WHEN** a user lacks a Profile name or current required consent
- **THEN** the system redirects to the corresponding mandatory onboarding gate
- **AND** does not start the platform tour

### Requirement: The tour introduces the authenticated app shell and core entry points

The current platform tour SHALL explain the dashboard, primary navigation, document upload, Health Profile or biomarker entry point, and report entry point. The first version MUST remain on the dashboard and MUST NOT require cross-route tour continuation.

#### Scenario: User progresses through the orientation

- **WHEN** the platform tour is active
- **THEN** each step highlights a stable app-shell or dashboard target and provides concise English guidance
- **AND** the final step offers an explicit finish action

#### Scenario: Tour does not claim task completion

- **WHEN** a user views or completes a platform-tour step
- **THEN** the system records only tour state
- **AND** does not mark document upload, biomarker review, report generation, or any clinical workflow as completed

### Requirement: Tour targets are stable and responsive

The system SHALL identify tour targets using semantic `data-tour` markers rather than visible text, generated CSS classes, or DOM position. Desktop and mobile navigation MUST use distinct target sets.

#### Scenario: Desktop user sees desktop navigation guidance

- **WHEN** the tour starts in a desktop viewport
- **THEN** the navigation step targets the visible desktop app navigation
- **AND** it does not select the hidden mobile navigation

#### Scenario: Mobile user sees mobile navigation guidance

- **WHEN** the tour starts in a mobile viewport
- **THEN** the navigation step targets the visible mobile navigation
- **AND** it does not select the hidden desktop navigation

### Requirement: Tour terminal state is versioned and server-persisted

The system SHALL persist dismissal and completion for the current tour version on the user's Profile. A later tour version MUST be eligible independently of an older version's terminal decision.

#### Scenario: User skips the tour

- **WHEN** the user selects Skip, Close, or an equivalent dismissal action
- **THEN** the system records the current tour version as dismissed
- **AND** does not record the tour as completed
- **AND** does not start the same version again on the next visit

#### Scenario: User completes the tour

- **WHEN** the user activates the final Finish action
- **THEN** the system records the current tour version as completed
- **AND** does not start the same version again on the next visit

#### Scenario: A later version is released

- **WHEN** a user has a terminal decision for an older tour version but not for the current version
- **THEN** the current tour version is eligible to start
- **AND** completing or dismissing it updates the stored version and terminal state

### Requirement: Tour supports keyboard and reduced-motion preferences

The system SHALL allow keyboard navigation and dismissal, SHALL remain dismissible at every step, and SHALL disable Driver.js animation when the user prefers reduced motion.

#### Scenario: User dismisses with keyboard

- **WHEN** the user uses the supported keyboard close action while the tour is active
- **THEN** the tour closes
- **AND** the current version is recorded as dismissed
- **AND** focus returns to a usable page surface

#### Scenario: User prefers reduced motion

- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** the tour renders without animated transitions
- **AND** all tour content and controls remain usable

### Requirement: Missing targets do not break or block the tour

The system MUST wait for expected dashboard targets while the ready view settles, MUST skip optional targets that are absent, and MUST avoid starting when required shell targets are unavailable.

#### Scenario: Optional target is absent

- **WHEN** an optional dashboard target is not rendered for the current data state
- **THEN** the tour skips that step or uses the documented fallback
- **AND** continues without a broken highlight or uncaught error

#### Scenario: Required target is absent

- **WHEN** a required shell target is not available after the readiness timeout
- **THEN** the tour does not start
- **AND** the dashboard remains fully usable
