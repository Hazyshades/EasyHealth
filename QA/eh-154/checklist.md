# EH-154: Share-Link Privacy Release Gate

**Roadmap status:** In progress
**Build / environment:** `7d907e3`, co-hosted staging on Contabo VM `217.216.86.38`, existing SmartFood Caddy, private EasyHealth origin, official self-hosted Supabase Docker stack, private worker
**Test run date:** 2026-10-07
**Tester:** Local automated and browser smoke

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

**Result:** `PARTIAL — 2026-10-08 live synthetic VM matrix; formal gate remains blocked`
**Notes / evidence link:** The live matrix covers valid, malformed, expired, revoked, PIN-required, omitted-export, unselected-document, cross-profile-document, revoked-document, and deleted-source report/document paths. Valid report/JSON/PDF/document responses were 200; denied paths were generic 404 (PIN-required was generic 401) with `no-store, private`, and no fixture token/PIN appeared in response bodies. The formal reviewed-build/manifest binding and privacy/operations approval remain pending.

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
- [ ] Harness executes invalid/expired/revoked/PIN/cross-profile/scope/export/download scenarios against production adapters, with trusted-ingress enforcement before token lookup/limiter/body/bytes on page, API, PIN, EH-153 export, and raw-document handlers. _(Live synthetic VM coverage exercises the deployed page/API/PIN-required/export/raw-document success and denial paths; formal reviewed-build manifest binding, limiter-order coverage, and full archived-source cases remain unproven.)_
- [x] Captured logs/events contain no bearer token, PIN, source text, PHI, raw IP, full user agent, or storage path in the retained post-rotation window. _(Pre-rotation Caddy JSON logs were truncated before enabling `max-size=10m,max-file=3`; the post-rotation request scan returned zero share-material, authorization/PIN, or storage hits. Privacy approval remains pending.)_
- [ ] Deployed rate-limit evidence proves `deployment/trusted-ingress.yaml` is the reviewed unauthenticated public HTTPS listener plus private/mTLS ingress-to-application leg with a private-only app origin and direct-origin rejection; `trusted-ingress-transport.ts` supplies verified immediate peer metadata to EH-151's Postgres-backed `rate-limit.ts` adapter; the adapter uses configured `SHARE_TRUSTED_PROXY_CIDRS`, signed `X-EH-Edge-*` attestation, and `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`; rejects missing/malformed/expired trusted source and spoofed forwarding/edge headers; uses configured `SHARE_RATE_LIMIT_PEPPER` and attestation key without recording either value (approved secret-manager references/versions or fingerprints only); uses recorded …
- [x] Access-event retention evidence proves the deployed `SHARE_ACCESS_EVENT_RETENTION_DAYS=30` value, cleanup cadence/continuation, advisory-lock contention and release, bounded repeated-batch drain, and retry settings. _(501 expired rows per table produced a lock skip, 500-row bounded batch leaving one row, and one-row drain; worker zero-restart/error state and settings are recorded in `release-record.md`. Formal alert/manifest binding and privacy approval remain pending.)_
- [x] Developer harness captures the shared response policy before page/API/export/raw-document headers/body: no-store/private and body-token checks passed for the live matrix; twenty reverse-order concurrent last-access RPCs returned zero errors and preserved the greatest timestamp. _(Third-party-network capture and formal reviewed-build binding remain pending.)_
- [x] Operational developer evidence is recorded separately from the interface result: retention lock/backlog drain, durable-deletion finalization, reverse-order last-access concurrency, Caddy log rotation/redaction, owner-control smoke, and non-secret deployment fingerprints are documented in `release-record.md` and `privacy-signoff.md`. These are developer/runtime assertions, not manual UI acceptance.
- [x] Incident runbook covers token leakage, unauthorized access, rate-limit abuse, emergency revoke, evidence preservation, and privacy escalation. _(Evidence: `openspec/changes/eh-154-share-link-privacy-release-gate/evidence/incident-runbook.md`; privacy approval remains pending.)_
- [x] Gate status is blocked for any unresolved high/critical finding and includes explicit privacy sign-off for ready status. _(Evidence: `scripts/verify-eh154-share-privacy.ts` and `evidence/release-gate.json`; the current gate is blocked.)_
- [x] Reviewed production references are content-addressed through `evidence-manifest.json`, bound to the reviewed build/deployment identity, hash-verified as canonical JSON bytes, anchor-bound to each scenario/finding/privacy artifact, and backed by structured anchor payloads (`evidence.command`, `evidence.result`, and a verifier-resolved content-addressed `source`); `local-adapter-scenarios.json` is separately canonical and manifest-bound as the unanchored local-adapter artifact before ready status. _(The checked-in manifest has no reviewed artifacts, so the current gate remains blocked.)_

## Out of scope or not manually testable yet

- This checklist does not replace EH-151, EH-152, or EH-153 acceptance checks; it consumes their evidence at the final boundary. The co-hosted public HTTPS/mTLS route, live synthetic route/database matrix, retention contention/backlog drain, durable-deletion finalization, monotonic access, historical-log remediation, owner-control smoke, and deployment settings are now evidenced. The gate remains blocked only by immutable reviewed-build/manifest binding, residual focused evidence gaps, and privacy/operations approval.

## Sprint 7 local integration run: 2026-10-06

- **Environment:** Local Supabase, peer-aware Next at `http://localhost:3000`, and the local Docker sidecar at `http://localhost:8443`; synthetic owner/report/share data only.
- **Boundary result:** `PASS` for direct-origin fail-closed behavior. Direct valid, invalid, and spoofed-forwarded-header requests returned HTTP `503`, `no-store, private`, and `noindex, nofollow`; no report bytes were returned.
- **Ingress implementation smoke:** `PASS` for custom-server peer capture, sidecar header stripping and attestation forwarding, compose validation, and sidecar route compilation. The local compose path is HTTP-only and is not reviewed production HTTPS/mTLS evidence.
- **Export implementation smoke:** `PASS` for public export route compilation and public share UI wiring. The route is present at `src/app/api/share/[token]/export/route.ts`, and `pnpm test:eh153` plus `pnpm test:eh153-owner-export` pass.
- **Public export fixture:** `pnpm test:eh151` passed the trusted-ingress rejection, PIN failure, denied-format, scoped-capability, response-policy, and renderer-failure fixture cases. This is code-level evidence only and does not replace reviewed route/database execution.
- **Adapter result:** `pnpm test:eh154-adapters` reported 20 passed and 17 blocked by required persisted reviewed-share fixtures, concurrent database, retention-worker, deletion-handoff, or public-export evidence.
- **Gate result:** `pnpm test:eh154` remains **BLOCKED** with incomplete findings. The co-hosted HTTPS/mTLS deployment smoke passed, but route/database execution, retention-worker evidence, durable-deletion handoff, and privacy sign-off are still missing.

## Co-hosted trusted-ingress deployment smoke: 2026-10-07

- **Public HTTPS and routing:** `PASS`. `https://easyhealth.217-216-86-38.sslip.io/share/not-a-real-token` returned HTTP 200. Existing Caddy obtained the public certificate and routed the request to the private ingress sidecar.
- **Private mTLS hops:** `PASS`. Caddy used client mTLS plus PROXY protocol v2 to `easyhealth-ingress:8443`; the sidecar used a separate client certificate to `easyhealth-next:3443`.
- **Direct-origin boundary:** `PASS`. A direct request to the private origin without signed edge metadata returned HTTP 503 with `{"error":"Share service unavailable"}` and no report bytes.
- **Origin exposure:** `PASS`. EasyHealth containers published no host ports; host listeners remained limited to the existing public 80/443 Caddy sockets for this route.
- **SmartFood regression:** `PASS`. `smartfood-api` and `smartfood-postgres` remained healthy, and `https://api.217-216-86-38.sslip.io/v1/cities` returned its normal catalogue response after Caddy recreation.
- **Historical limitation at the time of this smoke:** Valid/expired/revoked/PIN/export/raw-document recipient scenarios and worker retention were blocked by missing VM fixtures. The self-hosted Supabase evidence below supersedes the fixture-availability limitation; gate approval and remaining privacy evidence are still open.

## Self-hosted Supabase recipient and worker evidence: 2026-10-07

- **Supabase isolation:** `PASS`. The official stack runs under `/opt/easyhealth/supabase-upstream/docker`; gateway, database, and pooler have no host-published ports, and Caddy is the only public Supabase listener.
- **Valid public path:** `PASS` for exercised scope. The browser rendered the synthetic structured report; JSON and PDF exports returned HTTP 200; the explicitly scoped document returned HTTP 200 `application/pdf`; all responses were `no-store, private`.
- **PIN and unavailable states:** `PASS` for exercised fixtures. Wrong PIN `1111` produced a generic retry state, correct PIN `2468` opened the report, and expired/revoked/malformed links rendered the same generic unavailable state with HTTP 404 APIs.
- **Worker cleanup:** `PASS` for first-cycle execution. Synthetic expired access-event, rate-limit, and PIN-proof rows were deleted by the worker cleanup cycle; `easyhealth-worker` remained `running` with zero restarts. Current deployment inspection reports retention 30 days, access cleanup hourly, access retry 60 seconds, rate-limit cleanup every 15 minutes, and zero recent cleanup errors.
- **Gate remains blocked:** The live matrix closes the earlier fixture-availability gap for the exercised public paths. Historical pre-fix Caddy logs retain synthetic share-material hits; retention contention/retry/backlog, complete deletion-operation finalization/manifest proof, monotonic last-access concurrency, and privacy approval remain open.

## Live VM privacy and operations evidence: 2026-10-08

- **Owner/Auth:** Synthetic owner and other-profile Auth users were created; owner onboarding/consent completed through the QA-only route; owner share management rendered correctly; Revoke, Create replacement link, and Copy link were exercised; the temporary route/container were removed before final verification.
- **Cross-profile/source lifecycle:** Other-profile share/report/document fixtures were persisted. A service-only document-deletion request queued a durable operation; direct lifecycle mutation was rejected; the public report and document paths became generic 404 before bytes were returned.
- **Public denial matrix:** Valid report/JSON/PDF/document paths returned 200. Malformed, expired, revoked, omitted CSV, unselected, cross-profile, revoked-document, and deleted-source paths returned generic 404 with `no-store, private`; PIN-required report returned generic 401. No exercised body contained fixture token/PIN material.
- **Retention/deletion/concurrency:** Lock contention skipped cleanup safely; 500-row bounded batches drained one-row backlogs; the deletion worker completed with `stable_empty_count=2`, no retry/error, and zero report/document rows; twenty concurrent last-access writes preserved the greatest timestamp.
- **Ingress/redaction:** Production EasyHealth ingress is recipient-only, private-origin, mTLS/PROXY v2, and has no Caddy access-log block. Pre-rotation logs were truncated, `json-file` rotation is `10m × 3`, and the post-rotation log scan returned zero share-material, authorization/PIN, or storage hits.
- **Privacy gate:** Keep EH-154 blocked until the reviewed commit is immutable, canonical evidence-manifest bindings are attached, focused residual evidence is complete, and privacy/operations sign-off is recorded.
