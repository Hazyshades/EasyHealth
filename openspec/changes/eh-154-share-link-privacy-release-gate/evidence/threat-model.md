# EH-154 Share-Link Threat Model

**Record status:** Design reviewed; execution evidence pending
**Owner:** Security / QA release gate owner
**Privacy approver:** _pending_
**Review trigger:** Re-review whenever EH-151, EH-152, or EH-153 changes token verification, management metadata, export formats, download policy, retention, or the public ingress boundary.

This record is the operational evidence companion to `design.md`. It does not claim that a control is deployed. A row is complete only when the named evidence owner supplies a result from the production adapter or reviewed deployment configuration.

## Assets

| Asset                                                                                | Required protection                                                                                       | Evidence owner    |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------- |
| Validated report claims, source snapshots, biomarker values, ranges, and limitations | Exact report scope; no unrelated profile data; publishable validation envelope only                       | EH-148 / EH-151   |
| Raw document bytes                                                                   | Verifier-backed proxy only; explicit child-document scope; no storage signed URL                          | EH-151 / EH-153   |
| Share bearer token                                                                   | At least 32 random bytes; versioned keyed digest at rest; plaintext returned once to the owner            | EH-151            |
| PIN verifier and proof                                                               | Salted slow password hash; keyed random proof digest bound to one share; protected host cookie            | EH-151            |
| Expiry, revocation, and replacement state                                            | Checked before every public read; replacement and revoke are atomic                                       | EH-151 / EH-152   |
| Access events                                                                        | Share-scoped minimized fields with bounded retention; no token, PIN, URL, PHI, raw IP, or full user agent | EH-151 / EH-152   |
| Owner/profile identity and share metadata                                            | Owner-scoped management reads; no profile ID or token material in public responses                        | EH-152            |
| Generated export files                                                               | Exact report scope and allowed format policy; shared response headers before bytes                        | EH-153            |
| Ingress peer metadata and rate-limit state                                           | Non-forgeable trusted ingress context; shared Postgres limiter; no process-local production fallback      | Platform / EH-151 |

## Actors

| Actor                                           | Capability or risk                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner                                           | Authenticated profile may create, list, replace, and revoke only its own shares.                                                           |
| Recipient                                       | Unauthenticated holder of a valid bearer link, with or without a PIN.                                                                      |
| Attacker                                        | Guesses tokens, replays leaked links, brute-forces PINs, changes resource IDs, probes error differences, or attempts cross-profile access. |
| Infrastructure operator                         | Can inspect application, database, cache, ingress, and retention systems but is not a report recipient.                                    |
| Compromised browser, CDN, referrer, or log sink | May retain URLs, headers, response data, or downloaded copies.                                                                             |

## Trust boundaries

1. Authenticated owner browser to owner management API.
2. Public HTTPS recipient listener to the versioned private/mTLS trusted-ingress leg described by `openspec/changes/eh-151-scoped-expiring-share-links/deployment/trusted-ingress.yaml`.
3. Unauthenticated public request to the token verifier.
4. Token verifier to Supabase/service-role data access.
5. Public response to browser cache, CDN, referrer, indexing, and analytics systems.
6. Application/access-event pipeline to operators and retention storage.
7. Export serializer to generated files and raw-document storage.

The browser does not provide client mTLS. The private application origin must not be directly reachable. Only the trusted private leg may provide verified peer metadata and a signed edge assertion.

## Abuse cases, controls, and evidence

| Abuse case                              | Release control                                                                                                                                              | Evidence required                                     | Residual risk                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Token enumeration                       | Versioned token with at least 256 bits of random entropy, keyed digest lookup, one generic failure, token/requester limits                                   | Route harness plus storage inspection                 | A copied bearer token remains usable until expiry or revoke.                    |
| Plaintext token at rest or in telemetry | Store HMAC digest only; one-time owner response; redact path, query, logs, analytics, and errors                                                             | DB/schema inspection plus captured logs and telemetry | Operators may still see safe share IDs and aggregate outcomes.                  |
| PIN brute force                         | Salted slow hash, bounded attempts, token/requester limits, generic error                                                                                    | Repeated wrong-PIN route evidence                     | A recipient may share the PIN out of band.                                      |
| PIN proof theft or cross-share replay   | Body-only PIN submission, random keyed proof digest bound to exact share, `__Host-eh-share-pin`, expiry/revoke checks on every read, invalid-cookie clearing | Cookie attributes and cross-share proof matrix        | A valid proof can be used within its bounded TTL if not revoked first.          |
| Replay after expiry or revoke           | Check expiry and revoke state before every page, API, export, and raw-document read; no cache in front of verifier                                           | Before/after expiry and revoke evidence               | Bytes already delivered cannot be retracted.                                    |
| Cross-profile report or document access | Resolve owner scope server-side; verify report and child-document ownership; ignore client profile IDs                                                       | Two-profile route matrix                              | Error timing must remain generic enough to avoid useful enumeration.            |
| Scope expansion                         | Persist exact report and child-document scope; reject unknown resource IDs; export consumes verified scope                                                   | Scope mutation and export evidence                    | Future formats require another scope review.                                    |
| Browser, CDN, or search leakage         | `Cache-Control: no-store, private`; `X-Robots-Tag: noindex, nofollow`; restrictive referrer policy; no third-party analytics                                 | Header and request-capture evidence                   | Recipients can screenshot or download permitted content.                        |
| Access-log PHI or secret exposure       | Minimized event fields, no URL/token/PIN/proof/cookie/source text, bounded retention                                                                         | Captured application events and storage rows          | Strong minimization reduces forensic detail.                                    |
| Raw storage bypass                      | Stream through verifier-backed proxy; recheck share, scope, lifecycle, and policy per request; never return signed URL                                       | Raw route evidence and storage request capture        | A compromised storage operator remains outside this application gate.           |
| Rate-limit bypass or outage             | Trusted ingress context from immediate peer metadata; atomic Postgres RPC counters; generic `429` and `503`; no local fallback                               | Ingress and limiter harness, store outage evidence    | Shared limiter availability is a deployment prerequisite.                       |
| Stale source after archive/remove       | Preserve only the report snapshot and `SOURCE_UNAVAILABLE` limitation while parent document remains active; deny live/raw source                             | Archive/remove fixture evidence                       | Historical snapshot may still reveal data intentionally included in the report. |
| Tombstoned source report                | Durable deletion transition invalidates the complete report before owner/share/export reads or bytes                                                         | Tombstone handoff and public denial evidence          | Missing durable-deletion handoff blocks release.                                |

## Severity and release disposition

- **Critical:** active unauthorized disclosure, token/PIN/proof leakage, cross-profile access, raw-storage bypass, or a control that permits public bytes after revoke/expiry. Release is blocked.
- **High:** a mandatory control is absent or bypassable, including direct-origin access, local-only rate limiting, scope expansion, missing no-store policy, or unbounded retention. Release is blocked.
- **Medium:** documented residual risk with an owner, mitigation, and expiry. May permit `ready-with-risk` only after privacy approval.
- **Low:** documented residual risk with an owner and review date. May permit `ready-with-risk` only after privacy approval.

`ready` requires no unresolved findings. `ready-with-risk` is limited to reviewed low/medium residual risk. Missing EH-151/EH-152/EH-153 production evidence, the durable-deletion handoff, or the reviewed trusted-ingress deployment artifact is a blocking finding, not residual risk.

## Review evidence index

- Threat model: this file and `../design.md`.
- Frozen controls: `release-controls.md`.
- Deployment and privacy sign-off: `privacy-signoff.md`.
- Executed release record: `release-record.md`.
- Incident response: `incident-runbook.md`.
- Tester-facing checklist: `../../../../QA/eh-154/checklist.md`.
