# EH-152: Share Access Management

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the authenticated owner's share-management surface: status grouping, minimized access history, copy feedback, and immediate revoke. Public token verification remains an EH-151 check.

**Current local result:** The authenticated owner surface is executable against the local stack. Trusted public ingress remains unavailable, so recipient-side public assertions stay blocked.

**Dependency recheck (2026-10-06):** Local migrations `086_eh152_management_seam.sql` and `087_eh151_replacement_preflight.sql` were applied before the management API run. The local owner list, replacement, revoke, and projection paths responded successfully.

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

**Result:** `PASS`
**Notes / evidence link:** Executed 2026-10-06 with the synthetic owner account. **Settings → Shared reports** showed separate Active and Revoked groups, two revoked predecessors, one active share, coarse metadata, and no token, PIN, raw IP, full user agent, or report content.

### EH152-UI-02: Revoke an active share

**Precondition:** `EH152-ACTIVE-01` is active and its link is open in a separate recipient browser.

1. Select **Revoke** for the active row.
2. Confirm the action.
3. Refresh the management page and the recipient link.

**Expected result:** The owner page shows revoked status after server confirmation. The recipient link fails on its next request; the UI does not show a stale active state.

**Result:** `PASS` for owner state; recipient assertion **BLOCKED** by trusted ingress.
**Notes / evidence link:** Revoke returned HTTP 200 and the refreshed owner page removed the share from Active and displayed it under Revoked. A public recipient request cannot run past the local direct-origin `503` boundary.

### EH152-UI-03: Copy a creation or replacement link

**Precondition:** The owner has just created a share or requested a replacement link, and the one-time plaintext response is visible.

1. Click **Copy link**.
2. Confirm visible success feedback.
3. Repeat with clipboard permission denied or unavailable.

**Expected result:** Success or a manual fallback is clear. Existing list rows never reveal a stored token, and no token appears in the visible UI or error message.

**Result:** `PASS` for the available clipboard path; denial fallback not executed.
**Notes / evidence link:** After UI creation, **Copy link** produced `Share link copied. It has been cleared from this page.` The plaintext link input was cleared and the management rows did not reveal a stored token.

### EH152-UI-04: Create and use a replacement link

**Precondition:** The owner has an active synthetic share and the management page is available.

1. Select **Create replacement link** for the active row.
2. Confirm that the replacement link is shown once.
3. Copy the link, then refresh the management page.

**Expected result:** The predecessor becomes revoked after server confirmation, one replacement link is shown for copying, and refreshing the page does not reveal the plaintext link again.

**Result:** `PASS` for replacement state and idempotency; direct button click not separately repeated.
**Notes / evidence link:** The replacement API returned HTTP 200 with a successor; replaying the same idempotency key returned `already_completed` with the same successor. The refreshed UI showed the successor Active and predecessor Revoked.

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
- `pnpm test:eh151-db` passed after local migrations 086 and 087 were applied; the current run completed 44 pgTAP assertions.
- The authenticated browser run opened **Settings → Shared reports**, created a PIN-protected share, copied the one-time plaintext link, replaced a share with idempotency replay, revoked the successor, and verified Active/Revoked projection. Public recipient checks remain blocked at trusted ingress.
- Recheck: EH-154 remains `Planned`; its OpenSpec tasks and release checklist contain no completed evidence or privacy handoff for EH-152.

## Out of scope or not manually testable yet

- Token generation, PIN verification, and public response policy are covered by EH-151.
- This checklist is in progress; no row is evidence of an executed test until the result and evidence are recorded.

## Sprint 7 local integration run: 2026-10-06

- `pnpm test:eh152` passed.
- Authenticated API smoke passed for owner listing, replacement idempotency, revoke, no-store response headers, and scoped synthetic report ownership.
- The local management API initially failed against stale schema; applying migrations 086 and 087 fixed the missing management objects. This is recorded as environment setup, not a source-code change.
- Access-event success/last-access monotonicity, cross-profile API probing, and recipient revocation after a valid public request remain blocked by the absent trusted ingress or require dedicated concurrent evidence.
