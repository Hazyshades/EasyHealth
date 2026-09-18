# EH-151: Scoped Expiring Share Links

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist covers creation and public use of expiring, revocable, explicitly scoped report links with optional PIN protection. It checks the public boundary, not the owner access-history UI owned by EH-152.

## Before you start

- [ ] Use a dedicated owner account and a separate recipient browser/profile.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm the listed test data has finished processing, unless the check intentionally tests processing.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH151-REPORT-01` | Validated synthetic report with two in-scope documents | Report-only share |
| `EH151-DOC-01` | One document explicitly permitted for download | Narrow document scope |
| `EH151-OTHER-01` | Same owner's document outside the report scope | Scope denial |
| `EH151-PROFILE-B` | Report/document owned by a second synthetic profile | Profile isolation |

## Interface checks

### EH151-UI-01: Open a report-only share

**Precondition:** Owner has a validated report from `EH151-REPORT-01` and creates a share with report-only policy and a short future expiry.

1. Copy the link into a separate recipient browser with no signed-in session.
2. Open the link.
3. Inspect the visible report and available actions.

**Expected result:** Only the selected validated report is visible and no raw document download is offered when policy denies it. Cache, indexing, referrer, and analytics controls are evidenced in the developer section.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-151 delivery.`

### EH151-UI-02: Verify optional PIN and generic failure

**Precondition:** Owner has created an expiring share with an optional PIN.

1. Open the link without a PIN.
2. Submit an incorrect PIN.
3. Submit the correct PIN in the same recipient browser.

**Expected result:** Missing/incorrect PIN responses do not reveal whether the token, PIN, expiry, or revocation caused a failure. The correct PIN opens only the scoped report after rate limits allow it.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-151 delivery.`

### EH151-UI-03: Deny an out-of-scope document

**Precondition:** Share includes `EH151-DOC-01` but not `EH151-OTHER-01`.

1. Open the valid shared report.
2. Attempt to request the excluded document through the visible UI or a direct resource URL.

**Expected result:** The excluded document is denied with a generic error. No storage path, filename metadata, or signed URL for the excluded document appears.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-151 delivery.`

### EH151-UI-04: Verify expiry and revoke failure

**Precondition:** Create one share that expires soon and one share that the owner revokes.

1. Open each link before and after its expiry/revoke state.
2. Compare the visible failure message and whether report content is shown.

**Expected result:** Both links fail safely after the state change with the same generic visible outcome and no report content.

**Result:** `N/A`
**Notes / evidence link:** `Implementation not started; execute after EH-151 delivery.`

## Developer evidence required

- [ ] Token generation uses the platform CSPRNG, stores only keyed digests, and redacts token values from logs/telemetry.
- [ ] PIN hashing, attempt limits, and shared rate limiting are exercised against the production adapters.
- [ ] Cross-profile, scope, expiry, revoke, archived-source, and raw-download tests fail closed.
- [ ] Public headers prove no-store/private caching, noindex/nofollow, and restrictive referrer policy.
- [ ] EH-154 receives route/header/log evidence for the privacy gate.
- [ ] Focused route evidence proves invalid, expired, and revoked requests use the same safe status/body contract; header and cache assertions are captured separately.
- [ ] Event retention evidence records `public.cleanup_report_share_access_events`, `SHARE_ACCESS_EVENT_RETENTION_DAYS`, expiry calculation, `worker/src/index.ts` hourly scheduling, advisory-lock exclusion, 500-row batches, bounded retries, and deployment-log alerting at the deployed value.
- [ ] Malformed/unknown-token requests create no share-scoped event and aggregate rate-limit telemetry contains no token, PIN, or share identifier.
- [ ] Raw-document proxy evidence proves revocation, expiry, archive state, and child-scope checks run on every request after a prior request and no storage signed URL is issued.
- [ ] Public request capture proves no third-party analytics request contains the share URL or token.

## Out of scope or not manually testable yet

- Owner link list, revoke controls, and access history UI are covered by EH-152.
- The checklist is planned; no row is evidence of an executed test until the implementation exists.
