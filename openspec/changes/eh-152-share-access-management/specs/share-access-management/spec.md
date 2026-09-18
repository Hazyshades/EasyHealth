# share-access-management

## ADDED Requirements

### Requirement: Owner share list

The authenticated owner SHALL see only that profile's share links with active, expired, and revoked status, scope label, creation time, expiry, last access time, `download_policy`, allowed export formats, and approved aggregate access outcomes. `last access time` SHALL be EH-151's monotonic timestamp from the latest successful report/API/export/raw-document authorization; PIN establishment and denied, expired, revoked, or rate-limited requests SHALL NOT change it, and EH-152 SHALL NOT write it.

#### Scenario: Owner views mixed share statuses

- **WHEN** an owner opens share management with active, expired, and revoked links
- **THEN** the page distinguishes all three states
- **AND** no link or report belonging to another profile appears
- **AND** token digests, PIN fields, storage paths, raw IPs, and full user agents are absent

#### Scenario: Last access is server-derived and monotonic

- **WHEN** an owner views a share after successful reads and failed/PIN-only attempts, including concurrent successful requests that complete out of order
- **THEN** the list shows the greatest EH-151-recorded successful access timestamp
- **AND** the management surface does not derive, overwrite, or accept a client-provided timestamp

### Requirement: Immediate revoke

The owner SHALL be able to revoke an active share through an authenticated mutation. Revocation SHALL be visible in the management response and SHALL cause the public verifier to deny the link on its next request.

#### Scenario: Owner revokes a link

- **WHEN** the owner confirms revoke for an active share
- **THEN** the server records revocation before returning success
- **AND** the page shows the revoked status
- **AND** a subsequent public request fails with the generic share error

### Requirement: Minimized access history

The management view SHALL read EH-151's durable `report_share_access_events` projection and show approved access event time, result, resource kind, and retention-safe client class while retention has not expired. EH-152 SHALL NOT create a second event store. It SHALL NOT display or persist bearer-token plaintext, PIN material, report contents, raw IP addresses, or full user-agent strings.

#### Scenario: Owner reviews a denied attempt

- **WHEN** a share has a denied or rate-limited access event
- **THEN** the owner sees the event type and time
- **AND** the UI does not reveal the submitted token, PIN, source text, or raw network identifier

### Requirement: Copy and replacement-link feedback

The management UI SHALL provide copy feedback only for a plaintext link returned by EH-151 creation or EH-152 replacement. Existing share-list rows SHALL NOT expose or reconstruct a stored token; a replacement action SHALL call EH-151's service-only `public.replace_report_share` RPC with a server-minted digest and key version. The RPC SHALL lock the predecessor, reserve the unique operation row, copy its immutable scope/expiry/export policy, create exactly one successor, and revoke the predecessor together. The operation SHALL require scoped idempotency, roll back on mint/RPC failure, and return a conflict for a competing request after the predecessor is revoked. Neither link may be sent to analytics or server logs.

#### Scenario: Clipboard operation fails

- **WHEN** the browser denies clipboard access for a creation or replacement response
- **THEN** the UI gives a manual selection fallback or clear failure state
- **AND** no token is sent to telemetry

#### Scenario: Existing link requires replacement

- **WHEN** an owner requests a copy action for an existing active share
- **THEN** the UI offers replacement-link creation instead of reading a token from the list
- **AND** the transaction returns one new plaintext link only after the predecessor is revoked atomically

#### Scenario: Replacement mint fails or races

- **WHEN** minting the successor fails or two different replacement requests race
- **THEN** the failed operation leaves the predecessor active, or the losing race returns a conflict after exactly one successor commits
- **AND** no second plaintext link or uncommitted successor is exposed
