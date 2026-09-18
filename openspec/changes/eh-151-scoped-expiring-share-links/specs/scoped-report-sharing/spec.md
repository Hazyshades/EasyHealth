# scoped-report-sharing

## ADDED Requirements

### Requirement: Owner creates an expiring scoped share

An authenticated owner SHALL be able to create a share only for a validated EH-148 report whose immutable validation envelope has status `valid` or `limited` and a recognized validation version, with an expiry, optional PIN, explicit `download_policy`, an `allowed_export_formats` subset of `pdf`, `csv`, and `json`, and optional document IDs used only as the raw-document-download allow-list. The report's complete immutable evidence scope remains available to report rendering/export. The server SHALL select a configured token-key version, persist that version with the keyed token digest, and verify that the report and every selected document belong to the owner and are in the report scope. An empty format list SHALL deny file exports.

#### Scenario: Report-only share is created

- **WHEN** an owner creates a validated report share with `download_policy` `report` and `allowed_export_formats` `["pdf", "json"]`
- **THEN** the response returns a one-time plaintext link
- **AND** the persisted share stores only a token digest and the explicit format allow-list
- **AND** PDF and JSON exports are allowed while CSV and raw document downloads are denied

#### Scenario: Out-of-scope document is rejected

- **WHEN** a create request includes a document not in the report's materialized source scope
- **THEN** the server returns a generic validation error
- **AND** no share is created

#### Scenario: Deleted report removes share capability

- **WHEN** an owner deletes a report that has a share, child document rows, replacement operations, and access events
- **THEN** the dependent rows are removed by the declared cascade and a later public request returns the generic share failure
- **AND** no active capability or orphaned child state remains

### Requirement: Public token verification

The public share route SHALL verify token digest, expiry, revocation, optional PIN, report ownership, report validation status, requested resource scope, and EH-148's read-time source availability resolver on every request. A report read may preserve a historical snapshot only when a cited source row is archived/removed while its parent document remains active, with a visible `SOURCE_UNAVAILABLE` limitation; a source document in `deleting`/tombstoned state SHALL invalidate the complete report before public content is read and return a generic unavailable failure. Raw-document requests for archived/removed sources or tombstoned documents SHALL fail with a generic denial. Raw-document requests SHALL use a verifier-backed proxy/stream route and SHALL NOT return storage signed URLs. Invalid, expired, revoked, or missing shares SHALL fail with the same non-enumerating response without exposing live/raw source data.

#### Scenario: Valid token opens the scoped report

- **WHEN** a recipient presents a valid unexpired token and satisfies any PIN requirement
- **THEN** the route returns only the selected validated report resources
- **AND** the response is `no-store` and non-indexable

#### Scenario: Revoked or expired token fails safely

- **WHEN** a recipient presents a revoked or expired token
- **THEN** the route returns the generic failure response
- **AND** it does not reveal whether revocation or expiry caused the failure

#### Scenario: Raw download is rechecked after revocation

- **WHEN** a recipient requests an explicitly allowed raw document, the owner revokes or expires the share, and the recipient requests that document again
- **THEN** the verifier denies the subsequent raw-document request
- **AND** the recipient never receives a storage signed URL that could bypass the verifier

#### Scenario: Published report reflects source deletion safely
- **WHEN** a recipient opens a validated share after a cited source row is archived/removed while its parent document remains active
- **THEN** the public report preserves the historical snapshot and displays `SOURCE_UNAVAILABLE`
- **AND** the recipient cannot obtain the archived/removed raw source or an unqualified supported claim

#### Scenario: Tombstoned source invalidates the public report

- **WHEN** a source document enters `deleting`/tombstoned state after a report share was created
- **THEN** the public route returns generic unavailable before reading report content or issuing export bytes
- **AND** no snapshot or raw source from the invalidated report is exposed

### Requirement: Production rate-limit boundary

The public route SHALL call the service-only `public.consume_report_share_rate_limit` RPC over the shared Supabase Postgres store for failed token/PIN outcomes before returning a public response. The RPC SHALL atomically maintain fixed-window counters in `share_rate_limit_buckets` with a unique conflict key `(key_digest, window_started_at)`, keyed by `HMAC-SHA-256(SHARE_RATE_LIMIT_PEPPER, dimension + ":" + normalized_key)`: one token-digest dimension and one server-derived requester dimension consisting of an IPv4 `/24` or IPv6 `/64` prefix plus the fixed coarse user-agent class `browser`, `automation`, or `other` (`unknown` for missing values). Raw token, IP, and user-agent values SHALL NOT be persisted or logged. `SHARE_RATE_LIMIT_WINDOW_SECONDS` SHALL default to `60` and accept `10..300`; `SHARE_RATE_LIMIT_TOKEN_FAILURES` SHALL default to `10` and accept `1..100`; `SHARE_RATE_LIMIT_REQUESTER_FAILURES` SHALL default to `30` and accept `1..300`; `SHARE_RATE_LIMIT_PEPPER` is required. A missing pepper or invalid setting SHALL fail closed. The bounded cleanup RPC SHALL delete at most 500 expired rows per batch and 20 batches per invocation, return `deleted_count`, `remaining_expired_count`, and `exhausted`, and run from the worker `tick()` loop at `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS` (default `900_000`) with continuation at `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS` (default `60_000`) while rows remain, bounded retries, and backlog/failure signals. EH-154 SHALL record the deployed non-secret settings and cleanup evidence without recording the pepper value.
The requester address SHALL come only from `requestContext.edgeVerifiedClientAddress`, populated by deployment ingress from connection metadata after stripping client-supplied forwarding headers and accepted only when the immediate peer matches required `SHARE_TRUSTED_PROXY_CIDRS`. `X-Forwarded-For`, `Forwarded`, and `X-Real-IP` values received by the app SHALL NOT be trusted. The adapter SHALL strictly parse one canonical IPv4/IPv6 address, reject multiple or malformed values, and return the same generic non-enumerating `503` when the trusted address or required proxy configuration is absent. EH-154 evidence SHALL include a harness case proving spoofed untrusted forwarding headers cannot change the requester bucket.
The EH-151-owned `src/lib/share-links/trusted-ingress.ts` adapter SHALL be invoked by both `/share/[token]` and `/api/share/[token]` before token lookup or limiter calls. The deployment ingress SHALL use a private/mTLS hop, strip client-supplied forwarding and `X-EH-Edge-*` headers, and write `X-EH-Edge-Client-Address`, `X-EH-Edge-Request-Id`, `X-EH-Edge-Timestamp`, and `X-EH-Edge-Signature = HMAC-SHA-256(SHARE_TRUSTED_PROXY_ATTESTATION_KEY, request_id + "." + timestamp + "." + client_address)`. The request ID SHALL be a canonical UUID, the timestamp SHALL be ASCII decimal Unix seconds in UTC, the client address SHALL be the strict canonical single IPv4/IPv6 text accepted by the adapter, and the signature SHALL be base64url without padding over the UTF-8 framing bytes. The adapter SHALL verify the signature and `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS` (default `30`, range `5..120`) using ingress peer connection metadata and `SHARE_TRUSTED_PROXY_CIDRS`; missing/malformed/expired metadata or attestation SHALL return generic non-enumerating `503` and expose no requester dimension. The attestation key and raw assertion SHALL never be persisted, logged, or emitted as evidence, and only the verified canonical client address SHALL reach the HMAC requester dimension.

#### Scenario: Token and PIN failures exhaust fixed windows

- **WHEN** repeated failures use a known token or an incorrect PIN
- **THEN** token-digest failures increment the token and requester dimensions, PIN failures increment both dimensions, and the configured limits apply atomically within the fixed window
- **AND** an exhausted window returns a generic `429` with no token/PIN cause or raw identifier

#### Scenario: Unknown token uses only requester protection

- **WHEN** a malformed or unknown token is presented
- **THEN** only the requester dimension is incremented because no share-scoped token digest exists
- **AND** no share-scoped row or token-derived telemetry is created

#### Scenario: Limiter store or configuration fails

- **WHEN** the limiter RPC times out/fails or the required pepper/setting validation fails
- **THEN** the route returns a generic non-enumerating `503`
- **AND** no local/process fallback permits the request

#### Scenario: Expired limiter buckets are removed

- **WHEN** the worker runs the bounded rate-limit cleanup RPC
- **THEN** expired bucket rows are removed without exposing or logging raw token/requester identifiers

### Requirement: Atomic replacement idempotency

The service-only `public.replace_report_share` RPC SHALL accept the authenticated owner/profile, predecessor share ID, a bounded opaque owner/share-scoped `idempotency_key`, a server-minted keyed token digest, and token-key version. It SHALL lock the predecessor, reserve `share_replacement_operations` with unique `(profile_id, predecessor_share_id, idempotency_key)`, enforce one committed successor per predecessor, copy immutable report/raw-document scope, expiry, and export policy, revoke the predecessor, and commit the operation atomically. Operation rows SHALL contain no plaintext token/PIN. A replay with the same key SHALL return only recorded operation/successor metadata and no plaintext link; a different key after predecessor revocation SHALL return a generic conflict. Any failure SHALL roll back and leave the predecessor active.

#### Scenario: Replacement commits exactly once

- **WHEN** an owner replaces an active share with a new idempotency key
- **THEN** one successor copies the predecessor's immutable scope and policy while the predecessor is revoked in the same transaction
- **AND** only the initial successful response carries the one-time plaintext link

#### Scenario: Replacement replay does not mint another link

- **WHEN** the same owner retries the same predecessor and idempotency key
- **THEN** the RPC returns the recorded operation/successor metadata
- **AND** it creates no second successor and returns no plaintext token

#### Scenario: Competing replacement fails safely

- **WHEN** two different idempotency keys race or a predecessor is already revoked
- **THEN** exactly one successor commits and the losing request returns a generic conflict
- **AND** a failed reservation leaves no uncommitted successor or exposed link

### Requirement: Public response privacy

Public share responses and approved shared-export responses SHALL NOT expose bearer tokens, PIN fields, profile IDs, storage paths, unrelated documents, or third-party analytics data. The public page/API and EH-153 export route SHALL apply EH-151's `applyPublicShareResponsePolicy` helper, setting private no-store caching, noindex/nofollow, and a restrictive referrer policy before returning content or PDF/CSV/JSON bytes.

#### Scenario: Public response headers are inspected

- **WHEN** a valid recipient loads a shared report or approved export
- **THEN** the response includes `Cache-Control: no-store, private`
- **AND** includes `X-Robots-Tag: noindex, nofollow`
- **AND** does not include a raw storage path

### Requirement: Durable minimized access events

After a token selects a share and the route makes a public authorization decision, EH-151 SHALL write a minimized event to the durable `report_share_access_events` store with non-null share ID, event time, result, resource kind, coarse client class, and `retention_expires_at = occurred_at + deployed retention days`. The store SHALL omit bearer-token plaintext, PIN material, report contents, raw IP addresses, full user-agent strings, and URLs. Malformed or unknown tokens SHALL create no share-scoped row; their aggregate rate-limit telemetry SHALL contain no token, PIN, or share identifier. EH-151 SHALL own hourly retention cleanup; event-write failure SHALL NOT change the authorization result or disclose sensitive input.

#### Scenario: Access history has a retention-safe source

- **WHEN** a recipient makes an allowed, denied, expired, revoked, or rate-limited request after a share has been selected
- **THEN** the owner access-history view can read the corresponding minimized event while its retention has not expired
- **AND** no raw token, PIN, report content, or raw network identifier is persisted

#### Scenario: Unknown token has no share-scoped event

- **WHEN** a recipient presents a malformed or unknown token
- **THEN** the route returns the same generic failure as other invalid shares
- **AND** no owner-visible event row or telemetry field identifies the token, PIN, or share
