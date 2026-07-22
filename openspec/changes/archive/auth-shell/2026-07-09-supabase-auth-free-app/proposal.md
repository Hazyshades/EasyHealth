## Why

Circle user-controlled wallets currently double as identity and payment rail for the human PHR app. That forces Google-via-Circle login, USDC micropayments for core features (upload, reports, synthesis), and a fragile session model (`eh_profile_id` cookie without cryptographic proof). We need a normal consumer auth model (Google + email magic link) with all health features free, while hard-freezing Circle/Arc/x402/Agent work.

## What Changes

- **BREAKING:** Replace Circle wallet login with **Supabase Auth** (Google OAuth + email magic link).
- **BREAKING:** Session identity moves from `profiles.wallet_address` / forgeable `eh_profile_id` cookie to **Supabase JWT session**; `profiles.id = auth.users.id`.
- **BREAKING:** Human-app paid gates removed — upload, educational reports, and synthesis refresh are **free** (session-only).
- **BREAKING:** Demo/wallet-era data is **reset** (DB cascade wipe + storage purge); no wallet→email migration.
- Replace `WalletProvider` / wallet chrome with auth provider (user menu, sign out, account identity).
- Landing and in-app copy stop advertising Arc/USDC pay-per-insight for the human product.
- Env validation no longer requires Circle/Seller/Gateway secrets for the app to boot.
- Circle, x402 human payment paths, wallet fund UI, and Agent API are **hard-frozen**: not developed further; human routes unhooked from payment; agent/x402 modules left in repo unless they block build.
- Apple / Facebook OAuth deferred; password auth not in scope (magic link only for email).
- RLS user policies deferred; server continues service-role after validating Supabase session (security upgrade vs bare cookie, not full RLS yet).
- Legal markdown follow-up optional; landing + env docs in scope.

## Capabilities

### New Capabilities

- `supabase-auth`: Sign-in with Google and email magic link via Supabase Auth; OAuth/callback session establishment; ensure profile row on first login; secure session resolution for API and layouts; sign-out.

### Modified Capabilities

- `app-shell`: Remove wallet/USDC header requirements; top bar shows user menu + sign out only; unauthenticated redirect still applies under new session.
- `account-settings`: Account page shows email + auth provider (not wallet); profile API drops wallet-centric fields as primary identity.
- `user-onboarding`: Profile/consent gates run after Supabase sign-in (not wallet); OAuth name prefill from Supabase user metadata.
- `paid-health-synthesis`: Synthesis refresh becomes free (session-authenticated); remove x402 402 requirements for human synthesis.
- `ai-provider-preference`: Remove “x402 unchanged / upload still requires payment” requirements; AI preference remains orthogonal and free.

## Impact

- **Domain:** `auth-shell` (primary); human payment removal touches documents upload + reports + health-profile routes; `payments` / `agent-api` hard-frozen (out of active scope).
- **Code:** `wallet-provider.tsx`, `/api/auth/session`, `/api/circle`, `/api/wallet/*`, `src/lib/auth/*`, `withGateway` on human routes, top-bar/wallet UI, landing, env schemas, profile upsert.
- **Data:** Migration to auth-linked profiles; drop/null wallet columns; wipe demo rows and storage objects.
- **Deps:** Add `@supabase/ssr` (and browser/server clients); stop requiring `@circle-fin/*` for human app boot (may remain installed while frozen).
- **Ops:** Supabase Dashboard Auth (Google + magic link redirect URLs); Google Cloud OAuth client for Supabase callback; no Circle Console for human login.
- **Does not change:** Document processing worker, extraction pipelines, Nebius/AI provider wiring (except env must not force Circle), agent API specs (frozen as-is).
