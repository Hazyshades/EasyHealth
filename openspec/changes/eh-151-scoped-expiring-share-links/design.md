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

Add a migration for `report_share_links` and `report_share_documents`.

`report_share_links` stores `id`, `profile_id`, `report_id`, `token_digest`, optional `pin_hash` and `pin_salt`, `expires_at`, `revoked_at`, `download_policy`, `allowed_export_formats`, `created_at`, and `last_accessed_at`. `report_share_documents` stores the explicit document IDs allowed for raw-document access. A share always has a report target; document rows are optional and never imply additional reports.

`download_policy` is `none` (view only), `report` (validated report plus only the formats in `allowed_export_formats`), or `documents` (the same report access plus explicitly scoped raw documents). `allowed_export_formats` accepts only `pdf`, `csv`, or `json` and defaults to an empty array; raw-document permission never implies a report export format. No row stores a plaintext token, PIN, storage path, or unrestricted profile ID in a public response.

### 2. Use a high-entropy one-time-displayed token

Generate at least 32 random bytes with the platform cryptographic RNG and encode them as base64url. Return the plaintext token only in the owner creation response. Store `HMAC-SHA-256(SHARE_TOKEN_PEPPER, token)` with a unique index. If the pepper is unavailable, creation fails closed; no unkeyed fallback is allowed.

The public route computes the same digest and performs one lookup. Invalid, expired, revoked, and missing records return the same generic not-found response and do not disclose which condition occurred. Raw tokens are redacted from request/access logs and telemetry.

### 3. Verify every public request at the capability boundary

Use `/share/[token]` for the page and `/api/share/[token]` for data. The route checks token digest, expiry, revocation, PIN state, report validation status, report scope, and requested resource ID on every request. It never calls `getSessionProfileId` as a substitute for token verification. Responses use `Cache-Control: no-store, private`, `X-Robots-Tag: noindex, nofollow`, and a restrictive referrer policy.

Optional PIN verification uses a slow password hash with a per-share salt. Failed attempts are rate-limited per token digest and a coarse requester bucket. Error text and status do not reveal whether the token, PIN, or resource was wrong.

### 4. Share snapshots, not authorization shortcuts

A validated report snapshot may be rendered from `reports.content`, but the share still checks that the report belongs to the share's profile and is not deleted. Raw document access requires a child scope row and a fresh owner authorization check. Archived/deleted source documents cannot be downloaded through an existing link; the report shows a limitation instead.

### 5. Keep management behind a separate seam

EH-151 exposes owner creation and public read primitives. EH-152 owns management list/revoke endpoints and UI. Both use the same share repository but no public route is allowed to call owner management operations.

## Risks / Trade-offs

- A bearer token can be copied by a recipient. Entropy, expiry, optional PIN, no-store responses, and immediate revoke reduce exposure but cannot make a bearer link non-shareable.
- HMAC pepper rotation invalidates all existing tokens unless a key-version migration exists. Store a key version and document rotation as an incident procedure before release.
- A public page can leak through browser history or screenshots. No-store headers, noindex, restrictive referrer policy, and explicit owner copy warn against forwarding; the remaining risk is accepted for link sharing.
- Public rate limiting needs a shared store in multi-instance deployment. A process-local limiter is not an acceptable production control.
