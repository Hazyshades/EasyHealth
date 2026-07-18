## ADDED Requirements

### Requirement: Route enter transition

The authenticated app shell SHALL animate an enter transition (fade + subtle translate, ≤250ms, transform+opacity only) whenever the user navigates between `/app/*` routes.

#### Scenario: User navigates between app routes

- **WHEN** a signed-in user navigates from one `/app/*` route to another
- **THEN** the incoming route content fades and lifts into place
- **AND** the transition uses the shared `--eh-ease` curve and duration ≤250ms

#### Scenario: Reduced motion preference

- **WHEN** the user's OS requests `prefers-reduced-motion: reduce`
- **THEN** the route enter transition is disabled (opacity-only or none)

### Requirement: Press feedback on navigation and primary controls

Nav items in the sidebar and primary buttons in the app shell SHALL provide immediate press/active visual feedback (e.g. a brief scale-down) on pointer activation.

#### Scenario: User activates a nav item

- **WHEN** a signed-in user presses a sidebar nav item
- **THEN** the item shows an active press state (scale-down) before navigation completes

#### Scenario: User activates a primary button

- **WHEN** a signed-in user presses a primary button in the app shell
- **THEN** the button shows an active press state (scale-down)

### Requirement: Shared motion token source

The app shell SHALL use a single shared set of motion tokens (easing curve + duration scale) for transitions and press feedback, rather than per-component ad-hoc values.

#### Scenario: Consistent motion language

- **WHEN** any shell control or route transition animates
- **THEN** it uses the shared `--eh-ease` curve and the shared duration scale

#### Scenario: Reduced motion safety net

- **WHEN** the user's OS requests `prefers-reduced-motion: reduce`
- **THEN** all shell transitions and press animations are neutralized
