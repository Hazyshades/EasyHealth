# Tasks: eh-151-scoped-expiring-share-links

Domain: **reports / auth-shell**

## 1. Reports — share persistence and scope

- [ ] 1.1 Add the share-link, explicit document-scope, minimized access-event, rate-limit-bucket, and `share_replacement_operations` migrations with profile ownership, expiry, revocation, `download_policy`, `allowed_export_formats`, unique owner-scoped idempotency, expiry indexing, the `(key_digest, window_started_at)` rate-limit conflict key, and service-only RPCs for replacement, access-event cleanup, atomic rate-limit consumption, and bounded rate-limit-bucket cleanup.
- [ ] 1.2 Implement EH-151's durable event write and retention repository plus service-only `public.cleanup_report_share_access_events` RPC for resolved-share outcomes, configured `SHARE_ACCESS_EVENT_RETENTION_DAYS` (`1..90`, default `30`), UTC expiry calculation, `pg_try_advisory_xact_lock` contention handling, repeated 500-row batches up to 100 per invocation, immediate 60-second continuation on lock/batch backlog, bounded retries, and deployment-log alerting without raw network/token data.
- [ ] 1.3 Restrict creation to validated EH-148 reports and verify every selected document against report scope and owner profile.

## 2. Auth-shell — token and public capability

- [ ] 2.1 Implement token format `v<token_key_version>.<random>`, keyed digest lookup through the configured current/previous key ring, and no plaintext or unkeyed fallback.
- [ ] 2.2 Implement optional salted slow PIN hashing plus `src/lib/share-links/rate-limit.ts` over the shared Supabase Postgres adapter: HMAC-derived token/requester keys, atomic fixed-window limits `10/60s` and `30/60s`, explicit environment settings, generic `429` exhaustion, generic `503` store-failure denial, and no local fallback.
- [ ] 2.3 Add the owner creation endpoint that returns the plaintext link once, persists only keyed token digests and optional salted slow PIN verifier material, and omits plaintext token/PIN material from logs and telemetry.
- [ ] 2.4 Add the public page/API boundary with generic invalid/expired/revoked/PIN/rate-limit failures, no session-profile fallback, and no disclosure of limiter cause or raw identifiers.
- [ ] 2.5 Enforce the EH-148 read projection's `valid`/`limited` validation status and recognized version, expiry, revocation, exact report scope, `allowed_export_formats`, and download policy on every public read; consume `report-read.ts` so archived/deleted cited sources become `SOURCE_UNAVAILABLE` limitations without exposing live/raw source data; keep report scope distinct from raw-document child scope.
- [ ] 2.6 Implement EH-151's `applyPublicShareResponsePolicy` helper for no-store/private, noindex/nofollow, restrictive referrer policy, and no-third-party-analytics responses; require EH-153 public exports to call it.
- [ ] 2.7 Serve raw documents through a verifier-backed proxy/stream route that rechecks share state on every request and never returns storage signed URLs; deny archived/deleted sources.

## 3. Verification and handoff

- [ ] 3.1 Add focused route fixtures for scope, profile isolation, token failures, PIN retries, expiry, revoke, repeated token/PIN failures, unavailable rate-limit store, deleted-report cascade, archived/deleted cited-source read resolution, cache headers, raw-download denial, and revoke/expiry after a prior raw-download request.
- [ ] 3.2 Expose the owner management repository seam required by EH-152 without moving management UI into the public route.
- [ ] 3.3 Expose a named export-actions integration seam on the public share page for EH-153; EH-151 remains the page owner.
- [ ] 3.4 Run the EH-151 QA checklist, prove worker scheduling, xact-lock release, repeated-batch access-event and rate-limit-bucket backlog drain, `SHARE_ACCESS_EVENT_RETENTION_DAYS`, `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS`, `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS`, 500-row/20-batch cleanup caps, continuation signals, bounded retry/alert behavior, rate-limit threshold/window/store-failure behavior, and malformed/unknown-token event handling, and provide evidence inputs to the EH-154 release gate.
