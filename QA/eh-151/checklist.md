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
| `EH151-ARCHIVE-01` | Validated shared report whose cited source row is archived/removed while its parent document remains active | Read-time source-unavailable limitation |
| `EH151-VALIDATION-01` | Valid, limited, invalid, legacy, missing, and tampered EH-148 validation-envelope fixtures | Publication gate |
| `EH151-RATE-01` | Repeated invalid-token and wrong-PIN requests with the shared limiter available and unavailable | Production rate-limit boundary |
| `EH151-PIN-01` | Two active PIN-protected shares plus missing, wrong, expired, revoked, and cross-share proof-cookie variants | Non-URL proof lifecycle and route-wide proof binding |
| `EH151-REPLACE-01` | Active share with repeated same-key replacement retry and competing different-key replacement request | Atomic replacement idempotency |

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
2. Submit an incorrect PIN through the visible PIN form, then submit the correct PIN.
3. Confirm the request body is JSON and inspect only cookie attributes, not the cookie value.
4. Open the report, API resource, approved export, and permitted raw-document resource from the same recipient browser.

**Expected result:** Missing/incorrect PIN responses do not reveal whether the token, PIN, expiry, or revocation caused a failure. The correct PIN establishes only the protected `__Host-eh-share-pin` cookie (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`) and opens only the scoped report after rate limits allow it; every route requires the same proof before returning bytes. The PIN and proof do not appear in URLs, response fields, or visible diagnostics.

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

- [ ] Token generation uses the platform CSPRNG, stores only keyed digests, and redacts token values from logs/telemetry. *(Evidence provider: EH-151 token owner.)*
- [ ] PIN proof evidence proves `POST /api/share/[token]/pin` accepts body-only PIN material, stores only a keyed random proof digest bound to the exact share, sets the protected `__Host-eh-share-pin` cookie with the deployed TTL, and invokes one verifier before page/API/export/raw-document bytes. Missing, wrong, expired, revoked, cross-share, or malformed proofs return one generic outcome, clear invalid cookies, and produce no bytes; PIN/proof/cookie/request-body values are absent from logs, telemetry, access events, URLs, referrers, and response fields. Bounded expired-proof cleanup and `SHARE_PIN_PROOF_PEPPER`/`SHARE_PIN_PROOF_TTL_SECONDS` configuration evidence are included. *(Evidence provider: EH-151 PIN/proof owner; EH-154 gate owner.)*
- [ ] Cross-profile, scope, expiry, revoke, archived/removed-source, tombstone, owner report deletion with active/replaced shares and access history, and raw-download tests fail closed; archived/removed cited-source report reads preserve the snapshot with `SOURCE_UNAVAILABLE` only through EH-148's resolver while tombstoned source documents invalidate the complete report before public bytes, and all live/raw access is denied. *(Evidence provider: EH-151 route owner; EH-148 read-resolver owner; durable-deletion owner; EH-154 gate owner.)*
- [ ] Platform deployment evidence matches `deployment/trusted-ingress.yaml`: unauthenticated public HTTPS listener for browser recipients, separate private/mTLS ingress-to-application leg, private-only app origin, stripped/overwritten forwarding and `X-EH-Edge-*` headers, verified immediate peer metadata through `trusted-ingress-transport.ts`, and trusted-ingress enforcement before token/limiter/body/bytes on page, API, PIN, EH-153 export, and raw-document subroutes; direct-origin rejection and valid/spoofed/missing-peer harness results cover every handler. *(Evidence provider: EH-151 platform/deployment owner; EH-154 gate owner.)*
- [ ] Replacement evidence proves the service-only RPC locks the predecessor, resolves same-key committed replay before requiring predecessor activity, validates a 1–128 printable-ASCII owner/share-scoped idempotency key, reserves it atomically, commits at most one successor, copies scope/policy, revokes the predecessor, returns no plaintext token on replay/conflict, and leaves the predecessor active after failure. *(Evidence provider: EH-151 replacement/RPC owner; EH-152 management owner; EH-154 gate owner.)*
- [ ] EH-148 validation-envelope evidence proves shares are created and served only for `valid`/`limited` reports with recognized versions; invalid, legacy, missing, and tampered envelopes fail closed without public issue-code leakage. *(Evidence provider: EH-148 read-resolver owner; EH-151 route/share owner; EH-154 gate owner.)*
- [ ] Public response evidence proves page/API, EH-153 exports, and raw-document proxy apply the shared policy before headers/body: no-store/private caching, noindex/nofollow, restrictive referrer policy, and no third-party analytics. *(Evidence provider: EH-151 policy-helper owner; EH-153 shared-export consumer; EH-154 gate owner.)*
- [ ] EH-154 receives route/header/log evidence for the privacy gate. *(Evidence provider: EH-151 share owner; EH-154 gate owner.)*
- [ ] Focused route evidence proves invalid, expired, and revoked requests use the same safe status/body contract; header and cache assertions are captured separately. *(Evidence provider: EH-151 route owner.)*
- [ ] Event retention evidence records `public.cleanup_report_share_access_events`, `SHARE_ACCESS_EVENT_RETENTION_DAYS`, expiry calculation, `worker/src/index.ts` hourly/continuation scheduling, `pg_try_advisory_xact_lock` release/contention, repeated 500-row backlog drain, bounded retries, and deployment-log alerting at the deployed value. *(Evidence provider: EH-151 worker/RPC owner; EH-154 release-gate owner.)*
- [ ] Malformed/unknown-token requests create no share-scoped event and aggregate rate-limit telemetry contains no token, PIN, or share identifier. *(Evidence provider: EH-151 event owner; EH-154 gate owner.)*
- [ ] Raw-document proxy evidence proves trusted-ingress, PIN proof, revocation, expiry, archive state, and child-scope checks run on every request after a prior request, the shared response policy is applied before streaming, and no storage signed URL is issued. *(Evidence provider: EH-151 raw-download owner; EH-154 gate owner.)*
- [ ] Public request capture proves no third-party analytics request contains the share URL or token. *(Evidence provider: EH-151 policy-helper owner; EH-154 gate owner.)*
- [ ] Deleted-report fixture proves cascading share/document/operation/event cleanup and generic public failure with no active capability or orphaned child state. *(Evidence provider: EH-151 persistence owner; EH-154 gate owner.)*
- [ ] PIN proof rows are cascaded on share/report deletion and invalidated by expiry/revoke/replacement; the worker drains expired rows under the 500-row/20-batch cap without logging proof material or emitting secret-bearing signals. *(Evidence provider: EH-151 persistence/worker owner; EH-154 gate owner.)*
- [ ] Atomic-create evidence proves fixed-search-path `public.create_report_share` locks/rechecks owner/report/document scope, commits the share and all child rows atomically, denies direct table DML, rolls back on child insert/validation failure, and returns the plaintext link only after commit. *(Evidence provider: EH-151 persistence/share owner; EH-154 gate owner.)*
- [ ] Last-access evidence proves only successful report/API/export/raw reads call monotonic service-only `public.touch_report_share_last_accessed`; PIN establishment and denied/expired/revoked/rate-limited outcomes do not update it, reverse-order concurrent writes preserve the greatest timestamp, and EH-152 reads without writing. *(Evidence provider: EH-151 route/repository owner; EH-152 management owner; EH-154 gate owner.)*

## Out of scope or not manually testable yet

- Owner link list, revoke controls, and access history UI are covered by EH-152.
- The checklist is planned; no row is evidence of an executed test until the implementation exists.
