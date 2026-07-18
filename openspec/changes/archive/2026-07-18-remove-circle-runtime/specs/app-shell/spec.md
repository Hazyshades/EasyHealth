## MODIFIED Requirements

### Requirement: Account context in app header
The app shell top bar SHALL show page context, the signed-in user's account controls, and sign out. It SHALL not initialize, display, or depend on a wallet, wallet address, or wallet balance.

#### Scenario: Signed-in user views app chrome
- **WHEN** a signed-in user opens an application page
- **THEN** the header renders without wallet controls
- **AND** account controls and sign out remain available

## REMOVED Requirements

### Requirement: Wallet provider and balance endpoint
The application SHALL not expose a Circle browser provider, Circle API route, or wallet balance endpoint.

**Reason:** Supabase Auth is the sole identity mechanism and the product has no wallet feature.

**Migration:** Remove wallet providers, routes, UI components, and their callers in the same release.