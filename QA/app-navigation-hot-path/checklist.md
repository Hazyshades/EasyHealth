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

### NAV-UI-04: Server initial list failure is immediately recoverable

**Precondition:** `NAV-01` is signed in to a non-production environment with a QA profile containing no sensitive documents. Before navigation, make the server's `listDocumentsForProfile` dependency unavailable (for example, stop the local Supabase service); DevTools request blocking alone does not exercise this scenario.

1. Open `/app/documents` directly while the server dependency is unavailable.
2. In DevTools Network, confirm the page did not automatically call `GET /api/documents`.
3. Confirm the first list content is the generic error card with **Retry**, not a loading skeleton or "No lab results yet".
4. Restore the server dependency and click **Retry**.

**Expected result:** Retry clears the error and shows the normal list or a genuine empty state. The error copy contains no server details.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### NAV-UI-05: Client list and periodic refresh failures are recoverable

**Precondition:** `NAV-01` is signed in to a non-production environment. For periodic refresh, use a harmless QA document that remains **processing**. DevTools can block `GET /api/documents`.

1. Open **Documents** with requests unblocked, then block `GET /api/documents` and switch to another document-type tab.
2. Confirm the generic error card with **Retry** replaces the list; no empty-state copy is shown.
3. Unblock requests and click **Retry**. Confirm the normal list or genuine empty state returns.
4. With a processing QA document visible, block `GET /api/documents` again and wait for the 10-second periodic refresh.
5. Confirm the same error card appears without a full-page loading skeleton. Unblock requests and click **Retry**.

**Expected result:** Both client failures show generic error copy and a working **Retry** action. A successful Retry removes the error; a successful periodic refresh never flashes a full-page loading state.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [ ] `pnpm test:app-navigation-hot-path` passes: fail-closed callback, missing-profile gate, Documents first paint without `/api/profile`, expiry-gated refresh skip on warm tokens, and source guards that `/app/layout` never calls `ensureProfile`.
- [ ] `pnpm harness:app-navigation-hot-path` against `next start` (not only `next dev`): n≥10 warm authenticated `/app/documents` RSC, p50 ≤ 80ms, p95 ≤ 150ms, profile row unchanged, stale-token response sets auth cookies. Set `APP_BASE_URL` if the server is already running. Use `SKIP_RSC_BUDGET=1` only when the attached server is `next dev`.
- [ ] `pnpm typecheck`, `pnpm test:app-navigation-hot-path`, and `openspec validate documents-hub-failure-state-fixes --strict` pass.

## Out of scope or not manually testable yet

- `next dev --turbopack` first-compile time is not a production SLO.
- Thumbnail signing, document viewer bootstrap, worker pipeline, and Health Profile APIs are unchanged.
- Converting every `/app/*` page to RSC is deferred.
