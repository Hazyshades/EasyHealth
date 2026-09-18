# share-access-management

## ADDED Requirements

### Requirement: Owner share list

The authenticated owner SHALL see only that profile's share links with active, expired, and revoked status, scope label, creation time, expiry, last access time, download policy, and approved aggregate access outcomes.

#### Scenario: Owner views mixed share statuses

- **WHEN** an owner opens share management with active, expired, and revoked links
- **THEN** the page distinguishes all three states
- **AND** no link or report belonging to another profile appears
- **AND** token digests, PIN fields, storage paths, raw IPs, and full user agents are absent

### Requirement: Immediate revoke

The owner SHALL be able to revoke an active share through an authenticated mutation. Revocation SHALL be visible in the management response and SHALL cause the public verifier to deny the link on its next request.

#### Scenario: Owner revokes a link

- **WHEN** the owner confirms revoke for an active share
- **THEN** the server records revocation before returning success
- **AND** the page shows the revoked status
- **AND** a subsequent public request fails with the generic share error

### Requirement: Minimized access history

The management view SHALL show approved access event time, result, resource kind, and retention-safe client class when available. It SHALL NOT display or persist bearer-token plaintext, PIN material, report contents, raw IP addresses, or full user-agent strings.

#### Scenario: Owner reviews a denied attempt

- **WHEN** a share has a denied or rate-limited access event
- **THEN** the owner sees the event type and time
- **AND** the UI does not reveal the submitted token, PIN, source text, or raw network identifier

### Requirement: Copy feedback

The management UI SHALL provide copy-link and copy-status feedback without sending the plaintext link to analytics or server logs.

#### Scenario: Clipboard operation fails

- **WHEN** the browser denies clipboard access
- **THEN** the UI gives a manual selection fallback or clear failure state
- **AND** no token is sent to telemetry
