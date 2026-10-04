# EH-152: Share Access Management

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the authenticated owner's share-management surface: status grouping, minimized access history, copy feedback, and immediate revoke. Public token verification remains an EH-151 check.

**Current limitation:** Manual checks remain `N/A` in this checkout. Browser/API execution requires an authenticated app with EH-151 deployed; the local Next.js runtime can serve the sign-in shell, but this session has no authenticated owner account or trusted EH-151 staging ingress.

**Dependency recheck (2026-09-30):** `master` is now at `967f8fe`, including the merged EH-151 owner-management seam follow-ups (PR #275 and PR #276). EH-151 deployment and release-gate evidence remain pending, so authenticated manual checks remain blocked.

## Before you start

- [ ] Use a dedicated owner test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID                 | Test document or setup                        | Purpose                |
| ------------------ | --------------------------------------------- | ---------------------- |
| `EH152-ACTIVE-01`  | Active synthetic share with future expiry     | Active row             |
| `EH152-EXPIRED-01` | Share whose expiry is in the past             | Expired row            |
| `EH152-REVOKED-01` | Share revoked during setup                    | Revoked row            |
| `EH152-OTHER-01`   | Share belonging to a second synthetic profile | Authorization boundary |

## Interface checks

### EH152-UI-01: Review share statuses

**Precondition:** The owner has the three own shares and must not own `EH152-OTHER-01`.

1. Go to **Settings → Shared reports**.
2. Review the active, expired, and revoked groups.
3. Inspect one access-history entry.

**Expected result:** The page distinguishes statuses and shows only approved metadata. No other profile, token, PIN, raw IP, full user agent, storage path, or report content is displayed.

**Result:** `N/A`
**Notes / evidence link:** `Not executed in this session; run against the authenticated app after EH-151 deployment.`

### EH152-UI-02: Revoke an active share

**Precondition:** `EH152-ACTIVE-01` is active and its link is open in a separate recipient browser.

1. Select **Revoke** for the active row.
2. Confirm the action.
3. Refresh the management page and the recipient link.

**Expected result:** The owner page shows revoked status after server confirmation. The recipient link fails on its next request; the UI does not show a stale active state.

**Result:** `N/A`
**Notes / evidence link:** `Not executed in this session; run against the authenticated app after EH-151 deployment.`

### EH152-UI-03: Copy a creation or replacement link

**Precondition:** The owner has just created a share or requested a replacement link, and the one-time plaintext response is visible.

1. Click **Copy link**.
2. Confirm visible success feedback.
3. Repeat with clipboard permission denied or unavailable.

**Expected result:** Success or a manual fallback is clear. Existing list rows never reveal a stored token, and no token appears in the visible UI or error message.

**Result:** `N/A`
**Notes / evidence link:** `Not executed in this session; run against the authenticated app after EH-151 deployment.`

### EH152-UI-04: Create and use a replacement link

**Precondition:** The owner has an active synthetic share and the management page is available.

1. Select **Create replacement link** for the active row.
2. Confirm that the replacement link is shown once.
3. Copy the link, then refresh the management page.

**Expected result:** The predecessor becomes revoked after server confirmation, one replacement link is shown for copying, and refreshing the page does not reveal the plaintext link again.

**Result:** `N/A`
**Notes / evidence link:** `Not executed in this session; run against the authenticated app after EH-151 deployment.`

## Developer evidence required

- [ ] Owner list and revoke endpoints enforce profile ownership and return no-store responses. _(Evidence provider: EH-152 management API owner.)_
- [ ] Revoke visibility is tested against the same public verifier used by EH-151. _(Evidence provider: EH-152 management owner; EH-151 verifier owner.)_
- [ ] Access events contain only approved fields with documented retention; raw IP/full user agent are absent. _(Evidence provider: EH-151 event owner; EH-152 projection owner.)_
- [ ] Last-access evidence proves the owner list reads EH-151's monotonic timestamp from successful report/API/export/raw-document authorization, ignores PIN-only/denied/expired/revoked/rate-limited requests, preserves the greatest reverse-order concurrent value, and never accepts or writes a client timestamp. _(Evidence provider: EH-151 route/repository owner; EH-152 management owner.)_
- [ ] Cross-profile IDs return safe not-found/authorization behavior without metadata leakage. _(Evidence provider: EH-152 management API owner.)_
- [ ] EH-154 receives event, revoke, and header evidence. _(Evidence provider: EH-152 management owner; EH-154 gate owner.)_
- [ ] Analytics request capture and application-log inspection prove creation/replacement tokens are absent from telemetry and errors. _(Evidence provider: EH-152 management owner; EH-154 gate owner.)_
- [ ] Replacement failure/retry/concurrency evidence exercises EH-151's `public.replace_report_share` RPC and proves the unique operation row enforces scoped idempotency, rollback keeps the predecessor active, and exactly one successor commits. _(Evidence provider: EH-151 replacement-RPC owner; EH-152 management owner.)_
- [ ] Access-history projection hides expired events and cleanup evidence matches EH-151's deployed retention value and schedule. _(Evidence provider: EH-152 projection owner; EH-151 worker/RPC owner.)_

## Evidence captured in this session

- `pnpm test:eh151` passed the EH-151 scoped-share route fixtures.
- `pnpm test:eh152` passed the synthetic projection/token fixtures, including mixed statuses, cross-profile filtering, retained-event filtering, minimized output fields, monotonic timestamp preservation, token digest derivation, and idempotency-key boundaries.
- `pnpm exec tsc --noEmit --pretty false` passed.
- `openspec validate eh-152-share-access-management --type change --strict --json` passed.
- `pnpm test:eh151-db` remains blocked: local Supabase/pgTAP could not connect, the fallback PostgreSQL URL was unavailable, and Docker has no `supabase_db_easyhealth` container.
- `pnpm build` remains blocked by existing failures outside EH-152: Turbopack page-data collection reports missing modules for pre-existing API routes, while webpack rejects the pre-existing pure global selector in `src/components/onboarding/platform-tour.module.css`.
- Browser smoke reached the unauthenticated sign-in redirect; authenticated UI interaction remains `N/A` until a configured EH-151 environment is available.
- Recheck: EH-154 remains `Planned`; its OpenSpec tasks and release checklist contain no completed evidence or privacy handoff for EH-152.

## Out of scope or not manually testable yet

- Token generation, PIN verification, and public response policy are covered by EH-151.
- This checklist is in progress; no row is evidence of an executed test until the result and evidence are recorded.
