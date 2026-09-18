# Tasks: eh-151-scoped-expiring-share-links

Domain: **reports / auth-shell**

## 1. Share persistence and token boundary

- [ ] 1.1 Add the share-link and explicit document-scope migration with profile ownership, expiry, revocation, download policy, and minimized event fields.
- [ ] 1.2 Implement cryptographically random token generation and keyed digest lookup with a configured pepper and key version; do not add a plaintext or unkeyed fallback.
- [ ] 1.3 Implement optional salted slow PIN hashing and a shared rate-limit seam for token/PIN failures.
- [ ] 1.4 Restrict creation to validated EH-148 reports and verify every selected document against report scope and owner profile.

## 2. Public capability routes

- [ ] 2.1 Add the owner creation endpoint that returns the plaintext link once and omits token/PIN material from persistence, logs, and telemetry.
- [ ] 2.2 Add the public page/API boundary with generic invalid/expired/revoked/PIN failures and no session-profile fallback.
- [ ] 2.3 Enforce report validation, expiry, revocation, exact resource scope, and download policy on every public read.
- [ ] 2.4 Set no-store/private cache, noindex/nofollow, restrictive referrer policy, and no third-party analytics on public responses.
- [ ] 2.5 Deny archived/deleted raw source downloads while retaining only the authorized report snapshot and limitation.

## 3. Verification and handoff

- [ ] 3.1 Add focused route fixtures for scope, profile isolation, token failures, PIN retries, expiry, revoke, cache headers, and raw-download denial.
- [ ] 3.2 Expose the owner management repository seam required by EH-152 without moving management UI into the public route.
- [ ] 3.3 Run the EH-151 QA checklist and provide evidence inputs to the EH-154 release gate.
