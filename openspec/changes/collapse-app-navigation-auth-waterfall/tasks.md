## 1. Auth-shell: read-only app layout

- [x] 1.1 Wrap `getSessionProfileId` in React `cache()` so one App Router request shares a single `auth.getUser`.
- [x] 1.2 Change `src/app/app/layout.tsx` to use `getSessionProfileId` + `getProfileOnboardingState` and never call `ensureProfile` / `getSessionProfileIdEnsured`.
- [x] 1.3 If the session exists but `getProfileById` finds no row, redirect to `/onboarding/profile` instead of upserting in the shell.
- [x] 1.4 Keep `getSessionProfileIdEnsured` only on `/onboarding/layout` as last-chance create when the profile row is missing.
- [x] 1.5 Make `/auth/callback` fail closed: on `ensureProfile` error redirect to `/?signin=error`, not `/app`.

## 2. Auth-shell: session refresh persistence

- [x] 2.1 Add expiry-gated middleware (or equivalent) that persists Supabase cookie `setAll` when the access token is missing, invalid, or within 60 seconds of expiry.
- [x] 2.2 Skip Auth refresh on warm valid tokens so middleware does not add a getUser/refresh round-trip to every `/app/*` navigation.
- [x] 2.3 Confirm a stale-token request receives `Set-Cookie` and a follow-up request resolves the same user.

## 3. Documents: collapse first-paint waterfall

- [x] 3.1 Extract the `GET /api/documents` list query + thumbnail signing into a shared server helper used by the route.
- [x] 3.2 Make `/app/documents` a server wrapper that loads the initial Lab results list with the cached session user and passes `initialDocuments` into the existing client hub.
- [x] 3.3 Keep tab changes and processing polls on `GET /api/documents`; do not fetch `/api/profile` as a prerequisite for first list paint.
- [x] 3.4 Stop Documents hub (and related chrome on that page) from issuing an extra `/api/profile` on mount; leave AuthProvider’s first-session identity fetch and explicit account refresh in place.

## 4. Evidence and guards

- [x] 4.1 Add a focused `next start` harness (or script) that logs in, hits warm authenticated `/app/documents` RSC n≥10, and asserts p50 ≤ 80ms, p95 ≤ 150ms, and zero `profiles` upserts.
- [x] 4.2 Cover callback-ensure failure (no `/app` redirect), missing-profile shell redirect to onboarding, and documents first paint without `/api/profile`.
- [x] 4.3 Register the harness in package scripts; run typecheck and `openspec validate --change collapse-app-navigation-auth-waterfall --strict`.
- [x] 4.4 Add `QA/app-navigation-hot-path/checklist.md` with local-env restart notes (`NEXT_PUBLIC_SUPABASE_*` is compile-time) and manual Documents soft-nav checks.
