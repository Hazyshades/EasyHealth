# EH-151: Scoped expiring report share links

**Roadmap status:** In progress
**Build / environment:** `fix/sprint-7-runtime-blockers`, Next via `scripts/next-server.mjs`, local sidecar at `http://localhost:8443`
**Test run date:** 2026-10-06
**Tester:** Local automated and browser smoke

## What this checklist covers

This checklist covers the recipient-facing public report page, optional PIN
proof flow, generic unavailable states, and raw-document download boundary for
scoped, expiring report links. Owner share creation, revoke, replacement, and
access-history controls are API or EH-152 surfaces, not a management screen
implemented by EH-151.

## Before you start

- [ ] Use a dedicated test account and a second recipient browser profile.
- [ ] Use only synthetic or de-identified documents and report content.
- [ ] Confirm the synthetic report has completed processing and is a validated
      EH-148 report before creating a share.
- [ ] Use HTTPS for browser checks so the protected PIN cookie can be stored.

## Test data

| ID                     | Test document or setup                                                                                          | Purpose                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `EH151-VALID-REPORT`   | Synthetic validated report with one active source document and no patient identifiers                           | Normal report-sharing path             |
| `EH151-PIN-REPORT`     | Synthetic validated report with a four-digit test PIN such as `2468`                                            | PIN proof establishment and retry path |
| `EH151-LIMITED-REPORT` | Synthetic validated report with a safe `SOURCE_UNAVAILABLE` limitation while its parent document remains active | Limited report projection              |
| `EH151-EXPIRED-REPORT` | Synthetic report share whose expiry is in the past                                                              | Expiry denial                          |
| `EH151-REVOKED-REPORT` | Synthetic report share revoked by a developer or EH-152 management surface                                      | Revocation denial                      |
| `EH151-DOCUMENT-SCOPE` | Synthetic share with one explicitly allowed active document and one unselected document                         | Raw-document scope boundary            |

## Interface checks

### EH151-UI-01: Open a valid shared report

**Precondition:** A developer has created a share for `EH151-VALID-REPORT` and
provided the one-time link to the tester. The recipient browser is not signed
in to the owner account.

1. Open the share link in a private browser window.
2. Confirm the page finishes loading without an owner-session login.
3. Review the report title, summary, validation content, and source-backed
   limitations shown on the page.
4. Resize the window to a narrow mobile width and tab through the visible
   controls.

**Expected result:** The validated report is readable without an owner
session. The page remains usable at mobile width and the PIN or error controls,
when present, are keyboard reachable. No profile identifier, storage URL, or
unrelated report appears.

**Result:** `Not executed`
**Notes / evidence link:** `________`

### EH151-UI-02: Establish a PIN proof and retry safely

**Precondition:** A developer has created a PIN-protected share for
`EH151-PIN-REPORT` with the synthetic PIN `2468`.

1. Open the share link in a private browser window.
2. Confirm the page asks for an access PIN without placing the PIN in the URL.
3. Submit an intentionally wrong PIN.
4. Confirm the page shows a generic retry state and does not show internal
   rate-limit, token, or proof details.
5. Submit `2468` in the same PIN form.
6. Reload the report page and open the report again using the same browser.

**Expected result:** The wrong PIN does not expose report content or a proof
value. The correct PIN opens the report, and the short-lived proof allows the
same browser to continue without displaying the PIN or proof in the page.

**Result:** `Not executed`
**Notes / evidence link:** `________`

### EH151-UI-03: Display a limited report safely

**Precondition:** A developer has created a share for `EH151-LIMITED-REPORT`
where the cited source row is unavailable but the parent document remains
active.

1. Open the share link in a private browser window.
2. Review the report sections and limitations.
3. Confirm no raw source file download is offered unless the share was created
   with an explicit document scope.

**Expected result:** The historical report remains visible with an explicit
source-unavailable or limited-evidence message. Unsupported live source data
is not added to the report.

**Result:** `Not executed`
**Notes / evidence link:** `________`

### EH151-UI-04: Show the same unavailable state for expired and revoked links

**Precondition:** A developer has prepared `EH151-EXPIRED-REPORT` and
`EH151-REVOKED-REPORT` links.

1. Open the expired link.
2. Record the visible status and message without inspecting developer tools.
3. Open the revoked link in a separate private window.
4. Compare the visible status and message with the expired-link result.

**Expected result:** Both links show the same non-enumerating unavailable state.
The page does not reveal whether expiry, revocation, malformed token, or
missing share state caused the denial.

**Result:** `Not executed`
**Notes / evidence link:** `________`

### EH151-UI-05: Recheck raw-document scope

**Precondition:** A developer has created `EH151-DOCUMENT-SCOPE` with one
explicitly allowed active document and one unselected document, and has
provided the corresponding share link and test URLs through the approved
surface.

1. Open the report share and confirm that the `Shared documents` section lists
   only the explicitly allowed filename.
2. Activate that document's `Download document` control.
3. Request the unselected document using the same share.
4. After the share is revoked or the source document is tombstoned, request
   the previously allowed document again.

**Expected result:** The page lists only explicitly allowed active documents.
The allowed document is returned only while the share, PIN proof, report, and
document remain authorized. The unselected document and every request after
revocation or tombstoning show a generic denial. The browser never receives a
storage signed URL.

**Result:** `Blocked: reviewed HTTPS trusted ingress is unavailable`
**Notes / evidence link:** The local Docker sidecar and peer-aware Next runtime are implemented and the sidecar transport smoke reaches the private Next origin. The local compose path is HTTP-only and does not provide the reviewed HTTPS/mTLS deployment required for protected PIN-cookie and raw-document acceptance. Direct-origin requests remain fail-closed with HTTP `503`.

## Developer evidence required

- [x] `pnpm test:eh151` passed on 2026-09-28, covering token entropy, key rotation, PIN verifier, proof digest, requester-only unknown-token rate limiting, trusted-ingress attestation, direct-origin rejection, response policy, and export-action seam fixtures.
- [x] `pnpm test:eh151-db` passed via the explicit local database URL on the fresh merged schema at temporary port `45432`; 37 pgTAP assertions covered migration objects, service-role DML revocation, validated report scope, atomic child-row creation, monotonic last access, event cleanup, and atomic rate-limit windows. The default `--local` wrapper path can exit 1 after a complete PASS when PostHog shutdown times out; this is logged as `pc_0dc48af12c38`.
- [x] `pnpm exec tsc --noEmit --pretty false` passed on 2026-09-28 for the Next application.
- [x] `pnpm --dir worker exec tsc --noEmit` passed after `pnpm --dir worker install`; `@mistralai/mistralai` `2.6.3` is installed and the previous OCR import/implicit-any errors are gone.
- [x] `supabase db lint --local --fail-on error` passes after the EH-104 cleanup merge; no error-level findings remain. Warning-level baseline findings remain in unrelated pre-existing functions; EH-151 cleanup-loop warnings were removed.
- [x] `pnpm build` passed with the supplied `.env`: the EH-151 routes compiled and all 58 static pages generated.
- [x] Browser smoke with the supplied environment loaded `/`; a direct `/share/not-a-real-token` request was rejected at the middleware boundary with HTTP `503` and the generic `Share service unavailable` response.

## Out of scope or not manually testable yet

- EH-152 owner listing, revoke controls, and access-history UI are out of
  scope. EH-151 exposes the repository seam only.
- EH-153 serializer fixtures remain out of scope for this checklist. The public
  share export route and export-actions UI are now wired and are covered by
  `QA/eh-153/checklist.md`; valid recipient download remains blocked on reviewed
  ingress evidence.
- EH-154 threat-model and release-gate sign-off is out of scope. Its required
  inputs are listed above and must not be treated as complete from local
  TypeScript or fixture evidence alone.

## Sprint 7 local integration run: 2026-10-06

- **Environment:** Local Supabase, peer-aware Next at `http://localhost:3000`, and the local Docker sidecar at `http://localhost:8443`; synthetic validated report and owner share tokens.
- **Direct-origin boundary:** `PASS`. Requests to a valid local share token, an invalid token, and requests with spoofed `x-forwarded-*` headers returned HTTP `503` with `{"error":"Share service unavailable"}`, `Cache-Control: no-store, private`, and `X-Robots-Tag: noindex, nofollow`. The custom Node server exposes the actual socket peer to the trusted-ingress adapter, and localhost is not in the trusted sidecar CIDR.
- **Sidecar transport:** `PASS`. The sidecar strips client-supplied edge headers, signs a fresh attestation, forwards only `/share/*` and `/api/share/*`, and reaches the private Next origin. Invalid-token smoke responses remain generic and non-cacheable.
- **Automated/database evidence:** `pnpm test:eh151` passed. After applying local migrations `086_eh152_management_seam.sql` and `087_eh151_replacement_preflight.sql`, `pnpm test:eh151-db` passed with 44 assertions.
- **Worker processing:** `PASS` for the retried EH147 synthetic full-pipeline job with the repository environment; the worker recorded `completed`, and the document reached `needs_review` with `gpt-4o-mini` extraction. Reviewed worker scheduling and retention evidence remain pending.
- **Still blocked:** PIN success/proof-cookie continuation, valid public report rendering, public export downloads, scoped document download, and expired/revoked recipient UI require a reviewed HTTPS/mTLS deployment and persisted production-adapter fixtures. These remain unmarked as passes.
