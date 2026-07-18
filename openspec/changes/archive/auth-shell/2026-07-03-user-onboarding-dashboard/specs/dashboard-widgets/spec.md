## ADDED Requirements

### Requirement: Dashboard displays a widget grid

The system SHALL render the home dashboard (`/app`) as a responsive grid of widgets instead of the current three-card layout.

#### Scenario: Widget grid layout

- **WHEN** an onboarded user opens `/app`
- **THEN** the dashboard displays widgets in a responsive grid (1 column mobile, 2–3 columns desktop)

#### Scenario: Default widget count

- **WHEN** the dashboard loads for a user without custom preferences
- **THEN** exactly five widgets are shown in the default order

### Requirement: Live widgets use existing product data

The system SHALL include three functional widgets that integrate with existing APIs and routes.

#### Scenario: Health assessment widget

- **WHEN** the user has completed lab records with health profile data
- **THEN** the Health assessment widget shows the overall assessment card with score and confidence

#### Scenario: Health assessment empty state

- **WHEN** the user has no completed lab records
- **THEN** the Health assessment widget shows an empty state with a link to upload

#### Scenario: Upload lab widget

- **WHEN** the Upload lab widget is displayed
- **THEN** it shows a call-to-action linking to `/app/upload`

#### Scenario: Health reports widget

- **WHEN** the Health reports widget is displayed
- **THEN** it shows options to generate a report and view report history, consistent with current reports dashboard behavior

### Requirement: Placeholder widgets are extensible for future features

The system SHALL include two placeholder widgets for future wellness features. These widgets MUST be visually consistent with live widgets but MUST NOT persist user data or claim functionality that is not implemented.

#### Scenario: Medications placeholder widget

- **WHEN** the Medications widget is displayed
- **THEN** it shows a "Coming soon" or equivalent label and an inactive add action

#### Scenario: Water balance placeholder widget

- **WHEN** the Water balance widget is displayed
- **THEN** it shows placeholder UI (e.g. "0 ml of 2.0 L") without functional tracking

#### Scenario: Placeholder widgets do not write data

- **WHEN** a user interacts with a placeholder widget add action
- **THEN** the system does not create database records and may show that the feature is coming soon

### Requirement: Widget registry supports future expansion

The system SHALL implement widgets through a registry or equivalent pattern so additional widget types can be added without restructuring the dashboard page.

#### Scenario: Adding a widget type

- **WHEN** a new widget definition is added to the registry with a component and status
- **THEN** it can be included in the default grid or preferences without rewriting the dashboard layout logic

### Requirement: Dashboard widgets use English copy

All widget titles, descriptions, empty states, and placeholder labels MUST be in English.

#### Scenario: Widget text language

- **WHEN** any dashboard widget is rendered
- **THEN** all user-visible text is in English
