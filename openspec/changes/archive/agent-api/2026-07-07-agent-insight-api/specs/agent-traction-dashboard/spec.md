## ADDED Requirements

### Requirement: Seller A2A traction dashboard

The system SHALL provide a seller-facing dashboard that aggregates real agent-to-agent payment activity from settled `payment_receipts`, showing total USDC volume, call count per tier/endpoint, unique payer wallets, and on-chain settlement count.

#### Scenario: Dashboard reflects settled receipts

- **WHEN** agent insight calls have settled and created `payment_receipts` rows
- **THEN** the dashboard displays total USDC volume, per-tier call counts, and unique payer count derived from those rows
- **THEN** the displayed numbers are computed from real receipts, not hard-coded values

#### Scenario: Empty state

- **WHEN** no agent payments have settled yet
- **THEN** the dashboard shows zeroed metrics without error

### Requirement: Autonomous buyer agent-fleet demo

The system SHALL include a runnable buyer demo that drives multiple autonomous agents which read the manifest, select a tier based on their data, pay the quoted price on Arc testnet, and escalate to a higher tier when a result warrants it.

#### Scenario: Autonomous tier selection and escalation

- **WHEN** the demo runs a buyer agent whose initial low-tier insight flags a borderline value
- **THEN** the agent autonomously purchases a higher-tier `clinician-summary` for the quoted price
- **THEN** both settlements produce real `payment_receipts` rows visible on the dashboard

#### Scenario: Fleet produces tier distribution

- **WHEN** the demo runs multiple buyer agents with varied data profiles
- **THEN** the resulting receipts span multiple tiers, producing a non-trivial tier distribution on the dashboard
