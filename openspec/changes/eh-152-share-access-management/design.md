# Design: eh-152-share-access-management

## Context

EH-151 provides share creation and public verification but intentionally leaves owner lifecycle management out of the public route. Owners need a profile-scoped control plane that shows status and limited access metadata and can revoke a link immediately.

## Goals / Non-Goals

**Goals:**

- Give an authenticated owner a list of that profile's share links grouped by active, expired, and revoked state.
- Revoke a link through an owner-authorized mutation and reflect the result immediately.
- Provide copy-link feedback without retaining or logging plaintext token material.
- Show an access history that is useful for incident review without storing raw IP, full user agent, PIN, token, or health content.

**Non-Goals:**

- Public token verification, token generation, PIN hashing, or share database schema; EH-151 owns them.
- Device fingerprinting, behavioral profiling, or an unrestricted audit log.
- Reconstructing access history for links created before the new event schema.

## Decisions

### 1. Use owner-scoped management endpoints

Add `GET /api/share-management` and `POST /api/share-management/[id]/revoke` (names are implementation details fixed before coding). Both resolve the session profile, filter by `profile_id`, return no-store JSON, and use 404 for an ID outside the profile. The revoke mutation sets `revoked_at` in the same transaction used for the response; the public verifier reads that field on every request.

The list DTO contains share ID, resource label, created/expiry timestamps, status, download policy, allowed export formats, last access timestamp, and aggregate outcomes. It never contains token digests, PIN fields, document storage paths, or another profile's report metadata.

### 2. Record minimized access events

EH-151 emits events through a repository seam. The event fields are share ID, event time, result (`allowed`, `denied`, `expired`, `revoked`, `rate_limited`), resource kind, and a coarse client class only when the platform supplies it without retaining a full user agent. Raw IP and full user agent are not persisted. Retention is short and documented in EH-154's release gate.

A failed event does not echo the supplied token, PIN, report title, or source text. Event writes are best-effort only after the authorization decision; an event failure must not turn a denied request into an allowed request or leak an error oracle.

### 3. Make copy and rotation status explicit

The management list never returns a link or token. The EH-151 creation response is held only in component state, can be copied once, and is cleared when the page is left. For an existing active share, the UI offers **Create replacement link**, not copy-from-list. `POST /api/share-management/[id]/rotate` authenticates the owner, atomically revokes the old token, asks the EH-151 token repository to mint a replacement with the same scope, expiry, and export policy, and returns the new plaintext link once. The UI can copy that response and then clears it. Analytics receives a boolean outcome and share ID, never the URL or token.

### 4. Keep UI state server-derived

The management page refetches after revoke and displays status from the server. It does not infer expiry from a client clock for authorization. Optimistic styling is allowed only as a pending state and must be replaced by the server result.

## Risks / Trade-offs

- A minimized log is less useful for forensic correlation. The release gate documents the retained fields and incident escalation path; sensitive identifiers are not traded for convenience.
- Revoke visibility depends on public reads reaching the same database. No cache may sit in front of the verifier.
- Clipboard permissions can fail in insecure contexts. The UI gives a manual select/copy fallback without logging the value.
