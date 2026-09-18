# Design: eh-154-share-link-privacy-release-gate

## Context

EH-151 creates an unauthenticated capability, EH-152 exposes owner management, and EH-153 may expose downloadable copies. The release boundary is therefore the token route plus every management/export adapter, not one page. This design records the threat model before implementation so security controls are acceptance criteria rather than follow-up work.

## Goals / Non-Goals

**Goals:**

- Identify assets, actors, trust boundaries, abuse cases, controls, evidence, and residual risk.
- Define a fail-closed release gate with no unresolved high or critical findings.
- Prove profile isolation, exact scope, expiry/revocation, cache/index isolation, rate limiting, and metadata minimization.
- Provide an incident runbook for token leakage, unexpected access, and emergency revoke.

**Non-Goals:**

- Reimplementing token verification or management UI.
- Declaring a secure result without executed evidence.
- Eliminating the inherent risk that a recipient can copy a bearer link or downloaded file.

## Threat model

### Assets

- Validated report claims, source snapshots, biomarker values, reference ranges, and limitations.
- Raw document bytes available only through the verifier-backed proxy when explicitly allowed; public shares never issue storage signed URLs.
- Share bearer tokens, optional PIN verifiers, expiry/revocation state, and access events.
- Owner/profile identity and the minimum metadata needed to manage a share.

### Actors

- **Owner:** authenticated profile allowed to create, list, and revoke only its own shares.
- **Recipient:** unauthenticated holder of a valid token, possibly without a PIN.
- **Attacker:** guesses tokens, replays a leaked token, brute-forces a PIN, alters resource IDs, probes errors, or attempts cross-profile access.
- **Infrastructure operator:** can inspect application/database logs and cache configuration but is not a report recipient.
- **Compromised browser/CDN/log sink:** can retain URLs, referrers, headers, or downloaded copies.

### Trust boundaries

1. Authenticated owner browser to owner API.
2. Public HTTPS share-recipient listener to the versioned private/mTLS trusted-ingress leg (`eh-151-scoped-expiring-share-links/deployment/trusted-ingress.yaml`); the browser does not present a client certificate, the private app origin is not reachable directly, and only the private leg can establish non-forgeable peer metadata plus a signed assertion.
3. Unauthenticated public request to token verifier.
4. Token verifier to Supabase/service-role data access.
5. Application response to browser cache, CDN, referrer, and indexing systems.
6. Application/access-log pipeline to operators and retention storage.
7. Export serializer to generated files and raw-document storage.

### Abuse cases and required controls

| Threat | Required control | Evidence owner |
|---|---|---|
| Token enumeration | At least 256 bits of random token entropy; keyed digest lookup; generic failure; rate limit | EH-151 + EH-154 |
| Plaintext token at rest or in logs | Store only HMAC digest; redact path/query/log/analytics values; one-time owner response | EH-151 |
| PIN brute force | Slow salted hash; bounded attempts; token/requester rate limit; generic error | EH-151 |
| PIN proof theft or cross-share replay | Body-only PIN submission; keyed random proof digest bound to the exact share; protected `__Host-eh-share-pin` cookie; expiry/revoke checks before every page/API/export/raw-document read; clear invalid proof; never log proof/cookie/request body | EH-151 + EH-154 |
| Replay after expiry/revoke | Check `expires_at` and `revoked_at` on every read; no cache in front of verifier | EH-151 + EH-154 |
| Cross-profile report/document | Resolve owner scope server-side; verify report and child document ownership; no client-supplied profile ID | EH-151 |
| Scope expansion | Persist explicit report/document scope; reject unknown resource IDs; export consumes verified scope | EH-151 + EH-153 |
| Browser/CDN/search leakage | `Cache-Control: no-store, private`; `X-Robots-Tag: noindex, nofollow`; restrictive referrer policy; no third-party analytics | EH-151 |
| Access-log PHI/token exposure | Minimized event fields; no URL/token/PIN/proof/cookie/source text; short retention | EH-152 + EH-154 |
| Raw storage bypass | Stream raw documents through an EH-151 verifier-backed proxy; recheck active share state, expiry, revocation, report scope, child document scope, archive state, and download policy on every request; never return a storage signed URL | EH-151 + EH-153 |
| Abuse/availability | Versioned EH-151 private/mTLS trusted-ingress artifact plus `src/lib/share-links/trusted-ingress-transport.ts` and `rate-limit.ts` over the service-only Postgres `public.consume_report_share_rate_limit` RPC; reject direct origin/missing peer context, use atomic fixed-window HMAC-keyed counters (`10/60s` token digest, `30/60s` coarse requester), generic `429` exhaustion, generic `503` store/proxy-failure denial, no local fallback; alert on spikes | EH-151 + EH-154 |
| Stale source after archive/remove | Preserve report snapshot only while the parent document remains active; deny live/raw source access and show limitation | EH-148 + EH-151 + EH-153 |
| Tombstoned source report | Invalidate the complete report before owner/share/export reads or bytes; mark for whole-report purge | EH-148 + EH-151 + EH-153 |

## Decisions

### 1. Release gate states are evidence-backed

The gate has `blocked`, `ready-with-risk`, and `ready` states. Any unresolved high or critical finding is `blocked`; missing committed `make-document-deletion-durable` tombstone/report-delete handoff or missing reviewed `deployment/trusted-ingress.yaml` artifact is also `blocked`. `ready-with-risk` is allowed only for documented low/medium residual risk with owner and expiry. The release record names executed commands/scenarios and their result; a checklist row is never marked pass from code inspection alone.

### 2. Privacy sign-off is explicit

The release package must include the final share scope matrix, access-event fields/retention, token/PIN/proof storage proof, evidence that `SHARE_RATE_LIMIT_PEPPER`, `SHARE_PIN_PROOF_PEPPER`, and `SHARE_TRUSTED_PROXY_ATTESTATION_KEY` are present in the approved secret manager identified only by reference/version or approved fingerprint (never by value), the deployed non-secret ingress/rate-limit/proof settings (`SHARE_TRUSTED_PROXY_CIDRS`, `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`, `SHARE_RATE_LIMIT_WINDOW_SECONDS`, `SHARE_RATE_LIMIT_TOKEN_FAILURES`, `SHARE_RATE_LIMIT_REQUESTER_FAILURES`, `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS`, `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS`, and `SHARE_PIN_PROOF_TTL_SECONDS`), bounded cleanup/backlog/failure signals, cache/header evidence, and an owner sign-off. If the production rate-li…

### 3. Incident runbook is fail-closed

For suspected token leakage: revoke the share, identify affected scope from the share record, preserve minimized events, notify the privacy owner, and create a remediation record. Do not print or paste the token into the incident channel. For active abuse, disable creation and tighten rate limits before investigating.

For planned or emergency key rotation: provision and health-check a new secret-store key version; mark it active for new `v<version>.<random>` tokens; retain the previous version only for the approved bounded window; verify lookup for new, previous, malformed, and unknown selectors; reissue or revoke old links without exposing plaintext; record the window and owner; then retire the previous key and confirm old links fail. EH-154 records this evidence and never treats deletion of the active key as rotation.

## Verification plan

EH-154 owns a focused verification harness that exercises the same production adapters and versioned `deployment/trusted-ingress.yaml` contract used by public routes with synthetic profiles and documents: browser reachability at the unauthenticated public HTTPS listener, private-ingress forwarding, private-origin/direct-origin rejection, valid/missing/malformed/expired trusted peer metadata and attestation, invalid token, wrong PIN, expired token, revoked token, cross-profile report ID, out-of-scope document, allowed report export, denied raw download, repeated token/PIN failures through both HMAC-keyed dimensions, spoofed `X-Forwarded-For`/`Forwarded`/`X-Real-IP`/`X-EH-Edge-*` headers that cannot change the requester bucket, unavailable rate-limit store, current/previous/unknown token-key selectors, and generic `429`/`503` behavior. It also inspects response headers and captured logs for token/PIN/source/attestation-key leakage. The harness must run against the same `trusted-ingress-transport.ts` adapter and deployed settings used by both public routes; no header-only mock may be marked as production trust evidence.

The verification harness also proves that correct body-only PIN submission establishes only the protected proof cookie, missing/wrong/expired/revoked/cross-share proofs fail generically before any page/API/export/raw-document bytes, invalid cookies are cleared, and PIN/proof/cookie/request-body values are absent from URLs, referrers, logs, telemetry, access events, and response fields.

## Risks / Trade-offs

- Bearer links remain copyable by design. Expiry, PIN, revoke, no-store, and minimized logs reduce but do not remove that risk.
- Strong logging minimization reduces forensic detail. The runbook and retention decision must be approved before release.
- A shared rate limiter and secret management are deployment prerequisites. Local development fallbacks must not be enabled in production.
- Threat-model coverage can drift as scope or formats change. EH-154 is rerun whenever EH-151, EH-152, or EH-153 changes the public boundary.
