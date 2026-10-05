# EH-154 Share-Link Incident Runbook

**Purpose:** Contain public share-link incidents without creating a second authorization path or copying bearer secrets into incident systems.

## Rules for every incident

- Do not paste or attach a bearer token, PIN, proof cookie, secret value, full URL, raw IP, full user agent, report content, or storage path to a ticket, chat, log, or screenshot.
- Identify a share with its server-side share record ID or an approved incident reference. If only a link is available, use the approved secure intake channel and do not repeat the plaintext link in the incident record.
- Use minimized access events and server-side records as evidence. Preserve timestamps in UTC and identify the reviewed deployment build.
- Treat uncertainty as unauthorized access until the privacy owner closes the incident.

## Suspected token leakage

1. Open the secure incident channel and record only the incident ID, report/share record reference, discovery time, reporter, and reviewed build.
2. Revoke the affected share immediately through the owner management control plane. Do not investigate by opening or replaying the bearer link in a normal browser.
3. Identify the authorized report scope, child-document scope, allowed export formats, expiry, and replacement history from the share record. Do not copy report contents into the incident.
4. Preserve the minimized access-event rows and relevant aggregate rate-limit signals. Confirm that event fields contain no token, PIN, proof, URL, PHI, IP, or full user agent.
5. Notify the privacy owner, security owner, and functional owner. Record whether the incident may affect a report, export, raw document, or only an invalidated link.
6. If compromise may be systemic, disable new share creation and tighten the configured rate limits before further investigation.
7. Reissue a replacement link only after the privacy owner approves the scope and recipient. A replacement response may expose plaintext only to the owner once; never put it in the incident record.
8. Create a remediation item for the owning EH-151, EH-152, or EH-153 change. EH-154 remains blocked for any unresolved high or critical finding.

## Unauthorized access or cross-profile suspicion

1. Revoke the affected share and preserve minimized events before changing unrelated state.
2. Confirm the server-side owner, report, exact materialized scope, child-document scope, export policy, expiry, and revoke timestamps.
3. Compare the request result and resource kind with the expected public route contract. Do not infer authorization from a browser screenshot alone.
4. Verify that subsequent page, API, export, and raw-document requests fail closed and return no bytes after revoke.
5. Escalate immediately to the privacy owner if any unrelated profile, source row, storage path, or raw document was returned.
6. Preserve route, header, event, and deployment evidence without secret-bearing values. Open a high or critical finding and keep the release gate blocked until the owner supplies remediation and rerun evidence.

## Rate-limit abuse or limiter outage

1. Record the alert time, reviewed deployment build, affected public listener, aggregate dimension, and observed count. Do not record raw token or requester identifiers.
2. If abuse is active, disable share creation and apply the approved stricter limit through configuration.
3. Verify that the shared Postgres limiter is reachable from every production instance and that the service-only RPC returns the expected generic `429` on exhaustion.
4. If the limiter store or required configuration is unavailable, verify the generic `503` fail-closed response. A process-local fallback is not permitted.
5. Preserve bounded cleanup, retry, advisory-lock, and backlog-alert evidence. Escalate any unbounded backlog or lock contention that does not release.
6. Reopen share creation only after the security owner and privacy owner approve the evidence.

## Emergency revoke

1. Use the owner-scoped revoke control or the approved service operation. Do not edit share tables directly.
2. Record the share record reference, operator, UTC time, reason class, and result. Do not record the bearer token.
3. Recheck the same public verifier with synthetic requests after the transition. Page, API, export, and raw-document reads must fail before bytes.
4. Check that owner management reflects the revoked state and that no cache delay keeps the share usable.
5. If the share was replaced, verify that the predecessor is revoked and the successor has the intended scope and policy.

## Planned or emergency key rotation

1. Provision and health-check a new secret-manager key version. Record only the reference/version or approved fingerprint.
2. Mark the new version active for new `v<version>.<random>` tokens.
3. Retain the previous version only for the approved bounded window. Record the start, end, owner, and reviewed deployment reference.
4. Verify new, previous, malformed, and unknown selectors using synthetic shares. Confirm generic failures and no secret-bearing telemetry.
5. Reissue or revoke old links through the owning management path. Never treat deletion of the active key as rotation.
6. Retire the previous key after the window and verify that old links fail. Attach the result to the EH-154 release record.

## Evidence preservation and privacy escalation

- Preserve minimized access events, aggregate limiter signals, deployment configuration references, command output, response headers, and scenario results.
- Preserve database and worker cleanup evidence only through approved redacted exports. Do not dump share rows or request bodies into the incident package.
- The privacy owner decides whether notification, data-subject assessment, legal review, or regulator escalation is required.
- The security owner assigns severity. Any unresolved high or critical finding keeps the release gate `blocked`.
- Close the incident only after containment, scope assessment, remediation ownership, rerun evidence, and privacy disposition are recorded.
