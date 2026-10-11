# EH-154 Privacy Sign-Off Record

**Gate status:** `blocked`
**Reviewed build / commit:** `36b8c4e` — immutable commit exists; review and manifest binding remain pending
**Reviewed deployment configuration reference or digest:** `deployment://contabo-217-216-86-38/easyhealth-2026-10-08#sha256:3749df35ab63f053622c7e1e133d2e0669835ff66c7eef0bc2e6a6e30c63a511`
**Evidence package owner:** _pending_
**Privacy approver:** _pending_
**Decision date:** _pending_

This record remains blocked only where human approval or immutable reviewed-build identity is required. The 2026-10-08 VM handoff below records the non-secret deployment settings, approved-secret candidates as SHA-256 fingerprints, live retention/deletion/concurrency evidence, owner-control smoke, and post-rotation log inspection. Never place a bearer token, PIN, proof cookie, secret value, raw IP, full user agent, or report content in this record.

## Technical handoff for privacy review — 2026-10-08

- **Non-secret runtime settings:** the trusted-proxy CIDR is recorded in the reviewed settings table below; attestation max age is `30` seconds; rate-limit window is `60` seconds; token-failure threshold is `10`; requester-failure threshold is `30`; rate-limit cleanup is `900000` ms with `60000` ms retry; PIN proof TTL is `900` seconds; access-event retention is `30` days.
- **Deployment file fingerprints:** EasyHealth compose `sha256:1460b214bb86e6f5052143489397f0f34423ea3261fe5cd3b7f4a5145008f92e`; trusted-ingress sidecar `sha256:d375255f9b72b929a4b457527342a19ea9011f4827f9c320f562264b6fe812f9`; deletion worker `sha256:f16f7c2e6231c27eea75c287c61be53561038d7b22fea8f41d1ef2a6b2b445b8`; SmartFood compose `sha256:119d9e4824edac4fd93f80098cc6fdbae0c2f0d6b2671de5b0c4ad5166d96a00`; Caddyfile `sha256:fea8bb0381783f195ebe367b40a1ebed00bf781e585121ac1aee940ced31d625`.
- **Runtime settings:** the trusted-proxy CIDR is recorded in the reviewed settings table; attestation max age is `30` seconds; rate-limit window is `60` seconds; token-failure threshold is `10`; requester-failure threshold is `30`; rate-limit cleanup is `900000` ms with `60000` ms retry; PIN proof TTL is `900` seconds; access-event retention is `30` days.
- **Secret fingerprints, values withheld:** `SHARE_RATE_LIMIT_PEPPER=sha256:9ed4a6426961dde85cc668dfe7e9264c341957783325604c85c791d073a6f3c9`; `SHARE_PIN_PROOF_PEPPER=sha256:8c2e2706aac642008d4144d7473cfcf33a5b2095a233d3f5e6252b849a2930c5`; `SHARE_TRUSTED_PROXY_ATTESTATION_KEY=sha256:1115e32a7b7dbac9fdc8dcec09f78988e9d8c4fed35af3a99c85269a141ac70c`. Privacy/operations approval of these fingerprints remains pending.
- **Retention evidence:** advisory-lock contention skipped cleanup without deleting rows; each 500-row bounded batch left one expired row; one-row drain calls removed the remainder. The worker remained running with zero restarts and no cleanup error.
- **Deletion evidence:** the deployed worker completed the queued other-profile deletion with `retry_count=0`, `stable_empty_count=2`, `last_error_code=null`, and cleared both report and document rows. The worker fix verifies actual storage listings separately from known database paths before final purge.
- **Concurrency evidence:** twenty concurrent owner-share last-access RPC calls returned zero errors; the final timestamp equaled the greatest submitted timestamp.
- **Log evidence:** pre-rotation Caddy container logs were truncated, `json-file` rotation is now `max-size=10m,max-file=3`, and the post-rotation request window had zero share-material, authorization/PIN, or storage hits.
- **Owner controls:** authenticated synthetic owner smoke exercised status grouping, Revoke, Create replacement link, and Copy link. Copy feedback appeared and the plaintext link was absent from the final visible page. The temporary QA route/container were removed and Caddy validated afterward.


## Required release package

- [ ] `threat-model.md` reviewed against current EH-151/EH-152/EH-153 scope.
- [ ] `release-controls.md` reviewed and frozen for the deployment under review.
- [ ] Final share scope matrix identifies report scope, raw-document child scope, and allowed export formats.
- [ ] Access-event field list and retention decision are approved.
- [ ] Token storage proof shows keyed digests only and no plaintext response persistence.
- [ ] PIN/proof storage proof shows salted verifier material and keyed share-bound proof digests only.
- [ ] Secret-manager references or approved fingerprints recorded for `SHARE_RATE_LIMIT_PEPPER`, `SHARE_PIN_PROOF_PEPPER`, and `SHARE_TRUSTED_PROXY_ATTESTATION_KEY`. Values are never recorded. Fingerprints are captured below; privacy/operations approval remains pending.

Secret-manager URI references must include an explicit version selector such as
`secret://production/share-rate-limit#version=2026-10-01`; an approved
SHA-256 fingerprint is the only alternative. Mutable unversioned URIs are not
valid release evidence.

| Secret name                           | Reference or approved fingerprint |
| ------------------------------------- | --------------------------------- |
| `SHARE_RATE_LIMIT_PEPPER`             | `_pending_` |
| `SHARE_PIN_PROOF_PEPPER`              | `_pending_` |
| `SHARE_TRUSTED_PROXY_ATTESTATION_KEY` | `_pending_` |

| Required artifact / setting                                                       | Reviewed value or evidence reference |
| --------------------------------------------------------------------------------- | ------------------------------------ |
| Final share scope matrix                                                          | `_pending_ — privacy review`         |
| Access-event field list and retention decision                                    | `_pending_ — privacy review`         |
| Token storage proof                                                               | `_pending_ — privacy review`         |
| PIN/proof storage proof                                                           | `_pending_ — privacy review`         |
| `SHARE_TRUSTED_PROXY_CIDRS`                                                       | `172.30.0.0/24`                      |
| `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`                                 | `30`                                  |
| `SHARE_RATE_LIMIT_WINDOW_SECONDS`                                                 | `60`                                  |
| `SHARE_RATE_LIMIT_TOKEN_FAILURES`                                                 | `10`                                  |
| `SHARE_RATE_LIMIT_REQUESTER_FAILURES`                                             | `30`                                  |
| `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS`                                            | `900000`                              |
| `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS`                                      | `60000`                               |
| `SHARE_PIN_PROOF_TTL_SECONDS`                                                     | `900`                                 |
| `SHARE_ACCESS_EVENT_RETENTION_DAYS`                                               | `30`                                  |
| Trusted-ingress artifact                                                          | `deployment://contabo-217-216-86-38/easyhealth-2026-10-08#sha256:3749df35ab63f053622c7e1e133d2e0669835ff66c7eef0bc2e6a6e30c63a511` |
| Shared Postgres rate-limit storage                                                | `live VM service-RPC smoke; approval pending` |
| Access-event, rate-limit-bucket, and expired-proof cleanup schedules              | `live VM bounded-batch/lock/drain evidence; approval pending` |
| Durable document tombstone/report invalidation/final-purge handoff                | `live VM worker completion; immutable commit pending` |
| Focused route, header, event, rate-limit, key-rotation, and raw-download evidence | `release-record.md live VM handoff; manifest binding pending` |
| Incident runbook is reviewed                                                      | `_pending_ — privacy/operations review` |

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

- [x] Deployed non-secret settings recorded:
  - `SHARE_TRUSTED_PROXY_CIDRS`
  - `SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS`
  - `SHARE_RATE_LIMIT_WINDOW_SECONDS`
  - `SHARE_RATE_LIMIT_TOKEN_FAILURES`
  - `SHARE_RATE_LIMIT_REQUESTER_FAILURES`
  - `SHARE_RATE_LIMIT_CLEANUP_INTERVAL_MS`
  - `SHARE_RATE_LIMIT_CLEANUP_RETRY_INTERVAL_MS`
  - `SHARE_PIN_PROOF_TTL_SECONDS`
  - `SHARE_ACCESS_EVENT_RETENTION_DAYS`
- [x] Trusted-ingress artifact is deployed as the only public-to-app path; formal immutable manifest binding remains pending.
- [x] Shared Postgres rate-limit storage is available in the deployed VM; no process-local fallback is enabled.
- [x] Access-event, rate-limit-bucket, and expired-proof cleanup schedules are deployed with bounded continuation, retry/backoff, advisory-lock release, and backlog evidence; privacy approval remains pending.
- [x] Durable document tombstone/report invalidation/final-purge handoff is deployed and live-tested; immutable reviewed commit remains pending.
- [ ] Focused route, header, event, rate-limit, key-rotation, and raw-download evidence is attached to `release-record.md`. _(Live evidence is summarized; manifest binding and key-rotation approval remain pending.)_
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
