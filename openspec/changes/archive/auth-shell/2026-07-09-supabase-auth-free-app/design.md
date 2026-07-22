## Context

EasyHealth’s human PHR product currently authenticates via Circle user-controlled wallets (Google social login through W3S SDK). Identity is keyed by `profiles.wallet_address`. Session is an httpOnly cookie `eh_profile_id` holding a bare profile UUID (no JWT proof). Upload, reports, and synthesis refresh are gated by x402 USDC payments (`withGateway`).

Product direction: consumer PHR with **Supabase Auth** (Google + email magic link), **all human features free**, and **hard freeze** of Circle/Arc/x402/Agent tracks. Demo data is disposable (reset). Document pipeline, worker, and AI providers stay as-is.

Domain: primarily `auth-shell`; payment unhook on human routes in documents / reports / health-profile. Do not advance `agent-api` or `payments` domains.

## Goals / Non-Goals

**Goals:**

- Supabase Auth session for all human API routes and layouts
- Google OAuth + email magic link sign-in
- Auto-create `profiles` row on first successful auth (`profiles.id = auth.users.id`)
- Free upload, free reports, free synthesis refresh (session only)
- Replace wallet UI with user identity chrome (email / name / sign out)
- Relax env so app boots without Circle/Seller secrets
- Wipe wallet-era demo data and storage objects
- Improve security vs forgeable profile cookie

**Non-Goals:**

- Apple / Facebook OAuth (later)
- Password-based email signup
- Migrating existing wallet users
- Full RLS policies for end users (service_role + session check remains)
- Deleting or redesigning Agent API / x402 agent stack (freeze only)
- New monetization (Stripe, subscriptions)
- Legal markdown overhaul (optional follow-up)
- Changing document processing / Nebius AI pipelines

## Decisions

### 1. Auth provider: Supabase Auth

- **Choice:** Supabase Auth with `@supabase/ssr` for Next.js App Router (browser client + server client + route handler callback).
- **Why:** Already on Supabase for DB/storage; Google + magic link built-in; PKCE-friendly; less custom crypto than Auth.js + hand-rolled users.
- **Alternatives:** Auth.js (more glue, duplicate user store); Clerk (extra vendor); custom passwords (rejected).

### 2. Profile identity: `profiles.id = auth.users.id`

- **Choice:** On first login, insert `profiles` with `id` equal to `auth.users.id`. All existing FKs keep using `profile_id`.
- **Why:** Cleanest joins and future RLS (`auth.uid() = id`); clean reset allows breaking wallet PK semantics.
- **Alternatives:** Separate `user_id` FK (extra column, no benefit on reset).

### 3. Session resolution

- **Choice:** Replace `getSessionProfileId()` cookie reader with Supabase `getUser()` (or equivalent) on the server; profile id = `user.id`. Delete `eh_profile_id` cookie usage.
- **Why:** Cryptographically verified session; stops arbitrary profile impersonation.
- **Implementation sketch:**
  - `src/lib/supabase/server.ts` — cookie-bound server client
  - `src/lib/supabase/client.ts` — browser client
  - `src/lib/auth/session.ts` — `getSessionProfileId()` reimplemented via Supabase user
  - `POST /api/auth/session` (wallet body) removed or replaced by no-op / deleted
  - `GET`/`POST` `/auth/callback` route for code exchange

### 4. ensureProfile on login

- **Choice:** After OAuth callback or magic-link session establishment, call `ensureProfile(user)`:
  - if profile missing → insert with email, optional display name from metadata
  - if exists → optionally refresh email if changed
- **Where:** Server-side in callback and/or first authenticated API/layout touch (idempotent). Prefer callback + defensive ensure in session helper.

### 5. Email magic link UX

- **Choice:** Landing (or inline) email field → Supabase `signInWithOtp({ email, options: { emailRedirectTo } })` → `/login/check-email` → user clicks link → `/auth/callback` → session → onboarding or `/app`.
- **Auto-link:** Enable Supabase automatic identity linking by verified email so Google and magic link with same email share one user when supported by project settings.
- **Email on profile:** Read-only from auth; shown on account page; not user-editable in MVP.

### 6. Google OAuth

- **Choice:** Configure Google provider in Supabase Dashboard; app calls `signInWithOAuth({ provider: 'google' })`. App no longer needs Circle’s Google Client ID wiring; remove `NEXT_PUBLIC_CIRCLE_APP_ID` / Circle Google coupling from human login path.
- **Prefill:** Pass Google full name into onboarding profile gate (existing prefill pattern, source = Supabase `user_metadata`).

### 7. Free human product

- **Choice:** Remove `withGateway` from:
  - `POST /api/upload`
  - report generation routes that use x402
  - `POST /api/health-profile/synthesis`
- Handlers require valid session only.
- UI: remove fund-wallet / payment-failure-to-fund flows from upload-zone, profile, reports.

### 8. Freeze policy for Circle / x402 / agent

- **Choice:** Unhook human paths; stop requiring frozen secrets in `env.ts`; leave agent/x402/circle modules in tree if unused (no active development). Delete or gut only what blocks typecheck/build or confuses human UX (wallet components, landing pay copy).
- **Why:** Hard freeze without a giant delete PR; avoids thrashing archived agent specs mid-flight.

### 9. Schema migration

- **Choice:**
  1. Wipe demo data: truncate app tables cascading from `profiles`; purge storage bucket objects for demo docs.
  2. Alter `profiles`: drop `NOT NULL` / drop `wallet_address` and `circle_wallet_id` (or keep nullable legacy columns unused — prefer drop for clarity on reset).
  3. Ensure `email` unique nullable or unique where present.
  4. No FK to `auth.users` required if using matching UUIDs (optional FK if project supports it).

### 10. UI architecture

- **Choice:** Replace `WalletProvider` with `AuthProvider` (or thin Supabase session context):
  - `profileId`, `email`, `displayName`, `loading`, `signInWithGoogle`, `signInWithMagicLink`, `signOut`, `refreshAccountIdentity`
  - Remove: `walletAddress`, `usdcBalance`, `fundGatewayWallet`, `canSignTransactions`
- Top bar: page title | user menu | sign out.
- Account: email, provider hint, name, created_at.
- Landing: free PHR messaging; Google + email CTA.

### 11. Env

- **Required after change:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, AI keys as today, `URL` / site URL for redirects.
- **No longer required for boot:** `SELLER_ADDRESS`, `CIRCLE_API_KEY`, `NEXT_PUBLIC_CIRCLE_APP_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google client lives in Supabase if using hosted OAuth).

### 12. Onboarding

- Keep existing gates: first_name → consents → wizard.
- Trigger after Supabase session, not wallet connect.
- Magic-link users without name: empty name fields, email known.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Magic link deliverability / spam folder | Clear check-email UX; resend; use Supabase SMTP or custom SMTP later |
| Google OAuth misconfig (redirect URI) | Document exact Supabase callback URL; test localhost + prod |
| Account linking edge cases (same email different providers) | Enable auto-link; document if user sees “already registered” |
| Leaving frozen x402 code confuses future contributors | Comment / README note; env optional; human routes free |
| Service_role still bypasses RLS | Document; session check on every human route; RLS as follow-up |
| Session helper used widely — regression if null user | Shared `getSessionProfileId` + 401 pattern; smoke checklist |
| Concurrent nebius-production-providers change | Do not touch AI model env beyond Circle removal; avoid merge conflicts on same files where possible |

## Migration Plan

1. **Ops (before/alongside code):** Enable Google + email (magic link) in Supabase Auth; set Site URL and redirect allow-list; configure Google Cloud OAuth client for Supabase.
2. **DB:** Apply migration (wipe + schema); purge storage.
3. **App deploy:** Ship auth clients, callback, AuthProvider, free routes, env relaxation together (single breaking cutover).
4. **Verify:** Google login, magic link, onboarding, free upload, free report/synthesis, sign out, unauthenticated redirects.
5. **Rollback:** Revert deploy; restore DB from backup if needed (demo reset is intentional loss). No dual-auth support planned.

## Open Questions

- None blocking implementation given agreed defaults:
  - Profile id = auth uid
  - RLS later
  - Auto-link on
  - Landing + check-email + callback (no separate full `/login` required beyond check-email)
  - Email read-only
  - Storage wipe yes
  - Freeze dead code; unhook human payments
  - Landing + env docs in scope; legal follow-up
