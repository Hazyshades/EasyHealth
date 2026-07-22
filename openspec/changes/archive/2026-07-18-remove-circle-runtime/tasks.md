## 1. Supabase Identity

- [ ] 1.1 Map all wallet-derived session/profile callers and define the Supabase Auth user-ID profile contract.
- [ ] 1.2 Replace wallet session resolution and profile upsert logic with Supabase Auth session identity.
- [ ] 1.3 Remove Circle API routes, browser wallet providers, wallet UI, and wallet balance endpoint; migrate all callers.
- [ ] 1.4 Add focused authentication and authorization tests for signed-in and unauthenticated human routes.

## 2. Free Human PHR Actions

- [ ] 2.1 Remove payment middleware and payment client integration from document upload while preserving validation and asynchronous processing.
- [ ] 2.2 Remove payment middleware and payment UI from report generation while preserving authenticated generation and error states.
- [ ] 2.3 Remove payment middleware and payment UI from health-profile synthesis refresh while preserving authenticated refresh behavior.
- [ ] 2.4 Remove payment entitlements, receipts, and all remaining runtime payment callers.

## 3. Configuration and Data

- [ ] 3.1 Decide and record the backup/export disposition for existing payment and wallet-identity data before destructive schema changes.
- [ ] 3.2 Add a forward Supabase migration removing retired Circle identity fields and payment tables; do not rewrite migration history.
- [ ] 3.3 Remove Circle, Arc, seller, and payment configuration from environment validation and examples.
- [ ] 3.4 Remove Circle/x402 dependencies and Next.js external-package configuration; regenerate lockfiles.

## 4. Verification

- [ ] 4.1 Confirm no runtime source, configuration, dependency manifest, or active specification references Circle, Arc, x402, Gateway, or wallet payment infrastructure.
- [ ] 4.2 Run focused auth, upload, report, and synthesis behavior tests for authenticated and unauthenticated requests.
- [ ] 4.3 Run typecheck, production build, and migration validation without retired configuration.
- [ ] 4.4 Confirm archived OpenSpec history remains unchanged and medical safety behavior remains intact.
