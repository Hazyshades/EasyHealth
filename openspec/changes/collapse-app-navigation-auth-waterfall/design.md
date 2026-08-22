## Context

Measured authenticated navigation to `/app/documents` is not a database-distance problem. Local Supabase REST is 4–11ms and `auth.getUser` is ~40–70ms. `next start` warm RSC is already ~56ms p50. The slow user-visible path is a call graph:

```text
soft-nav /app/documents
  layout: getUser → ensureProfile UPSERT → getProfileById
  hydrate
  AuthProvider: /api/profile  (getUser again)
  DocumentsPage: /api/documents (getUser again + list)
```

`src/app/app/layout.tsx` calls `getSessionProfileIdEnsured()` on every `/app/*` render. That upserts `profiles` even for returning users. `documents-loading-performance` already forbids `ensureProfile` on document GET APIs; the layout never got the same rule. `createServerSupabaseClient` swallows cookie `setAll` failures in Server Components, so a token refresh cannot persist from RSC.

## Goals / Non-Goals

**Goals:**

- Make `/app/*` layout a read-only session + onboarding gate.
- Confine `ensureProfile` to auth entry (`/auth/callback`) and a last-chance onboarding path if the row is still missing.
- Resolve the Supabase user at most once per App Router request (layout + server page share it).
- Let Documents hub first list paint start without waiting on a serial `/api/profile` fetch.
- Persist session refresh outside RSC when the access token is expired or near expiry, without adding a getUser tax to every warm request.
- Verify on `next start` with p50/p95, not only `next dev`.

**Non-Goals:**

- Making `next dev --turbopack` compile time a production SLO.
- Converting every `/app/*` page from client to RSC.
- Changing Google OAuth, magic-link UX copy, or onboarding gate order/screens.
- Reworking thumbnail signing, document viewer bootstrap, worker pipeline, or Health Profile APIs.
- Adding a general-purpose `/api/bootstrap` for all app routes in this change.

## Decisions

### 1. Layout uses slim session + profile read; never upsert

`src/app/app/layout.tsx` switches from `getSessionProfileIdEnsured()` to `getSessionProfileId()` plus `getProfileOnboardingState()` (existing `getProfileById` select).

- No session → `/?signin=required` (unchanged).
- Session but no profile row → treat as incomplete onboarding and send to `/onboarding/profile`, do not upsert in the app shell.
- Profile exists → existing profile/consent redirects.

`getSessionProfileIdEnsured` remains only for onboarding layout as a last-chance create if callback did not persist a row.

**Alternative considered:** keep upsert in layout “just in case.” Rejected because measurements show it is a write on every soft-nav (~5–20ms plus extra client) and duplicates work `/auth/callback` already does.

### 2. Callback must not enter `/app` if ensure failed

Today `/auth/callback` logs `ensureProfile` failure and still redirects to `/app`. That is why layout grew a retry upsert. After this change, callback failure redirects to `/?signin=error`. New users always get a `profiles` row before the shell, or they see an error and can retry sign-in.

**Alternative considered:** silent retry on first `/app` render only. Rejected because “first render” is indistinguishable from every soft-nav in App Router layouts.

### 3. Deduplicate `getUser` with React `cache()` per request

Wrap `getSessionProfileId` (and therefore `auth.getUser`) in React `cache()` so app layout and a server Documents page share one Auth round-trip in the same request. Do not add a request-scoped upsert cache; upserts should not happen here.

**Alternative considered:** pass profileId via React context from layout only. Still need getUser in API routes; `cache()` does not span those HTTP calls, which is correct.

### 4. Documents hub: server-provided initial list, client keeps tabs

Keep the existing client table/tabs/filters. Change `/app/documents/page.tsx` so a server wrapper loads the current tab’s document list with the same authorization as `GET /api/documents` and passes it as `initialDocuments`. The client may still call `/api/documents` on tab change and soft poll.

This removes the “wait for RSC shell, then wait for AuthProvider profile, then fetch documents” chain on first paint of Lab results.

**Alternative considered:** a new `/api/app/bootstrap`. Rejected as extra surface; Documents is the measured page and already has a list API. **Alternative considered:** leave client fetch but fire it without waiting for `/api/profile`. Smaller, but still a second getUser after RSC. Server initial list is the actual collapse.

### 5. AuthProvider identity is session-scoped, not per-route

`AuthProvider` already lives in the root layout, so it should not remount on soft-nav. It currently always hits `/api/profile` in `applyIdentity`. Keep that fetch for first session application and explicit `refreshAccountIdentity` (account save). Do not add additional profile fetches from Documents hub mount. If `onAuthStateChange` refires on token refresh, identity update may reuse the auth user and skip `/api/profile` unless the user id changed.

**Alternative considered:** pass first/last name from the server layout into the client shell. Possible follow-up; not required if Documents no longer depends on that fetch.

### 6. Session refresh middleware is expiry-gated, not unconditional

Add a narrow Next.js middleware that creates the Supabase SSR client and writes cookies, but only attempts refresh when the access token is absent, invalid, or expires within 60 seconds. Warm valid sessions skip the refresh round-trip.

Layout still calls `getUser` (JWT validation). Middleware is for persisting rotated refresh cookies that RSC cannot `setAll`.

**Alternative considered:** always-on Supabase middleware (docs default). Rejected without a budget: an extra getUser on every request would add ~40ms in prod and can inflate `next dev`. **Alternative considered:** no middleware, only API route `setAll`. Rejected because the measured stale-token RSC path already calls `setAll` and fails readonly.

### 7. Measure production (`next start`), record dev separately

Acceptance timings are `next build && next start`, authenticated, local or remote Supabase, n≥10 warm:

| Metric | Budget |
|---|---|
| `GET /app/documents?_rsc=` p50 / p95 | ≤ 80ms / ≤ 150ms |
| Profile upsert count on that request | 0 |
| `auth.getUser` in layout request | 1 (shared via `cache()`) |
| Stale-token RSC still authenticates after middleware refresh | yes |

`next dev` compile/remainder is diagnostic only.

## Risks / Trade-offs

- **[Risk] Users whose callback ensure failed used to be repaired by layout upsert.** → Mitigation: callback fails closed; onboarding layout may still ensure if the row is missing.
- **[Risk] Expiry-gated middleware misses a refresh shape Supabase uses (chunked cookies, new storage key).** → Mitigation: integration check with the real `sb-*-auth-token` cookie from `@supabase/ssr`; stale-token probe from the existing harness.
- **[Risk] Server-loaded documents list duplicates API query logic.** → Mitigation: extract the existing `GET /api/documents` query/sign helper and call it from both the route and the page.
- **[Risk] Middleware adds latency if the expiry gate is wrong.** → Mitigation: log/measure skip vs refresh; budget is “no extra getUser on warm valid tokens.”
- **[Trade-off] Other client `/app/*` pages still fetch their own APIs after RSC.** This change only collapses Documents first paint plus the shared auth hot path. That is the measured user complaint.

## Migration Plan

- No database migration. Profile schema unchanged.
- Deploy is a single app release: callback, layouts, optional middleware, documents page wrapper.
- Rollback: revert the app commit; users remain able to sign in. Worst case after rollback is the current extra upsert, not data loss.
- Local env: `NEXT_PUBLIC_SUPABASE_*` is compile-time; after switching local/remote, restart Next without inherited remote env. Not a runtime feature, but required to validate this change.

## Open Questions

- None blocking implementation. If middleware expiry parsing is awkward with chunked cookies, fall back to “attempt refresh only when `getUser` returns Auth session missing/expired,” still skipping work on the happy path.
