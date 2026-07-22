## Context

The current application uses Circle user-controlled wallets for identity and Arc/x402 for selected payment-gated human actions. Supabase already provides the database and Auth infrastructure. The chosen target is Supabase Auth as the only identity system with free, authenticated PHR actions.

## Goals / Non-Goals

**Goals:**
- Replace wallet-derived identity with Supabase Auth user identity.
- Retire Circle SDK routes/providers, Arc/x402 middleware, payment clients, entitlements, wallet UI, and payment-only schema.
- Preserve document processing, reports, synthesis, private storage, and medical safety as authenticated actions.
- Remove obsolete dependencies, configuration, and runtime database artifacts using forward migrations.

**Non-Goals:**
- Introducing a replacement billing provider.
- Mapping historical wallet identities to Supabase users automatically.
- Altering archived OpenSpec history.
- Changing medical safety, biomarker normalization, document processing, or report content contracts.

## Decisions

### 1. Supabase Auth is the sole identity authority

Session identity derives from the Supabase Auth user ID. Profiles are resolved and upserted through that ID rather than wallet address. Circle API routes, browser wallet initialization, and wallet balance UI are removed.

Alternative rejected: retain a dormant wallet fallback. A fallback preserves unsupported identity paths and prevents complete dependency removal.

### 2. Human PHR actions are free and session-authorized

Upload, report generation, and synthesis refresh require a valid Supabase session but no payment headers, payment settlement, or wallet state.

Alternative rejected: disable the actions. This would remove core product workflows without a replacement.

### 3. Retire payment state through forward migration

Remove Circle-specific profile columns and payment receipt/entitlement tables only through a new forward Supabase migration. Historical migrations remain immutable.

Alternative rejected: rewrite migration history. Applied environments would diverge and become unreproducible.

### 4. Remove dependencies only after callers are removed

Delete Circle/x402 packages, configuration, and Next.js external-package entries after all imports and runtime paths are eliminated. Regenerate both lockfiles from the package manifest.

## Risks / Trade-offs

- Existing Circle-only users cannot automatically access profiles until an explicit account-linking migration is designed.
- Removing payment receipts forfeits application-level historical payment reporting; export or backup requirements must be confirmed before the destructive migration runs.
- Auth changes affect every protected route; focused session, authorization, and end-to-end smoke tests are required before deployment.
- Secrets must be revoked outside this repository if any historical credentials were exposed.