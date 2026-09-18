# Tasks: eh-152-share-access-management

Domain: **reports / auth-shell**

## 1. Reports — owner management API and audit projection

- [ ] 1.1 Add profile-scoped share list and revoke endpoints over the EH-151 repository seam with no-store responses.
- [ ] 1.2 Return active, expired, revoked, scope, download policy, timestamps, and approved aggregate access fields without tokens, PINs, raw IPs, full user agents, or storage paths.
- [ ] 1.3 Make revoke transactional and ensure the public verifier observes it on the next request.
- [ ] 1.4 Consume EH-151's owner-scoped event read contract and retention state before exposing access history; do not create a second event store.
- [ ] 1.5 Add an owner-authenticated replacement-link endpoint that revokes the old token before returning the EH-151-generated plaintext link once.

## 2. Auth-shell — owner interface

- [ ] 2.1 Add the authenticated share-management page with status grouping and empty/error states.
- [ ] 2.2 Add revoke confirmation, pending state, server-refreshed status, and failure recovery.
- [ ] 2.3 Add one-time copy-link feedback with manual fallback and no URL/token analytics.
- [ ] 2.4 Render access history using only approved event fields and explain minimized metadata to the owner.

## 3. Verification and handoff

- [ ] 3.1 Add synthetic owner/profile fixtures for mixed statuses, cross-profile IDs, revoke races, clipboard failure, and minimized events.
- [ ] 3.2 Verify management UI and API behavior with the EH-152 QA checklist.
- [ ] 3.3 Provide access-log/header evidence to EH-154 without changing public token verification.
