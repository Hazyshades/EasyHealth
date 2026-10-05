# EH-154 Privacy Sign-Off Record

**Gate status:** `blocked`
**Reviewed build / commit:** _pending_
**Reviewed deployment configuration reference or digest:** _pending_
**Evidence package owner:** _pending_
**Privacy approver:** _pending_
**Decision date:** _pending_

This record is intentionally incomplete until the reviewed build, deployed trusted ingress, durable document-deletion handoff, worker evidence, and privacy approval are available. The checkout now contains the EH-151, EH-152, and EH-153 code paths plus partial local adapter evidence. Never place a bearer token, PIN, proof cookie, secret value, raw IP, full user agent, or report content in this record.

## Required release package

- [ ] `threat-model.md` reviewed against current EH-151/EH-152/EH-153 scope.
- [ ] `release-controls.md` reviewed and frozen for the deployment under review.
- [ ] Final share scope matrix identifies report scope, raw-document child scope, and allowed export formats.
- [ ] Access-event field list and retention decision are approved.
- [ ] Token storage proof shows keyed digests only and no plaintext response persistence.
- [ ] PIN/proof storage proof shows salted verifier material and keyed share-bound proof digests only.
- [ ] Secret-manager references or approved fingerprints recorded for `SHARE_RATE_LIMIT_PEPPER`, `SHARE_PIN_PROOF_PEPPER`, and `SHARE_TRUSTED_PROXY_ATTESTATION_KEY`. Values are never recorded.

| Secret name                           | Reference or approved fingerprint |
| ------------------------------------- | --------------------------------- |
| `SHARE_RATE_LIMIT_PEPPER`             | `_pending_`                       |
| `SHARE_PIN_PROOF_PEPPER`              | `_pending_`                       |
| `SHARE_TRUSTED_PROXY_ATTESTATION_KEY` | `_pending_`                       |

| Required artifact / setting                                                       | Reviewed value or evidence reference |
| --------------------------------------------------------------------------------- | ------------------------------------ |
| Final share scope matrix                                                          | `_pending_`                          |
| Access-event field list and retention decision                                    | `_pending_`                          |
| Token storage proof                                                               | `_pending_`                          |
| PIN/proof storage proof                                                           | `_pending_`                          |
| `SHARE_TRUSTED_PROXY_CIDRS`                                                       | `_pending_`                          |
| `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`                                 | `_pending_`                          |
| `SHARE_RATE_LIMIT_WINDOW_SECONDS`                                                 | `_pending_`                          |
| `SHARE_RATE_LIMIT_TOKEN_FAILURES`                                                 | `_pending_`                          |
| `SHARE_RATE_LIMIT_REQUESTER_FAILURES`                                             | `_pending_`                          |
| `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS`                                            | `_pending_`                          |
| `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS`                                      | `_pending_`                          |
| `SHARE_PIN_PROOF_TTL_SECONDS`                                                     | `_pending_`                          |
| `SHARE_ACCESS_EVENT_RETENTION_DAYS`                                               | `_pending_`                          |
| Trusted-ingress artifact                                                          | `_pending_`                          |
| Shared Postgres rate-limit storage                                                | `_pending_`                          |
| Access-event, rate-limit-bucket, and expired-proof cleanup schedules              | `_pending_`                          |
| Durable document tombstone/report invalidation/final-purge handoff                | `_pending_`                          |
| Focused route, header, event, rate-limit, key-rotation, and raw-download evidence | `_pending_`                          |
| Incident runbook is reviewed                                                      | `_pending_`                          |

For a ready gate, artifact values use the verifier-resolved form
`evidence://<immutable-artifact-id>#<artifact-anchor>@sha256:<64-hex-digest>`.

The required privacy artifact anchors are stable and label-specific:
`Final share scope matrix` → `final-share-scope-matrix`, `Access-event field
list and retention decision` → `access-event-field-list-retention-decision`,
`Token storage proof` → `token-storage-proof`, `PIN/proof storage proof` →
`pin-proof-storage-proof`, `Trusted-ingress artifact` →
`trusted-ingress-artifact`, `Shared Postgres rate-limit storage` →
`shared-postgres-rate-limit-storage`, cleanup schedules →
`access-event-rate-limit-expired-proof-cleanup-schedules`, durable deletion →
`durable-document-tombstone-report-invalidation-final-purge-handoff`, focused
evidence → `focused-route-header-event-rate-limit-key-rotation-raw-download-evidence`,
and the incident runbook → `incident-runbook-reviewed`.
The evidence manifest binds each artifact to the reviewed build and immutable
deployment digest; settings may be concrete values within the documented
domain or the same resolved evidence reference.

- [ ] Deployed non-secret settings recorded:
  - `SHARE_TRUSTED_PROXY_CIDRS`
  - `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`
  - `SHARE_RATE_LIMIT_WINDOW_SECONDS`
  - `SHARE_RATE_LIMIT_TOKEN_FAILURES`
  - `SHARE_RATE_LIMIT_REQUESTER_FAILURES`
  - `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS`
  - `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS`
  - `SHARE_PIN_PROOF_TTL_SECONDS`
  - `SHARE_ACCESS_EVENT_RETENTION_DAYS`
- [ ] Trusted-ingress artifact is reviewed and deployed as the only public-to-app path.
- [ ] Shared Postgres rate-limit storage is available in every production instance; no process-local fallback is enabled.
- [ ] Access-event, rate-limit-bucket, and expired-proof cleanup schedules are deployed with bounded continuation, retry/backoff, advisory-lock release, and backlog alerts.
- [ ] Durable document tombstone/report invalidation/final-purge handoff is committed and tested.
- [ ] Focused route, header, event, rate-limit, key-rotation, and raw-download evidence is attached to `release-record.md`. _(Partial local adapter evidence: `local-adapter-scenarios.json`; reviewed route, database, deployment, and worker evidence remain pending.)_
- [ ] Incident runbook is reviewed by the privacy owner and operations owner.

## Deployment prerequisites

| Prerequisite                                           | Current state                                  | Evidence required before ready                                                     |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| EH-151 public verifier and all subroutes               | `PARTIAL`                                      | Production adapter paths exist; route harness and reviewed deployment artifact     |
| EH-152 owner management and revoke/replacement surface | `PARTIAL`                                      | Owner projection/API paths exist; owner RPC execution and revoke visibility        |
| EH-153 export adapters                                 | `PARTIAL`                                      | Owner export path and local capability checks exist; public-share runtime evidence |
| Durable deletion handoff                               | `BLOCKED` until committed handoff is available | Tombstone and owner-report-delete evidence                                         |
| Shared rate-limit store                                | `PENDING`                                      | Production RPC health and outage behavior                                          |
| Secret manager key references                          | `PENDING`                                      | Reference/version or approved fingerprint, never value                             |
| Retention worker and alerts                            | `PENDING`                                      | Deployed schedule, cleanup batches, lock and backlog evidence                      |

## Sign-off decision

| Role                         | Decision  | Name / reference       | Date      |
| ---------------------------- | --------- | ---------------------- | --------- |
| EH-151 public-boundary owner | `PENDING` | _pending_              | _pending_ |
| EH-152 management owner      | `PENDING` | _pending_              | _pending_ |
| EH-153 export owner          | `PENDING` | _pending_              | _pending_ |
| Security / QA gate owner     | `BLOCKED` | EH-154 initial package | _pending_ |
| Privacy owner                | `PENDING` | _pending_              | _pending_ |

A privacy sign-off is valid only when the gate is `ready` or `ready-with-risk`, the reviewed build is identified, all high/critical findings are resolved, and every remaining low/medium risk has an owner and expiry.
