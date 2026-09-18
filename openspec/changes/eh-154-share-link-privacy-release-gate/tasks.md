# Tasks: eh-154-share-link-privacy-release-gate

Domain: **reports / auth-shell**

## 1. Threat model and policy

- [ ] 1.1 Record assets, actors, trust boundaries, abuse cases, controls, evidence owners, and residual risks for the token, PIN, public route, management UI, and export boundary.
- [ ] 1.2 Freeze the minimum token, PIN, scope, expiry/revoke, cache/index, rate-limit, logging, raw-download, and retention controls required for release.
- [ ] 1.3 Define the privacy sign-off record and deployment prerequisites, including shared rate-limit storage and secret/key management.

## 2. Verification harness

- [ ] 2.1 Add synthetic two-profile route scenarios for invalid, expired, revoked, PIN-failed, cross-profile, out-of-scope, allowed report, and denied raw-document requests.
- [ ] 2.2 Inspect cache/index/referrer headers and captured application events for token, PIN, source text, PHI, and storage-path leakage.
- [ ] 2.3 Verify rate-limit behavior, revoke visibility, export policy, and no-store behavior against the production adapters rather than a parallel implementation.
- [ ] 2.4 Assign severity to findings and make unresolved high/critical findings block the gate.

## 3. Incident and release evidence

- [ ] 3.1 Write the token-leakage, unauthorized-access, rate-limit-abuse, emergency-revoke, and privacy-escalation runbook without recording bearer tokens.
- [ ] 3.2 Record executed commands, scenario results, deployment configuration, retention decision, and privacy sign-off.
- [ ] 3.3 Run the EH-154 QA checklist and mark the gate ready only when evidence is complete for the reviewed build.
