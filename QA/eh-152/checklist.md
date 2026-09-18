# EH-152: Share Access Management

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers the authenticated owner's share-management surface: status grouping, minimized access history, copy feedback, and immediate revoke. Public token verification remains an EH-151 check.

## Before you start

- [ ] Use a dedicated owner test account.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH152-ACTIVE-01` | Active synthetic share with future expiry | Active row |
| `EH152-EXPIRED-01` | Share whose expiry is in the past | Expired row |
| `EH152-REVOKED-01` | Share revoked during setup | Revoked row |
| `EH152-OTHER-01` | Share belonging to a second synthetic profile | Authorization boundary |

## Interface checks

### EH152-UI-01: Review share statuses

**Precondition:** The owner has the three own shares and must not own `EH152-OTHER-01`.

1. Go to **Settings → Shared reports**.
2. Review the active, expired, and revoked groups.
3. Inspect one access-history entry.

**Expected result:** The page distinguishes statuses and shows only approved metadata. No other profile, token, PIN, raw IP, full user agent, storage path, or report content is displayed.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-152 delivery.`

### EH152-UI-02: Revoke an active share

**Precondition:** `EH152-ACTIVE-01` is active and its link is open in a separate recipient browser.

1. Select **Revoke** for the active row.
2. Confirm the action.
3. Refresh the management page and the recipient link.

**Expected result:** The owner page shows revoked status after server confirmation. The recipient link fails on its next request; the UI does not show a stale active state.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-152 delivery.`

### EH152-UI-03: Copy a creation or replacement link

**Precondition:** The owner has just created a share or requested a replacement link, and the one-time plaintext response is visible.

1. Click **Copy link**.
2. Confirm visible success feedback.
3. Repeat with clipboard permission denied or unavailable.

**Expected result:** Success or a manual fallback is clear. Existing list rows never reveal a stored token, and no token appears in the visible UI or error message.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-152 delivery.`

## Developer evidence required

- [ ] Owner list and revoke endpoints enforce profile ownership and return no-store responses.
- [ ] Revoke visibility is tested against the same public verifier used by EH-151.
- [ ] Access events contain only approved fields with documented retention; raw IP/full user agent are absent.
- [ ] Cross-profile IDs return safe not-found/authorization behavior without metadata leakage.
- [ ] EH-154 receives event, revoke, and header evidence.
- [ ] Analytics request capture and application-log inspection prove creation/replacement tokens are absent from telemetry and errors.
- [ ] Replacement failure/retry/concurrency evidence proves the unique operation row enforces scoped idempotency, rollback keeps the predecessor active, and exactly one successor commits.
- [ ] Access-history projection hides expired events and cleanup evidence matches EH-151's deployed retention value and schedule.

## Out of scope or not manually testable yet

- Token generation, PIN verification, and public response policy are covered by EH-151.
- This checklist is planned; no row is evidence of an executed test until the implementation exists.
