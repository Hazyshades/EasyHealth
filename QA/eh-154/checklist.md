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

### EH154-UI-02: Inspect privacy headers

**Precondition:** A valid public report and export response are available.

1. Inspect response headers in the browser network panel or approved harness.
2. Follow no links from the shared page and inspect referrer/indexing controls.

**Expected result:** Public responses are private/no-store, noindex/nofollow, and use a restrictive referrer policy. No third-party analytics request contains a share URL or token.

**Result:** `N/A`
**Notes / evidence link:** `Release-gate scenario; execute after public routes exist.`

## Developer evidence required

- [ ] Threat model lists assets, actors, trust boundaries, abuse cases, controls, residual risk, and evidence owners.
- [ ] Harness executes invalid/expired/revoked/PIN/cross-profile/scope/export/download scenarios against production adapters.
- [ ] Captured logs/events contain no bearer token, PIN, source text, PHI, raw IP, full user agent, or storage path.
- [ ] Current/previous/unknown/malformed token-key selector and bounded rotation-window evidence proves reissue/revoke behavior and safe retirement of the previous key.
- [ ] Incident runbook covers token leakage, unauthorized access, rate-limit abuse, emergency revoke, evidence preservation, and privacy escalation.
- [ ] Gate status is blocked for any unresolved high/critical finding and includes explicit privacy sign-off for ready status.

## Out of scope or not manually testable yet

- This checklist does not replace EH-151, EH-152, or EH-153 acceptance checks; it consumes their evidence at the final boundary.
- The checklist is planned; no row is evidence of an executed test until the implementation and reviewed deployment configuration exist.
