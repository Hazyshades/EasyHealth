# Proposal: eh-152-share-access-management

Domain: **reports / auth-shell**

## Why

Once share links exist, owners need a bounded way to see which links are active, distinguish expired and revoked links, copy a link without exposing its token in logs, and revoke access immediately. Without this surface, the owner cannot manage or audit delegated access.

## What Changes

- Add an authenticated share-management surface showing active, expired, and revoked links.
- Show only approved metadata: resource scope label, creation time, expiry, status, last access time, and privacy-minimized access result.
- Add immediate revoke with confirmation and a visible status update after the server confirms the change.
- Add one-time copy-link feedback for creation or replacement-link responses; existing rows expose replacement, never a stored plaintext token.
- Add owner-scoped management endpoints with no-store responses and no cross-profile enumeration.
- Keep raw IP address, full user agent, PIN material, and bearer-token plaintext out of the UI and stored audit data.

## Capabilities

### New Capabilities

- `share-access-management`: Owner-only lifecycle and access-history management for scoped report shares.

### Modified Capabilities

_None._

## Impact

EH-152 consumes the EH-151 share-management API and does not edit public token verification or share persistence. It owns the authenticated management UI and its focused integration coverage. EH-151 defines and owns access-event fields and retention configuration; EH-154 reviews the deployed value, privacy evidence, and cleanup behavior at the release gate. EH-152 consumes the owner-scoped read projection.
