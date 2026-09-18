# Tasks: eh-151-scoped-expiring-share-links

Domain: **reports / auth-shell**

## 1. Reports — share persistence and scope

- [ ] 1.1 Add the share-link and explicit document-scope migration with profile ownership, expiry, revocation, `download_policy`, `allowed_export_formats`, and minimized event fields.
- [ ] 1.2 Restrict creation to validated EH-148 reports and verify every selected document against report scope and owner profile.

## 2. Auth-shell — token and public capability

- [ ] 2.1 Implement cryptographically random token generation and keyed digest lookup with `token_key_version`, a configured current/previous key ring, and no plaintext or unkeyed fallback.
- [ ] 2.2 Implement optional salted slow PIN hashing and a shared rate-limit seam for token/PIN failures.
- [ ] 2.3 Add the owner creation endpoint that returns the plaintext link once and omits token/PIN material from persistence, logs, and telemetry.
- [ ] 2.4 Add the public page/API boundary with generic invalid/expired/revoked/PIN failures and no session-profile fallback.
- [ ] 2.5 Enforce report validation, expiry, revocation, exact resource scope, `allowed_export_formats`, and download policy on every public read.
- [ ] 2.6 Set no-store/private cache, noindex/nofollow, restrictive referrer policy, and no third-party analytics on public responses.
- [ ] 2.7 Deny archived/deleted raw source downloads while retaining only the authorized report snapshot and limitation.

## 3. Verification and handoff

- [ ] 3.1 Add focused route fixtures for scope, profile isolation, token failures, PIN retries, expiry, revoke, cache headers, and raw-download denial.
- [ ] 3.2 Expose the owner management repository seam required by EH-152 without moving management UI into the public route.
- [ ] 3.3 Expose a named export-actions integration seam on the public share page for EH-153; EH-151 remains the page owner.
- [ ] 3.4 Run the EH-151 QA checklist and provide evidence inputs to the EH-154 release gate.
