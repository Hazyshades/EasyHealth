## ADDED Requirements

### Requirement: User menu button in top bar

The system SHALL display a user menu button in the application top bar between the wallet balance trigger and the Sign out control.

#### Scenario: Signed-in user sees menu button

- **WHEN** a signed-in user views any `/app/*` page
- **THEN** the top bar shows a user menu button to the left of the wallet balance trigger
- **AND** the Sign out button remains to the right of the wallet balance trigger

#### Scenario: Menu button shows first name

- **WHEN** the user's profile has a stored first name from Google sign-in
- **THEN** the menu button label displays that first name in English characters as returned from identity
- **AND** on viewports below `sm` the button MAY show only the first initial

#### Scenario: Menu button fallback label

- **WHEN** no first name is stored for the profile
- **THEN** the menu button label displays **Account**

### Requirement: User menu dropdown navigation

The user menu SHALL open a dropdown with links to Account, Settings, and AI Settings.

#### Scenario: User opens menu

- **WHEN** the user activates the user menu button
- **THEN** a dropdown lists **Account**, **Settings**, and **AI Settings** in English
- **AND** each item navigates to `/app/account`, `/app/settings`, and `/app/settings/ai` respectively

#### Scenario: Menu closes on navigation

- **WHEN** the user selects a menu item
- **THEN** the dropdown closes
- **AND** the app navigates to the selected route

### Requirement: English UI strings for user menu

All user menu labels and accessibility text SHALL be in English.

#### Scenario: User menu language

- **WHEN** the user menu is rendered
- **THEN** all visible strings are English
