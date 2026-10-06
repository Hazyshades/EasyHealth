# EH-154: Share-Link Privacy Release Gate

**Roadmap status:** In progress
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

| ID                | Test document or setup                              | Purpose                 |
| ----------------- | --------------------------------------------------- | ----------------------- |
| `EH154-PROFILE-A` | Validated report and one explicitly scoped document | Allowed path            |
| `EH154-PROFILE-B` | Separate profile with its own report/document       | Cross-profile isolation |
| `EH154-EXPIRED`   | Expired share token                                 | Replay/expiry           |
| `EH154-REVOKED`   | Revoked share token                                 | Immediate revoke        |
| `EH154-RATE`      | Synthetic repeated invalid-token/PIN requests       | Abuse and rate limit    |

## Interface checks

### EH154-UI-01: Exercise the public failure matrix

**Precondition:** EH-151 public routes and EH-153 exports are deployed to the reviewed test environment.

1. Open invalid, expired, revoked, wrong-PIN, cross-profile, out-of-scope, archived/removed-source, and tombstoned-source URLs using `EH154-PROFILE-A`/`EH154-PROFILE-B`.
2. Open one valid report-only share whose cited source row is archived/removed while its parent document remains active.
3. Open one share whose cited source document is `deleting`/tombstoned.
4. Attempt a denied raw-document or export resource.

**Expected result:** Invalid, expired, revoked, PIN, cross-profile, and out-of-scope failures are generic and fail closed. The active-document archived/removed case preserves only the historical snapshot with `SOURCE_UNAVAILABLE` and denies live/raw access. The tombstoned-source case returns generic unavailable before report/export bytes. The valid share returns only its scope; the denied resource returns no data. Revocation is effective without a cache delay.

**Result:** `N/A`
**Notes / evidence link:** Live route/UI execution is still blocked because the reviewed deployment, database fixtures, and durable-deletion handoff are unavailable. The local adapter run is recorded in [`local-adapter-scenarios.json`](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/local-adapter-scenarios.json) and does not replace this interface check.

## Evidence package

- [Threat model](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/threat-model.md)
- [Frozen controls](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/release-controls.md)
- [Privacy sign-off record](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/privacy-signoff.md)
- [Release evidence record](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/release-record.md)
- [Machine-readable gate record](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/release-gate.json)
- [Evidence manifest](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/evidence-manifest.json)
- [Local adapter scenario run](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/local-adapter-scenarios.json)
- [Incident runbook](../../openspec/changes/eh-154-share-link-privacy-release-gate/evidence/incident-runbook.md)

## Developer evidence required

- [x] Threat model lists assets, actors, trust boundaries, abuse cases, controls, residual risk, and evidence owners. _(Evidence: `openspec/changes/eh-154-share-link-privacy-release-gate/evidence/threat-model.md`; execution evidence remains pending.)_
- [ ] Harness executes invalid/expired/revoked/PIN/cross-profile/scope/export/download scenarios against production adapters, with trusted-ingress enforcement before token lookup/limiter/body/bytes on page, API, PIN, EH-153 export, and raw-document handlers. _(Partial local adapter evidence: `local-adapter-scenarios.json`; live route and database execution remain blocked.)_
- [ ] Captured logs/events contain no bearer token, PIN, source text, PHI, raw IP, full user agent, or storage path. _(The local owner projection check passes, but captured production event/log evidence remains unavailable.)_
- [ ] Deployed rate-limit evidence proves `deployment/trusted-ingress.yaml` is the reviewed unauthenticated public HTTPS listener plus private/mTLS ingress-to-application leg with a private-only app origin and direct-origin rejection; `trusted-ingress-transport.ts` supplies verified immediate peer metadata to EH-151's Postgres-backed `rate-limit.ts` adapter; the adapter uses configured `SHARE_TRUSTED_PROXY_CIDRS`, signed `X-EH-Edge-*` attestation, and `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`; rejects missing/malformed/expired trusted source and spoofed forwarding/edge headers; uses configured `SHARE_RATE_LIMIT_PEPPER` and attestation key without recording either value (approved secret-manager references/versions or fingerprints only); uses recorded …
- [ ] Access-event retention evidence proves the reviewed `SHARE_ACCESS_EVENT_RETENTION_DAYS` value, UTC expiry calculation, `cleanup_report_share_access_events` worker cadence/continuation, advisory-lock contention and release, bounded repeated-batch drain, retry/backoff, and backlog-alert evidence. _(No deployed worker or database evidence is available.)_
- [ ] Developer harness captures the shared response policy before page/API/export/raw-document headers/body: no-store/private, noindex/nofollow, restrictive referrer policy, and absence of third-party analytics requests containing share URL/token. It also captures monotonic last-access evidence and confirms EH-152 does not write the timestamp. _(Local response-policy assertions pass; browser/network capture and monotonic last-access evidence remain blocked.)_
- [x] Incident runbook covers token leakage, unauthorized access, rate-limit abuse, emergency revoke, evidence preservation, and privacy escalation. _(Evidence: `openspec/changes/eh-154-share-link-privacy-release-gate/evidence/incident-runbook.md`; privacy approval remains pending.)_
- [x] Gate status is blocked for any unresolved high/critical finding and includes explicit privacy sign-off for ready status. _(Evidence: `scripts/verify-eh154-share-privacy.ts` and `evidence/release-gate.json`; the current gate is blocked.)_
- [x] Reviewed production references are content-addressed through `evidence-manifest.json`, bound to the reviewed build/deployment identity, hash-verified as canonical JSON bytes, anchor-bound to each scenario/finding/privacy artifact, and backed by concrete anchor `evidence`/`source` payload fields before ready status. _(The checked-in manifest has no reviewed artifacts, so the current gate remains blocked.)_

## Out of scope or not manually testable yet

- This checklist does not replace EH-151, EH-152, or EH-153 acceptance checks; it consumes their evidence at the final boundary.
- The EH-151, EH-152, and EH-153 code paths and local adapter harness are present. Reviewed deployment, route/database execution, retention-worker, deletion-handoff, and privacy-approval evidence remain unavailable; no live gate row is marked passed.
