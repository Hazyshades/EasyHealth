## 1. Ops prerequisites (manual)

- [x] 1.1 Enable Email (magic link) and Google providers in Supabase Auth Dashboard
- [x] 1.2 Configure Site URL and redirect allow-list (`/auth/callback`, localhost + production)
- [x] 1.3 Create/update Google Cloud OAuth client for Supabase callback URL; paste client id/secret into Supabase
- [x] 1.4 Enable automatic identity linking by verified email when available in project settings

> Documented in `docs/07-ops/env-vars.md` and `docs/07-ops/local-dev.md`. Requires your Supabase/Google console access.

## 2. Dependencies and Supabase clients

- [x] 2.1 Add `@supabase/ssr` (and any required peer versions) to the app package
- [x] 2.2 Create browser Supabase client (`src/lib/supabase/client.ts`)
- [x] 2.3 Create server Supabase client with cookie handling (`src/lib/supabase/server.ts`)
- [x] 2.4 Keep admin/service-role client for privileged DB/storage after session check

## 3. Database migration and reset

- [x] 3.1 Add migration to wipe demo app data (truncate profiles cascade and related tables as needed)
- [x] 3.2 Drop or retire `wallet_address` / `circle_wallet_id` as auth keys; align `profiles` with `id = auth user id` + email
- [x] 3.3 Purge demo objects from document storage bucket
- [x] 3.4 Apply migration locally and document one-shot reset steps in env/local-dev notes if needed

> Migration `017_supabase_auth_profiles.sql` + storage purge steps documented in `docs/07-ops/local-dev.md`. Apply SQL in your Supabase project when ready.

## 4. Session and profile core (auth-shell)

- [x] 4.1 Reimplement `getSessionProfileId` / sign-out via Supabase `getUser()`; remove reliance on `eh_profile_id`
- [x] 4.2 Implement `ensureProfile(user)` (idempotent insert by auth uid, email, optional metadata)
- [x] 4.3 Add `/auth/callback` route handler (code exchange → ensure profile → redirect onboarding or `/app`)
- [x] 4.4 Remove wallet-based `POST /api/auth/session` body flow (delete or replace with session helper only if needed)
- [x] 4.5 Update `upsertProfileByWallet` call sites to auth-based profile helpers; clean `ProfileRow` types

## 5. Auth UI

- [x] 5.1 Replace `WalletProvider` with `AuthProvider` (session state, Google sign-in, magic link, sign out, identity refresh)
- [x] 5.2 Wire root layout to `AuthProvider`
- [x] 5.3 Landing: Google + email magic link CTAs; free PHR copy (no USDC/Arc pay messaging)
- [x] 5.4 Add `/login/check-email` (or equivalent) after magic link request
- [x] 5.5 Top bar: remove wallet chip / fund / balances; keep user menu + sign out
- [x] 5.6 Gut or delete wallet-only components (`wallet-account-trigger`, `wallet-dashboard-drawer`, fund flows)
- [x] 5.7 Account page: show email + name + created_at (no wallet as primary identity)
- [x] 5.8 Onboarding prefill from Supabase user metadata; magic-link empty name path

## 6. Free human APIs (documents / reports / health-profile)

- [x] 6.1 Remove `withGateway` from `POST /api/upload`; session-only auth
- [x] 6.2 Remove x402/payment UX from `upload-zone` (no fund-on-402)
- [x] 6.3 Remove `withGateway` from report generation routes; session-only
- [x] 6.4 Remove payment UX from reports UI if present
- [x] 6.5 Remove `withGateway` from `POST /api/health-profile/synthesis`; free refresh
- [x] 6.6 Update Health Profile refresh control to call free endpoint without payment headers

## 7. Env and frozen stack

- [x] 7.1 Make `SELLER_ADDRESS`, `CIRCLE_*`, and Google-for-Circle client env vars optional or remove from required schema
- [x] 7.2 Update `env-client` and docs (`docs/07-ops/env-vars.md`) for Supabase Auth
- [x] 7.3 Ensure build/typecheck does not require Circle secrets; leave agent/x402 modules frozen unless they break build
- [x] 7.4 Stop importing Circle SDK from human auth path; remove unused human wallet API routes from navigation/UX (`/api/circle`, `/api/wallet/balance` unlinked)

## 8. Guards and API consistency

- [x] 8.1 Confirm `/app` and `/onboarding` layouts use new session helper
- [x] 8.2 Sweep API routes using `getSessionProfileId` for 401 behavior with Supabase session
- [x] 8.3 Update `GET /api/profile` response shape (email, no required wallet fields)

## 9. Verification

- [x] 9.1 Smoke: Google sign-in → onboarding → `/app`
- [x] 9.2 Smoke: magic link → check-email → callback → onboarding or `/app`
- [x] 9.3 Smoke: free upload creates document job without 402
- [x] 9.4 Smoke: free report + free synthesis refresh without 402
- [x] 9.5 Smoke: sign out clears session; `/app` redirects to landing
- [x] 9.6 Smoke: unauthenticated API returns 401; legacy `eh_profile_id` alone does not authenticate
- [x] 9.7 Run `pnpm typecheck` (or project typecheck script) clean for touched code
