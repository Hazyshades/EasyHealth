# Design: eh-151-scoped-expiring-share-links

## Context

There is no share-link table or public token route. Existing report APIs resolve a signed-in profile and `noStoreJson` is used for sensitive JSON, but neither mechanism authenticates an unauthenticated recipient. A public link must become a narrow capability, not a second report API.

## Goals / Non-Goals

**Goals:**

- Create expiring, revocable links for validated reports with exact resource scope.
- Keep bearer tokens and optional PIN material out of persistent data and logs.
- Fail closed for invalid, expired, revoked, cross-profile, and out-of-scope requests.
- Make public responses uncacheable and non-indexable.

**Non-Goals:**

- Owner share listing/revoke UI or access-history presentation; EH-152 owns those surfaces.
- Anonymous account creation, comments, editing, or report generation.
- A wildcard "all profile data" share scope.

## Decisions

### 1. Model share scope explicitly

Add a migration for `report_share_links`, `report_share_documents`, and `share_replacement_operations`.

`report_share_links` stores `id`, `profile_id`, `report_id`, `token_digest`, `token_key_version`, optional `pin_hash` and `pin_salt`, `expires_at`, `revoked_at`, `download_policy`, `allowed_export_formats`, `created_at`, and `last_accessed_at`. `report_share_documents` stores the explicit document IDs allowed for raw-document access. `share_replacement_operations` stores only the predecessor share ID, owner-scoped idempotency key, successor share ID, outcome, and timestamps with a unique `(predecessor_share_id, idempotency_key)` constraint; it never stores token/PIN material. A share always has a report target; document rows are optional and never imply additional reports. The verified capability exposes the report's complete immutable `report_scope_document_ids` separately from the optional `raw_document_download_ids`; report rendering/export always uses the former, while raw-document authorization uses only the latter.

`download_policy` is `none` (view only), `report` (validated report plus only the formats in `allowed_export_formats`), or `documents` (the same report access plus explicitly scoped raw documents). `allowed_export_formats` accepts only `pdf`, `csv`, or `json` and defaults to an empty array; raw-document permission never implies a report export format. No row stores a plaintext token, PIN, storage path, or unrestricted profile ID in a public response.

`report_share_access_events` is the durable minimized event store. Its non-null `share_id` rows store `id`, `share_id`, `occurred_at`, `result`, `resource_kind`, `client_class`, and `retention_expires_at`; they never store raw IP, full user agent, URL/token, PIN, report title, or source text. EH-151 writes a share-scoped event only after the token selects a share and the route has made its decision, including PIN, resource, expiry, revocation, and rate-limit outcomes. Malformed or unknown tokens have no share row; their rate limiter emits only aggregate telemetry without a token, PIN, or share identifier and they do not appear in owner history. EH-151 owns event writes and retention cleanup; EH-152 consumes the read projection.

The authoritative retention setting is `SHARE_ACCESS_EVENT_RETENTION_DAYS`, default `30`, with an inclusive production range of `1..90`; EH-154 records the deployed value before release. `retention_expires_at` is `occurred_at + retention_days` in UTC. The EH-151 migration defines service-only `public.cleanup_report_share_access_events`, which acquires a PostgreSQL advisory lock, deletes at most 500 rows with `retention_expires_at <= now()`, and returns the deleted count. `worker/src/index.ts` invokes this RPC from the existing `tick()` loop when `SHARE_ACCESS_EVENT_CLEANUP_INTERVAL_MS` (default `3_600_000`) is due; `worker/src/env.ts` validates the setting. The advisory lock makes multiple workers safe. Cleanup failures use bounded retry/backoff and emit the structured `share_access_event_cleanup_failed` worker error to the deployment log/alert sink; missing cleanup evidence blocks the privacy gate.

### 2. Use a high-entropy one-time-displayed token

Generate a token as `v<token_key_version>.<random>` where `random` contains at least 32 bytes from the platform cryptographic RNG encoded as base64url. The version prefix is a non-secret selector, not part of the entropy. Return the plaintext token only in the owner creation response. Store `HMAC-SHA-256(key[token_key_version], random)` with a unique index. New links use the active key version; the verifier accepts only configured current/previous versions. If a key version is missing or the key ring is unavailable, verification and creation fail closed; no unkeyed fallback is allowed.

The public route parses the bounded version selector, computes one candidate digest with the corresponding configured key, and performs one indexed lookup; it then requires the matched row's `token_key_version` to equal the selector. Invalid, expired, revoked, malformed, and missing records return the same generic not-found response and do not disclose which condition occurred. Raw tokens are redacted from request/access logs and telemetry. Key rotation is an explicit EH-154 incident/release operation: mint with the new version, accept the old version only during the approved window, reissue or revoke old links, then retire the old key.

### 3. Verify every public request at the capability boundary

Use `/share/[token]` for the page and `/api/share/[token]` for data. The route checks token digest, expiry, revocation, PIN state, report validation status, report scope, and requested resource ID on every request. It never calls `getSessionProfileId` as a substitute for token verification. Responses use `Cache-Control: no-store, private`, `X-Robots-Tag: noindex, nofollow`, and a restrictive referrer policy.

Optional PIN verification uses a slow password hash with a per-share salt. Failed attempts are rate-limited per token digest and a coarse requester bucket. Error text and status do not reveal whether the token, PIN, or resource was wrong.

### 4. Share snapshots, not authorization shortcuts

A validated report snapshot may be rendered from `reports.content`, but the share still checks that the report belongs to the share's profile and is not deleted. Raw document access requires a child scope row and a fresh owner authorization check. Archived/deleted source documents cannot be downloaded through an existing link; the report shows a limitation instead.

A raw-document request uses a capability-checked proxy/stream route that revalidates the active share, expiry, revocation, report scope, child document allow-list, archive state, and download policy on every request before streaming bytes. It never returns a storage signed URL and never delegates authorization to the storage provider's independent URL lifetime. Revocation or expiry after a recipient has obtained a report or download response cannot retract bytes already received, but a subsequent raw-document request is denied.

### 5. Keep management behind a separate seam

EH-151 exposes owner creation and public read primitives plus the service-only `public.replace_report_share` writer. EH-152 owns management list/revoke/replacement endpoints and UI. Both use the same share repository, but no public route is allowed to call owner management operations.

## Risks / Trade-offs

- A bearer token can be copied by a recipient. Entropy, expiry, optional PIN, no-store responses, and immediate revoke reduce exposure but cannot make a bearer link non-shareable.
- HMAC pepper rotation invalidates all existing tokens unless a key-version migration exists. Store a key version and document rotation as an incident procedure before release.
- A public page can leak through browser history or screenshots. No-store headers, noindex, restrictive referrer policy, and explicit owner copy warn against forwarding; the remaining risk is accepted for link sharing.
- Public rate limiting needs a shared store in multi-instance deployment. A process-local limiter is not an acceptable production control.
