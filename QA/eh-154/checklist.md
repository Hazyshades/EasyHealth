# EH-154: Share-Link Privacy Release Gate

**Roadmap status:** Planned
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

This checklist records the release evidence for the unauthenticated share boundary, its management surface, and export/download adapters. It is a gate: an unresolved high or critical finding blocks release, and a code review alone is not a passing result.

## Before you start

- [ ] Use a dedicated synthetic owner account and at least one separate synthetic recipient profile/browser.
- [ ] Use only synthetic or de-identified documents.
- [ ] Confirm EH-151, EH-152, and EH-153 focused checks have evidence available.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH154-PROFILE-A` | Validated report and one explicitly scoped document | Allowed path |
| `EH154-PROFILE-B` | Separate profile with its own report/document | Cross-profile isolation |
| `EH154-EXPIRED` | Expired share token | Replay/expiry |
| `EH154-REVOKED` | Revoked share token | Immediate revoke |
| `EH154-RATE` | Synthetic repeated invalid-token/PIN requests | Abuse and rate limit |

## Interface checks

### EH154-UI-01: Exercise the public failure matrix

**Precondition:** EH-151 public routes and EH-153 exports are deployed to the reviewed test environment.

1. Open invalid, expired, revoked, wrong-PIN, cross-profile, and out-of-scope URLs using `EH154-PROFILE-A`/`EH154-PROFILE-B`.
2. Open one valid report-only share.
3. Attempt a denied raw-document or export resource.

**Expected result:** Failures are generic and fail closed. The valid share returns only its scope; the denied resource returns no data. Revocation is effective without a cache delay.

**Result:** `N/A`
**Notes / evidence link:** `Release-gate scenario; execute after EH-151 and EH-153 delivery.`

## Developer evidence required

- [ ] Threat model lists assets, actors, trust boundaries, abuse cases, controls, residual risk, and evidence owners. *(Evidence provider: EH-154 threat-model owner; privacy approver.)*
- [ ] Harness executes invalid/expired/revoked/PIN/cross-profile/scope/export/download scenarios against production adapters. *(Evidence provider: EH-154 harness owner; EH-151/EH-153 adapter owners.)*
- [ ] Captured logs/events contain no bearer token, PIN, source text, PHI, raw IP, full user agent, or storage path. *(Evidence provider: EH-151/EH-152/EH-153 instrumentation owners; EH-154 gate owner.)*
- [ ] Current/previous/unknown/malformed token-key selector and bounded rotation-window evidence proves reissue/revoke behavior and safe retirement of the previous key. *(Evidence provider: EH-151 key owner; EH-154 gate owner.)*
- [ ] Deployed rate-limit evidence proves EH-151's Postgres-backed `rate-limit.ts` adapter uses a configured `SHARE_RATE_LIMIT_PEPPER` without recording its value (approved secret-manager reference/version or fingerprint only), uses the recorded non-secret `10/60s` token / `30/60s` requester limits plus cleanup intervals, returns generic `429` on exhaustion and `503` on store failure, has no local fallback, persists no raw token/IP/user-agent values, and drains expired buckets through the bounded 500-row/20-batch worker cleanup with continuation/backlog/failure signals. *(Evidence provider: EH-151 rate-limit owner; EH-154 harness/gate owner.)*
- [ ] Access-event retention evidence proves the reviewed `SHARE_ACCESS_EVENT_RETENTION_DAYS` value, UTC expiry calculation, `cleanup_report_share_access_events` worker cadence/continuation, advisory-lock contention and release, bounded repeated-batch drain, retry/backoff, and backlog-alert evidence. *(Evidence provider: EH-151 event-retention owner; EH-154 gate owner.)*
- [ ] Developer harness captures no-store/private, noindex/nofollow, restrictive referrer policy, and absence of third-party analytics requests containing share URL/token. *(Evidence provider: EH-151 policy-helper owner; EH-153 public-export owner; EH-154 harness owner.)*
- [ ] Incident runbook covers token leakage, unauthorized access, rate-limit abuse, emergency revoke, evidence preservation, and privacy escalation. *(Evidence provider: EH-154 incident/runbook owner; privacy approver.)*
- [ ] Gate status is blocked for any unresolved high/critical finding and includes explicit privacy sign-off for ready status. *(Evidence provider: EH-154 gate owner; privacy approver.)*

## Out of scope or not manually testable yet

- This checklist does not replace EH-151, EH-152, or EH-153 acceptance checks; it consumes their evidence at the final boundary.
- The checklist is planned; no row is evidence of an executed test until the implementation and reviewed deployment configuration exist.
