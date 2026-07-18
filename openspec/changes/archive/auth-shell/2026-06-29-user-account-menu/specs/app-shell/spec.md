## ADDED Requirements

### Requirement: Top bar user menu slot

The application shell top bar SHALL reserve space for the user menu between wallet controls and sign out.

#### Scenario: Top bar control order

- **WHEN** the top bar renders for a signed-in user with a connected wallet
- **THEN** controls appear in order: page title (left), user menu, wallet balance trigger, sign out (right)
