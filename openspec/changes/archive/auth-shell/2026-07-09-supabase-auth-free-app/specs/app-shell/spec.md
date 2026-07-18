## MODIFIED Requirements

### Requirement: Wallet context in app header

The app shell top bar SHALL NOT display wallet address or USDC balances. The top bar SHALL show page context and account controls only (user menu and sign out).

#### Scenario: No wallet chrome when signed in

- **WHEN** a signed-in user views the app shell
- **THEN** the header does not show a wallet address
- **AND** does not show USDC or Gateway balances
- **AND** user menu and sign out remain available

### Requirement: Top bar user menu slot

The application shell top bar SHALL place the user menu adjacent to sign out without wallet controls.

#### Scenario: Top bar control order

- **WHEN** the top bar renders for a signed-in user
- **THEN** controls appear in order: page title (left), user menu, sign out (right)
