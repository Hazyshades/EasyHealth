# EH-154 Release Evidence Record

**Gate status:** `blocked`
**Reviewed build / commit:** `PENDING`
**Reviewed deployment:** `PENDING`
**Evidence owner:** `PENDING`
**Privacy owner:** `PENDING`
**Last updated:** `PENDING`

This is the release record for a specific reviewed build. It must be replaced or completed with executed evidence before the milestone can be called ready. The current record is intentionally blocked because this checkout now contains the EH-151/EH-152/EH-153 code paths and a local adapter harness, but not the reviewed route, database, deployment, retention, or privacy-signoff evidence.

## Blocking findings

| ID          | Severity | Status | Finding                                                                                                                                 | Closure evidence |
| ----------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| EH154-F-001 | High     | `OPEN` | EH-151 public boundary code is present, but route and database execution evidence for this gate is not attached.                        | `pending`        |
| EH154-F-002 | High     | `OPEN` | EH-152 management and EH-153 owner export adapters are present; public-share export integration and runtime evidence remain incomplete. | `pending`        |
| EH154-F-003 | High     | `OPEN` | The trusted-ingress YAML exists only under the EH-151 OpenSpec change and is not a reviewed/deployed production configuration.          | `pending`        |
| EH154-F-004 | High     | `OPEN` | Durable-deletion handoff and retention-worker deployment evidence are not attached to this release record.                              | `pending`        |

No low or medium residual-risk decision can override these findings.

## Commands executed for this package

| Command                                                                                            | Result    | Evidence                                                                                                |
| -------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `openspec status --change "eh-154-share-link-privacy-release-gate" --json`                         | `PASS`    | Schema `spec-driven`; 5/11 implementation tasks complete before this apply pass.                        |
| `openspec instructions apply --change "eh-154-share-link-privacy-release-gate" --json`             | `PASS`    | Change is repo-local and ready to apply.                                                                |
| `pnpm test:eh151`                                                                                  | `PASS`    | EH-151 token, PIN, trusted-ingress, response-policy, and rate-limit adapter fixtures passed.            |
| `pnpm test:eh152`                                                                                  | `PASS`    | EH-152 owner projection and safe management boundary fixtures passed.                                   |
| `pnpm test:eh153`                                                                                  | `PASS`    | EH-153 report-export projection, capability, serialization, and policy fixtures passed.                 |
| `pnpm test:eh153-owner-export`                                                                     | `PASS`    | EH-153 owner route and report-detail export integration fixtures passed.                                |
| `pnpm test:eh151-db`                                                                               | `BLOCKED` | Local Supabase and Docker fallback were unavailable; the command timed out before pgTAP execution.      |
| `pnpm test:eh154-adapters`                                                                         | `PASS`    | 20 deterministic production-adapter assertions passed; 17 environment-bound scenarios remained blocked. |
| `pnpm test:eh154-adapters -- --write-evidence`                                                     | `PASS`    | Wrote `evidence/local-adapter-scenarios.json` without secret values.                                    |
| `pnpm test:eh154`                                                                                  | `BLOCKED` | Fail-closed gate reported route, database, deployment, retention, and privacy-signoff evidence gaps.    |
| `openspec validate eh-154-share-link-privacy-release-gate --type change --strict --no-interactive` | `PASS`    | Change artifacts validate under the installed CLI.                                                      |

## Required scenario results

Every row must link to an executed result for the reviewed build. `BLOCKED` is not a passing result.
The local adapter run is partial evidence only. `evidence/local-adapter-scenarios.json` records 20 adapter assertions as pass and 17 environment-bound scenarios as blocked. The required gate rows below remain `BLOCKED` until those scenarios execute against the reviewed routes, database, deployment, and worker.

| Scenario                                                                                        | Result    | Evidence owner                     |
| ----------------------------------------------------------------------------------------------- | --------- | ---------------------------------- |
| Invalid token                                                                                   | `BLOCKED` | EH-151 / EH-154                    |
| Expired token                                                                                   | `BLOCKED` | EH-151 / EH-154                    |
| Revoked token                                                                                   | `BLOCKED` | EH-151 / EH-154                    |
| PIN accepted and protected cookie established                                                   | `BLOCKED` | EH-151 / EH-154                    |
| Missing, wrong, expired, revoked, and cross-share PIN proof                                     | `BLOCKED` | EH-151 / EH-154                    |
| Two-profile cross-profile report and document IDs                                               | `BLOCKED` | EH-151 / EH-154                    |
| Out-of-scope document                                                                           | `BLOCKED` | EH-151 / EH-153                    |
| Unapproved export format                                                                        | `BLOCKED` | EH-153 / EH-154                    |
| Allowed report export                                                                           | `BLOCKED` | EH-153                             |
| Denied raw-document request                                                                     | `BLOCKED` | EH-151 / EH-153                    |
| Trusted public listener and private/mTLS forwarding                                             | `BLOCKED` | Platform / EH-151                  |
| Direct-origin rejection and valid attested ingress metadata                                     | `BLOCKED` | Platform / EH-151                  |
| Missing, malformed, and expired ingress metadata                                                | `BLOCKED` | Platform / EH-151                  |
| Spoofed ingress headers                                                                         | `BLOCKED` | Platform / EH-151                  |
| Repeated token and PIN failures across both limiter dimensions                                  | `BLOCKED` | EH-151                             |
| Limiter store/configuration unavailable                                                         | `BLOCKED` | EH-151                             |
| No-store, noindex, restrictive-referrer, and no-analytics capture                               | `BLOCKED` | EH-151 / EH-153 / EH-154           |
| No token, PIN, proof, cookie, source text, PHI, storage path, raw IP, or full UA in events/logs | `BLOCKED` | EH-151 / EH-152 / EH-154           |
| Reverse-order concurrent monotonic last access                                                  | `BLOCKED` | EH-151 / EH-152                    |
| Current, previous, unknown, and malformed key selectors                                         | `BLOCKED` | EH-151 / EH-154                    |
| Bounded key rotation, reissue/revoke, and retirement                                            | `BLOCKED` | EH-151 / EH-154                    |
| Archive/remove source snapshot limitation                                                       | `BLOCKED` | EH-148 / EH-151 / EH-153           |
| Tombstoned source report denial before bytes                                                    | `BLOCKED` | Durable deletion / EH-151 / EH-153 |
| Access-event retention cleanup, lock contention/release, backlog drain, retry, and alert        | `BLOCKED` | EH-151 / EH-154                    |

## Machine-readable scenario evidence

For machine-checkable gate references, `release-gate.json` may point to
`release-record.md#<scenario-id>`. Each row below is the reviewed production
result for that scenario; a releasable record requires every result to be
`PASS`, with a concrete evidence reference in the final column. Evidence
references use a URI-like locator such as `route-harness://run-123#scenario`;
`pending`, `not-run`, `n/a`, and prose are not valid evidence references.

| Scenario ID                       | Result    | Evidence  |
| --------------------------------- | --------- | --------- |
| `invalid-token`                   | `BLOCKED` | `pending` |
| `expired-token`                   | `BLOCKED` | `pending` |
| `revoked-token`                   | `BLOCKED` | `pending` |
| `pin-failed`                      | `BLOCKED` | `pending` |
| `pin-success`                     | `BLOCKED` | `pending` |
| `pin-proof-missing`               | `BLOCKED` | `pending` |
| `pin-proof-wrong`                 | `BLOCKED` | `pending` |
| `pin-proof-expired`               | `BLOCKED` | `pending` |
| `pin-proof-revoked`               | `BLOCKED` | `pending` |
| `pin-proof-cross-share`           | `BLOCKED` | `pending` |
| `cross-profile-report`            | `BLOCKED` | `pending` |
| `out-of-scope-document`           | `BLOCKED` | `pending` |
| `unapproved-export-format`        | `BLOCKED` | `pending` |
| `allowed-report`                  | `BLOCKED` | `pending` |
| `denied-raw-document`             | `BLOCKED` | `pending` |
| `cache-index-referrer-policy`     | `BLOCKED` | `pending` |
| `event-redaction`                 | `BLOCKED` | `pending` |
| `rate-limit-token-dimension`      | `BLOCKED` | `pending` |
| `rate-limit-requester-dimension`  | `BLOCKED` | `pending` |
| `rate-limit-store-unavailable`    | `BLOCKED` | `pending` |
| `trusted-ingress-direct-origin`   | `BLOCKED` | `pending` |
| `trusted-ingress-valid`           | `BLOCKED` | `pending` |
| `trusted-ingress-missing`         | `BLOCKED` | `pending` |
| `trusted-ingress-malformed`       | `BLOCKED` | `pending` |
| `trusted-ingress-expired`         | `BLOCKED` | `pending` |
| `trusted-ingress-spoofed-headers` | `BLOCKED` | `pending` |
| `last-access-monotonic`           | `BLOCKED` | `pending` |
| `key-current`                     | `BLOCKED` | `pending` |
| `key-previous`                    | `BLOCKED` | `pending` |
| `key-unknown`                     | `BLOCKED` | `pending` |
| `key-malformed`                   | `BLOCKED` | `pending` |
| `key-rotation-retirement`         | `BLOCKED` | `pending` |
| `archive-source-snapshot`         | `BLOCKED` | `pending` |
| `tombstone-source-report`         | `BLOCKED` | `pending` |
| `replacement-revoke`              | `BLOCKED` | `pending` |
| `raw-download-policy`             | `BLOCKED` | `pending` |
| `cleanup-retention`               | `BLOCKED` | `pending` |

## Gate decision

The gate remains `blocked` until all high findings are closed, all mandatory scenario rows have executed against the production adapters, the reviewed deployment configuration is identified, the retention and key-management prerequisites are evidenced, and the privacy owner signs off. Once evidence is complete, the gate may become `ready-with-risk` only for documented low/medium residual risks with an owner and expiry, or `ready` with no residual risk.
