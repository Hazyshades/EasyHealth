## Why

Authenticated `/app/*` soft navigation currently re-runs a write-on-read layout gate (`auth.getUser` + `ensureProfile` upsert + onboarding profile select) and then the client pays the same session work again through `/api/profile` and `/api/documents`. Local vs remote Supabase does not fix this: measured production RSC is already ~56ms p50, while the user-visible 2–3s is a call-graph and `next dev` remainder problem. The product needs a read-only navigation hot path so Documents and other shell routes stop repeating auth work after the user is already signed in.

## What Changes

- Stop creating or upserting `profiles` on every `/app/*` layout render. Profile ensure stays on auth callback (and onboarding entry if a row is still missing).
- Make the app layout gate read-only: resolve the session once, then read onboarding state. No write on a normal Documents/Dashboard/etc. navigation.
- Collapse the post-RSC identity/data waterfall for the documents hub so first list paint does not wait on a second `getUser` plus a separate `/api/profile` fetch.
- Keep `/api/documents` and other read APIs on the existing slim `getSessionProfileId` path (already specified); do not reintroduce `ensureProfile` there.
- Persist Supabase session refresh outside RSC when cookies are read-only in Server Components, so a stale access token can refresh without silently failing `setAll`. This is a correctness path with a latency budget, not the primary 2–3s fix.
- Add a measurable navigation budget verified on `next start` (not only `next dev`): one session resolution per layout request, zero profile writes on read navigation, documents list data available without a serial auth+profile+documents client chain.

## Capabilities

### New Capabilities
- `app-navigation-hot-path`: Call-graph and latency contract for authenticated `/app/*` navigations (one session read, no writes, page data not blocked on duplicate auth).

### Modified Capabilities
- `supabase-auth`: Profile ensure is an auth-entry concern; session cookie refresh must be able to persist outside RSC.
- `documents-loading-performance`: Documents hub first paint after navigation must not depend on a post-RSC serial `/api/profile` + extra `getUser` before the list request.

## Impact

- **Domain:** `auth-shell` (primary), `documents` (documents hub first paint).
- **Code:** `src/app/app/layout.tsx`, `src/app/onboarding/layout.tsx`, `src/app/auth/callback/route.ts`, `src/lib/auth/session.ts`, `src/lib/auth/profile.ts`, `src/lib/supabase/server.ts`, `src/components/auth-provider.tsx`, documents hub page/API.
- **APIs:** No new public product API required. Optional internal bootstrap/session helper is an implementation choice. Existing `GET /api/documents` and `GET /api/profile` remain.
- **Auth:** `/auth/callback` remains the place that exchanges the code and ensures `profiles`. Onboarding gates stay user-visible and ordered.
- **Infra:** May add a narrow session-refresh middleware or route-handler cookie writer. Must be measured so it does not become a new per-navigation tax.
- **Out of scope:** Rewriting all `/app/*` pages to RSC, thumbnail/storage signing redesign, worker pipeline, Health Profile synthesis, or treating `next dev` compile time as a production SLO.
- **QA:** `next start` warm authenticated RSC + documents list timings (p50/p95); regression that a new user still gets a profile row after callback; onboarding gates still redirect.
