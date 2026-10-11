# EH-154 Release Evidence Record

**Gate status:** `blocked`
**Reviewed build / commit:** `36b8c4e` — immutable commit exists; formal review and manifest binding remain pending
**Reviewed deployment:** `deployment://contabo-217-216-86-38/easyhealth-2026-10-08#sha256:3749df35ab63f053622c7e1e133d2e0669835ff66c7eef0bc2e6a6e30c63a511`
**Evidence owner:** `EH-154 release evidence`
**Privacy owner:** `PENDING`
**Last updated:** `2026-10-08`

This release record remains intentionally blocked for the formal reviewed-build/manifest/privacy decision. The deployed HTTPS/mTLS route, live recipient matrix, retention lock/backlog evidence, monotonic concurrency proof, durable-deletion finalization, historical-log remediation, owner-control smoke, non-secret settings, and secret fingerprints are now recorded below. The remaining blockers are immutable reviewed-build identity, canonical evidence-manifest binding (including key-management evidence), and human privacy/operations approval.

## Blocking findings

| ID          | Severity | Status | Finding                                                                                                                                                      | Closure evidence |
| ----------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| EH154-F-001 | High     | `OPEN`   | EH-151 public boundary and public export route are live-tested, but the execution artifacts are not yet bound to an immutable reviewed build/deployment manifest. | `release-record.md` live matrix; manifest binding pending |
| EH154-F-002 | High     | `OPEN`   | EH-152 management and EH-153 owner adapters are live-tested, but complete reviewed content evidence and manifest binding remain incomplete. | `release-record.md` owner/export matrix; manifest binding pending |
| EH154-F-003 | High     | `CLOSED` | Production HTTPS/mTLS trusted ingress is deployed, private-origin only, and validated after cleanup. | VM deployment fingerprints and Caddy validation below |
| EH154-F-004 | High     | `CLOSED` | Retention contention/backlog drain and durable deletion finalization are now evidenced against the deployed worker. | VM worker evidence below |

No low or medium residual-risk decision can override these findings.

## Commands executed for this package

| Command                                                                                            | Result    | Evidence                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                                                   | `PASS`    | Restored the declared `@react-pdf/renderer` 4.3.0 dependency from the committed lockfile.                                            |
| `pnpm exec tsc --noEmit`                                                                           | `PASS`    | Next application typecheck passed after the public export and peer-runtime changes.                                                  |
| `pnpm --dir worker exec tsc --noEmit`                                                              | `PASS`    | Worker typecheck passed.                                                                                                             |
| `pnpm test:eh151`                                                                                  | `PASS`    | Token, PIN, trusted-ingress transport, response-policy, rate-limit, and public-export route fixture checks passed.                   |
| `pnpm test:eh153`                                                                                  | `PASS`    | PDF, CSV, JSON, Unicode, embedded-font, scope, size, and shared-policy fixture checks passed.                                        |
| `pnpm test:eh153-owner-export`                                                                     | `PASS`    | Owner route and report-detail export integration fixtures passed.                                                                    |
| `pnpm test:eh154-adapters`                                                                         | `PASS`    | 20 deterministic adapter assertions passed; 17 environment-bound scenarios remained blocked.                                         |
| `pnpm test:eh154`                                                                                  | `BLOCKED` | Fail-closed gate reported 41 blocking or incomplete findings; remaining output is the unbound scenario matrix plus EH-151/EH-152 evidence anchors, immutable-build, and privacy package blockers. |
| `curl [redacted-openai-api]/v1/models`                                                             | `PASS`    | Host HTTPS egress reached the provider and returned HTTP 401 without credentials.                                                    |
| `node fetch [redacted-openai-api]/v1/models`                                                       | `PASS`    | Node fetch reached the provider and returned HTTP 401 without credentials.                                                           |
| `node --check scripts/next-server.mjs scripts/trusted-ingress-sidecar.mjs`                         | `PASS`    | Peer-aware Node server and local sidecar syntax passed.                                                                              |
| `docker compose -f docker-compose.trusted-ingress.yml config`                                      | `PASS`    | Local sidecar compose configuration rendered with the required secret reference.                                                     |
| `curl [redacted-local-origin]/share/synthetic-invalid`                                             | `PASS`    | Direct origin returned generic HTTP 503 with no-store/noindex headers.                                                               |
| `curl [redacted-local-sidecar]/share/synthetic-invalid`                                            | `PASS`    | Local sidecar forwarded the share request to the private Next origin; the invalid-token response remained generic and non-cacheable. |
| `openspec validate eh-154-share-link-privacy-release-gate --type change --strict --no-interactive` | `PASS`    | Change artifacts validate under the installed CLI.                                                                                   |

## Current implementation handoff: 2026-10-06


- `src/app/api/share/[token]/export/route.ts` now verifies trusted ingress, token state, PIN proof, format allow-list, share scope, and public response policy before returning export bytes.
- `src/app/share/[token]/page.tsx` now renders the existing `ReportExportActions` component and downloads through the public route without handling token material beyond the URL already required by the page.
- `scripts/next-server.mjs` installs the actual Node socket peer through `AsyncLocalStorage`; direct localhost requests remain outside the trusted sidecar CIDR.
- `scripts/trusted-ingress-sidecar.mjs` strips client edge headers, signs canonical attestation headers, and forwards only public share paths. The compose file is local HTTP smoke infrastructure, not reviewed production HTTPS/mTLS evidence.

## Live VM execution handoff: 2026-10-08

- **Deployment:** The existing SmartFood Caddy listener serves EasyHealth HTTPS and the public Supabase hostname. EasyHealth Next has no host-published port; Caddy → ingress and ingress → Next use separate mTLS legs with PROXY protocol v2. Production EasyHealth routing is recipient-only; the temporary owner QA ingress/container were removed and the restored Caddy configuration validated.
- **Runtime:** EasyHealth Next (`sha256:c43505811e777654a519bdd23d6e335b5caeb500b91d7ff00ee2c22d2855a895`), ingress (`sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`), worker (`sha256:bc1da9776ed65f1817b57b79b71528a5e64d69571c37331224c1e3b1c01d2b14`), official Supabase core services, SmartFood Caddy/API/Postgres were running with zero restarts at final inspection. Compose and Caddy validation passed.
- **Live recipient matrix:** Valid report/JSON/PDF/scoped-document paths returned HTTP 200 with `no-store, private`. Malformed, expired, revoked, omitted CSV, unselected, cross-profile, revoked-document, and deleted-source paths returned generic HTTP 404; the PIN-required report returned HTTP 401. No exercised body contained fixture token/PIN material.
- **Owner/Auth:** Synthetic owner controls rendered Active, Expired, and Revoked groups. The authenticated smoke exercised Revoke, Create replacement link, and Copy link; copy feedback appeared and the final visible page contained no token. The service authorization matrix returned four owner shares, one other-profile share, zero foreign access events, and `share_not_found` for a foreign revoke.
- **Retention:** With 501 expired rows per table, an advisory-lock contender skipped without deletion; one bounded 500-row batch per table left one row; one-row drain calls removed the remainder. Access, rate-limit, and PIN-proof cleanup all obeyed bounded continuation.
- **Monotonic access:** Twenty concurrent `touch_report_share_last_accessed` calls returned zero RPC errors; the final stored timestamp equaled the greatest submitted timestamp.
- **Durable deletion:** The worker completed the queued deletion with `retry_count=0`, `stable_empty_count=2`, `last_error_code=null`, and cleared both report and document rows. The deployed verification fix compares actual storage listings separately from known database paths before final purge.
- **Redaction:** Public EasyHealth and Supabase Caddy routes have no access-log block. Pre-rotation Caddy container logs were truncated; `json-file` rotation is configured as `max-size=10m,max-file=3`. Post-rotation share/auth request inspection had zero share-material, authorization/PIN, or storage hits. Historical sensitive material is no longer retained in the current container log.
- **Configuration fingerprints:** deployment aggregate `deployment://contabo-217-216-86-38/easyhealth-2026-10-08#sha256:3749df35ab63f053622c7e1e133d2e0669835ff66c7eef0bc2e6a6e30c63a511`; secret fingerprints and non-secret settings are recorded in `privacy-signoff.md` without secret values.

This live evidence is not yet machine-gate evidence: the reviewed commit now exists as `36b8c4e`, but canonical `evidence-manifest.json` artifacts and privacy/operations approval remain pending.

## Closure evidence collected 2026-10-08

- Retention lock, bounded backlog, and drain: `access_share_events`/rate-limit/PIN-proof each deleted `500` in a one-batch run, left `1`, then drained `1`; lock contention returned `skipped=true` and `deleted_count=0`.
- Deletion finalization: worker operation reached `completed`; report/document rows were both `0`; `stable_empty_count=2`; no retry or error.
- Historical log remediation: old Caddy JSON log was truncated before recreating the container; rotation is enforced by SmartFood compose; post-rotation sensitive-hit scans returned `0`.
- Owner management controls: status grouping, Revoke, replacement creation, and one-time Copy link were exercised through the temporary synthetic-only route; the route and container were removed afterward.
- Deployment evidence: all runtime values and three secret SHA-256 fingerprints were captured without recording secret material.

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
`PASS`, with a concrete evidence reference in the final column. Reviewed
evidence references MUST use the verifier-resolved form
`evidence://<immutable-artifact-id>#<scenario-id>@sha256:<64-hex-digest>`.
The matching `evidence-manifest.json` entry MUST bind the artifact to the
reviewed build and immutable deployment digest. Artifact bytes must be canonical
JSON (sorted object keys, preserved array order, one trailing newline); the
manifest digest is the SHA-256 of those exact UTF-8 bytes. `pending`, `not-run`,
`n/a`, prose, and unresolvable references are not valid evidence references.
Each canonical evidence anchor must also carry a structured payload:
`evidence.command` identifies the executed check, `evidence.result` records
the observed result, and `source` is a content-addressed
`evidence://...@sha256:...` hop or terminal
`artifact://...#sha256:...` reference. The verifier resolves every source hop
through the manifest to canonical, build/deployment-bound artifact bytes and
rejects cycles. The manifest must separately declare the canonical
`local-adapter-scenarios.json` as an unanchored `kind: local-adapter` artifact
bound to the same build and deployment. Status/build/deployment metadata alone,
arbitrary prose, or placeholder values are not reviewed execution evidence.

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
