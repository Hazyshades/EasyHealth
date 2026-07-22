## Why

Circle wallets and Arc/x402 payments are no longer part of the product direction, but their runtime implementation still controls authentication and selected human PHR actions. The application must become a Supabase Auth–only PHR where authenticated users can upload documents, generate reports, and refresh synthesis without a payment rail.

## What Changes

- **BREAKING** Replace Circle wallet authentication, session identity, wallet UI, balance endpoint, and Circle API integration with Supabase Auth identity and sessions.
- **BREAKING** Remove Arc/x402 payment middleware, client payment flows, entitlements, payment receipts, and payment-only UI from human PHR routes.
- Make authenticated document upload, report generation, and health-profile synthesis refresh free session-authorized actions.
- Remove Circle/Arc/x402 configuration, SDK dependencies, and obsolete database fields/tables through forward Supabase migrations.
- Preserve medical safety, private storage, document processing, biomarker normalization, reports, and health-profile behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `supabase-auth`: Supabase Auth becomes the sole identity/session authority and replaces wallet-derived profiles.
- `app-shell`: Remove wallet context and balance behavior from authenticated application chrome.
- `document-upload-async`: Upload authorization becomes session-only with no payment gate.
- `reports-api`: Report generation becomes session-authorized with no payment gate.
- `reports-ui`: Report creation no longer presents or initiates payment.
- `health-profile-api`: Synthesis refresh becomes session-authorized with no payment gate.
- `holistic-health-profile`: Remove paid-refresh affordances while retaining synthesis refresh.

## Impact

- Runtime: auth/session/profile helpers, API routes, app providers, payment middleware, UI actions, and wallet endpoints.
- Data: forward migration removes Circle identity columns and payment tables after confirming no retained runtime references.
- Dependencies: remove Circle and x402 packages from manifests and regenerate lockfiles.
- Configuration: remove Circle, Arc, seller, and payment environment variables from validation and examples.
- Out of scope: archived OpenSpec history, medical safety rules, document/biomarker data, and migration of existing wallet identities without a matching Supabase account.