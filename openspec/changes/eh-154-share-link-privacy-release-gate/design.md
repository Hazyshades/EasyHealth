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
2. Unauthenticated public request to token verifier.
3. Token verifier to Supabase/service-role data access.
4. Application response to browser cache, CDN, referrer, and indexing systems.
5. Application/access-log pipeline to operators and retention storage.
6. Export serializer to generated files and raw-document storage.

### Abuse cases and required controls

| Threat | Required control | Evidence owner |
|---|---|---|
| Token enumeration | At least 256 bits of random token entropy; keyed digest lookup; generic failure; rate limit | EH-151 + EH-154 |
| Plaintext token at rest or in logs | Store only HMAC digest; redact path/query/log/analytics values; one-time owner response | EH-151 |
| PIN brute force | Slow salted hash; bounded attempts; token/requester rate limit; generic error | EH-151 |
| Replay after expiry/revoke | Check `expires_at` and `revoked_at` on every read; no cache in front of verifier | EH-151 + EH-154 |
| Cross-profile report/document | Resolve owner scope server-side; verify report and child document ownership; no client-supplied profile ID | EH-151 |
| Scope expansion | Persist explicit report/document scope; reject unknown resource IDs; export consumes verified scope | EH-151 + EH-153 |
| Browser/CDN/search leakage | `Cache-Control: no-store, private`; `X-Robots-Tag: noindex, nofollow`; restrictive referrer policy; no third-party analytics | EH-151 |
| Access-log PHI/token exposure | Minimized event fields; no URL/token/PIN/source text; short retention | EH-152 + EH-154 |
| Raw storage bypass | Stream raw documents through an EH-151 verifier-backed proxy; recheck active share state, expiry, revocation, report scope, child document scope, archive state, and download policy on every request; never return a storage signed URL | EH-151 + EH-153 |
| Abuse/availability | Shared rate limiter for token and PIN failures; bounded export/report size; alert on spikes | EH-151 + EH-154 |
| Stale source after archive/delete | Preserve report snapshot only; deny raw source access; show limitation | EH-148 + EH-151 |

## Decisions

### 1. Release gate states are evidence-backed

The gate has `blocked`, `ready-with-risk`, and `ready` states. Any unresolved high or critical finding is `blocked`; `ready-with-risk` is allowed only for documented low/medium residual risk with owner and expiry. The release record names executed commands/scenarios and their result; a checklist row is never marked pass from code inspection alone.

### 2. Privacy sign-off is explicit

The release package must include the final share scope matrix, access-event fields/retention, token/PIN storage proof, cache/header evidence, rate-limit evidence, and an owner sign-off. If the production rate-limit store, Wiki/incident destination, or privacy approver is unavailable, the gate remains blocked or explicitly pending; it is not assumed green.

### 3. Incident runbook is fail-closed

For suspected token leakage: revoke the share, identify affected scope from the share record, preserve minimized events, notify the privacy owner, and create a remediation record. Do not print or paste the token into the incident channel. For active abuse, disable creation and tighten rate limits before investigating.

For planned or emergency key rotation: provision and health-check a new secret-store key version; mark it active for new `v<version>.<random>` tokens; retain the previous version only for the approved bounded window; verify lookup for new, previous, malformed, and unknown selectors; reissue or revoke old links without exposing plaintext; record the window and owner; then retire the previous key and confirm old links fail. EH-154 records this evidence and never treats deletion of the active key as rotation.

## Verification plan

EH-154 owns a focused verification harness that exercises public routes with synthetic profiles and documents: invalid token, wrong PIN, expired token, revoked token, cross-profile report ID, out-of-scope document, allowed report export, denied raw download, repeated failures, and current/previous/unknown token-key selectors. It also inspects response headers and captured logs for token/PIN/source leakage. The harness must run against the same adapter used by production routes; mocks may cover unavailable external stores only when the production contract is separately evidenced.

## Risks / Trade-offs

- Bearer links remain copyable by design. Expiry, PIN, revoke, no-store, and minimized logs reduce but do not remove that risk.
- Strong logging minimization reduces forensic detail. The runbook and retention decision must be approved before release.
- A shared rate limiter and secret management are deployment prerequisites. Local development fallbacks must not be enabled in production.
- Threat-model coverage can drift as scope or formats change. EH-154 is rerun whenever EH-151, EH-152, or EH-153 changes the public boundary.
