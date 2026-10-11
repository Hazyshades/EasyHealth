# EH-152: Share Access Management

**Roadmap status:** In progress
**Build / environment:** Co-hosted staging on Contabo VM `217.216.86.38`; EasyHealth public Caddy HTTPS; official self-hosted Supabase Docker stack; private worker
**Test run date:** 2026-10-07
**Tester:** Local automated and browser smoke

## What this checklist covers

This checklist covers the authenticated owner's share-management surface: status grouping, minimized access history, copy feedback, and immediate revoke. Public token verification remains an EH-151 check.

**Current VM result:** The authenticated owner surface was executed against the persisted synthetic Auth owner on a temporary Basic-Auth QA ingress. **Settings → Shared reports** rendered Active, Expired, and Revoked groups, minimized access-history wording, download-policy metadata, and aggregate outcomes. The QA ingress was removed after the smoke; the production recipient-only hostname intentionally does not expose `/app/**`.

**Dependency recheck (2026-10-07):** Existing Caddy continued serving SmartFood while the EasyHealth and Supabase routes were added. Public `/share/*` reached private Next through Caddy mTLS/PROXY v2 and sidecar-to-origin mTLS; direct-origin requests without attestation returned HTTP `503`.

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
**Result:** `PASS — 2026-10-08 live synthetic owner smoke`
**Notes / evidence link:** The owner session opened **Settings → Shared reports** and displayed the Active (2 links), Expired (1 link), and Revoked (1 link) groups. The page exposed only report title, status, expiry, download policy, allowed formats, coarse aggregate outcomes, and the minimized access-history description; no token, PIN, raw IP, user agent, storage path, or unrelated profile appeared.

### EH152-UI-02: Revoke an active share

**Precondition:** `EH152-ACTIVE-01` is active and its link is open in a separate recipient browser.

1. Select **Revoke** for the active row.
2. Confirm the action.
3. Refresh the management page and the recipient link.

**Expected result:** The owner page shows revoked status after server confirmation. The recipient link fails on its next request; the UI does not show a stale active state.
**Result:** `PARTIAL — 2026-10-08 live synthetic owner smoke`
**Notes / evidence link:** The authenticated VM smoke clicked **Revoke** and the owner projection changed to the Revoked group without an error. The same-run recipient re-request after that UI action was not repeated, so immediate recipient invalidation remains an EH-151 verifier follow-up.

### EH152-UI-03: Copy a creation or replacement link

**Precondition:** The owner has just created a share or requested a replacement link, and the one-time plaintext response is visible.

1. Click **Copy link**.
2. Confirm visible success feedback.
3. Repeat with clipboard permission denied or unavailable.

**Expected result:** Success or a manual fallback is clear. Existing list rows never reveal a stored token, and no token appears in the visible UI or error message.
**Result:** `PARTIAL — normal clipboard path PASS; fallback not executed`
**Notes / evidence link:** The live owner smoke created a replacement, clicked **Copy link**, observed copy feedback, and confirmed the final visible page contained no share token. Clipboard-denied/unavailable fallback was not forced.

### EH152-UI-04: Create and use a replacement link

**Precondition:** The owner has an active synthetic share and the management page is available.

1. Select **Create replacement link** for the active row.
2. Confirm that the replacement link is shown once.
3. Copy the link, then refresh the management page.

**Expected result:** The predecessor becomes revoked after server confirmation, one replacement link is shown for copying, and refreshing the page does not reveal the plaintext link again.
**Result:** `PARTIAL — 2026-10-08 live synthetic owner smoke`
**Notes / evidence link:** The live smoke created a replacement, observed a one-time **Copy link** control, copied it, and the predecessor appeared in the Revoked group. A separate post-refresh assertion that the plaintext remains hidden was not run; no token was present in the final visible page.

## Developer evidence required

- [ ] Owner list and revoke endpoints enforce profile ownership and return no-store responses. _(Evidence provider: EH-152 management API owner.)_
- [ ] Revoke visibility is tested against the same public verifier used by EH-151. _(Evidence provider: EH-152 management owner; EH-151 verifier owner.)_
- [ ] Access events contain only approved fields with documented retention; raw IP/full user agent are absent. _(Evidence provider: EH-151 event owner; EH-152 projection owner.)_
- [ ] Last-access evidence proves the owner list reads EH-151's monotonic timestamp from successful report/API/export/raw-document authorization, ignores PIN-only/denied/expired/revoked/rate-limited requests, preserves the greatest reverse-order concurrent value, and never accepts or writes a client timestamp. _(Evidence provider: EH-151 route/repository owner; EH-152 management owner.)_
- [x] Cross-profile IDs return safe not-found/authorization behavior without metadata leakage. _(Live service evidence: owner listing returned four owner shares and the other profile listing returned one share; a foreign access-history query returned zero events and a foreign revoke returned `share_not_found`.)_
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

## Co-hosted recipient-ingress smoke: 2026-10-07

- **Ingress availability:** `PASS`. The public share page returned HTTP 200 over `https://easyhealth.217-216-86-38.sslip.io`; the route is backed by existing Caddy and private mTLS hops.
- **Direct-origin rejection:** `PASS`. A direct request to the private Next origin without signed edge metadata returned HTTP 503 and no report bytes.
- **Historical limitation at the time of this smoke:** The VM had no persisted reviewed synthetic share/report fixture. The self-hosted Supabase evidence below supersedes the fixture-availability limitation for public recipient checks.

## Self-hosted Supabase recipient evidence: 2026-10-07

- **Synthetic management fixtures:** `PASS` for deployment evidence. Owner/other profiles, reports, documents, and active/expired/revoked/PIN shares were persisted in the VM Supabase database using the service-only share RPC.
- **Public recipient verifier:** `PASS` for the shared EH-151 boundary. The valid share rendered; the expired and revoked fixtures returned the same generic unavailable page and HTTP 404 API response. This did not execute the authenticated owner revoke button.
- **Retention worker:** `PASS`. Expired access-event, rate-limit-bucket, and PIN-proof rows were present before a worker cleanup cycle and absent afterward. The worker remained running with zero restarts.
- **Remaining limitation:** The 2026-10-08 owner smoke closes the signed-in status-grouping and minimized-projection gap. UI revoke confirmation, one-time copy fallback, replacement-link controls, and concurrent last-access evidence remain pending; cross-profile service authorization is recorded above.

## Live authenticated owner controls: 2026-10-08

- Synthetic Auth owner `eh286-owner@example.test` signed in through the temporary QA-only route. The route was removed after the smoke.
- **Status projection:** Active, Expired, and Revoked groups rendered with minimized access-history metadata and no token, PIN, raw IP, full user agent, storage path, or report content.
- **Controls:** Revoke changed the selected share into the Revoked group; Create replacement link produced a one-time Copy link control; Copy link showed success feedback and left no token in the final visible page.
- **Remaining manual gap:** Clipboard-denied fallback and post-refresh plaintext-hiding were not forced. Recipient invalidation after the UI-triggered revoke remains covered by the public verifier rather than this exact browser sequence.
