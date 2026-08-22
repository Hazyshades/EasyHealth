# App navigation hot path

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

Signed-in users moving around `/app`, especially **Documents**, should not wait on a profile upsert or a serial identity fetch before the lab list appears. A warm production server keeps that navigation fast. Local vs remote Supabase is not the lever.

## Before you start

- [ ] Use a dedicated test account that already finished onboarding (name + consents).
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env` match the project you intend (local API is `http://127.0.0.1:54321`).
- [ ] Restart Next after changing those `NEXT_PUBLIC_*` values. They are compile-time: inherited shell env can override `.env`, and a running `next dev` will keep the old client bundle until restart.
- [ ] Prefer `pnpm build` then `npx next start -p 3000` for timing. `pnpm dev` compile remainder is diagnostic only.
- [ ] Use only synthetic or de-identified documents.

## Local environment notes

| Check | Why it matters |
| --- | --- |
| Open `http://localhost:3000`, not `http://127.0.0.1:3000`, for magic link | Auth redirect allow-list treats them as different hosts. |
| After switching local/remote Supabase, hard-refresh the browser and clear `localhost` cookies | Cookie name is `sb-<project-ref>-auth-token`. A remote cookie will not authenticate a local app. |
| Mailpit for local magic links | `http://127.0.0.1:54324` |

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `NAV-01` | Onboarded account with at least one processed lab result | First paint of Lab results |
| `NAV-02` | Same account, no extra documents required | Tab change still uses the list API |
| `NAV-03` | Fresh account that has not finished the name gate | Missing profile goes to onboarding, not a silent upsert in `/app` |

## Interface checks

### NAV-UI-01: Documents first list does not wait on profile chrome

**Precondition:** Signed in as `NAV-01`. Session is warm (you already opened `/app` once).

1. Go to **Dashboard** or another `/app` screen.
2. Open DevTools **Network**, preserve log, filter `documents` and `profile`.
3. Click **Documents**.
4. Confirm Lab results rows or the empty state appear without a prior `/api/profile` request blocking the list.

**Expected result:** The lab list is on the navigation/render of `/app/documents`. `/api/profile` may still run once for the shell identity, but the table must not wait for it. Tab changes still call `GET /api/documents`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### NAV-UI-02: Returning user is not sent through onboarding

**Precondition:** `NAV-01` already has a name and accepted terms.

1. Soft-navigate **Documents** → **Dashboard** → **Documents** three times.

**Expected result:** Each visit stays in the app shell. No flash of `/onboarding/profile` or `/onboarding/consent`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### NAV-UI-03: Missing profile is an onboarding redirect, not a shell repair

**Precondition:** `NAV-03` can sign in but has no `profiles` row, or the row has no first name.

1. Open `/app/documents` while signed in.

**Expected result:** The app sends the user to **Onboarding / profile**, not a successful Documents shell. Signing in again through the magic-link/OAuth callback still creates the profile at `/auth/callback` on success, or shows a sign-in error if ensure fails.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### NAV-UI-04: List load failure shows an error card with Retry

**Precondition:** `NAV-01` is signed in. Ability to block `GET /api/documents` (DevTools Network → Block request URL) or stop the backend.

1. Open **Documents** with the list request blocked, or switch tabs while blocked.
2. Confirm an error card with a **Retry** button appears instead of "No lab results yet".
3. Unblock requests and click **Retry**.

**Expected result:** The error card clears and the normal list (or genuine empty state) returns. No server error details are shown in the copy.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] `pnpm test:app-navigation-hot-path` passes: fail-closed callback, missing-profile gate, Documents first paint without `/api/profile`, expiry-gated refresh skip on warm tokens, and source guards that `/app/layout` never calls `ensureProfile`.
- [ ] `pnpm harness:app-navigation-hot-path` against `next start` (not only `next dev`): n≥10 warm authenticated `/app/documents` RSC, p50 ≤ 80ms, p95 ≤ 150ms, profile row unchanged, stale-token response sets auth cookies. Set `APP_BASE_URL` if the server is already running. Use `SKIP_RSC_BUDGET=1` only when the attached server is `next dev`.
- [ ] `pnpm typecheck` and `openspec validate --change collapse-app-navigation-auth-waterfall --strict` pass.

## Out of scope or not manually testable yet

- `next dev --turbopack` first-compile time is not a production SLO.
- Thumbnail signing, document viewer bootstrap, worker pipeline, and Health Profile APIs are unchanged.
- Converting every `/app/*` page to RSC is deferred.
