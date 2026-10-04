# Tasks: eh-148-owner-report-export-surface

Domain: **reports**

## 1. Owner export route

- [x] 1.1 Add `GET /api/reports/[id]/export` that resolves the session, validates the format against `REPORT_EXPORT_FORMATS` after authentication, and delegates to `renderReportExport` with an owner access context.
- [x] 1.2 Map every `ReportExportErrorCode` onto a stable `{status, body}` in `src/lib/report-export/route-response.ts`, map unknown throwables to a generic serialization failure, and never forward `error.message`.
- [x] 1.3 Build the response through `createReportExportResponse` with the owner context so private/no-store/nosniff headers and the RFC 5987 filename come from EH-153 rather than being re-derived.

## 2. Report detail surface

- [x] 2.1 Compute export availability once as `status === "structured" && can_export` and render EH-153's `ReportExportActions` in exactly one gated branch.
- [x] 2.2 Fetch the export, resolve the saved filename from `Content-Disposition` through `attachmentFilename`, and trigger the download with a revoked object URL.
- [x] 2.3 Leave the legacy presentation, report body, and navigation unchanged for reports without export permission.

## 3. Verification

- [x] 3.1 Add `scripts/verify-eh153-owner-export-integration.ts` covering failure mapping and message opacity, download-filename sanitization, auth-before-format ordering, owner delegation, and single-branch action gating.
- [x] 3.2 Register `test:eh153-owner-export` in `package.json`, `ci/verification-suite-policy.json`, and the `verify` job; confirm `check:ci-suite-coverage` and `check:ci-suite-coverage-contract` pass.
- [x] 3.3 Record manual product evidence in `QA/eh-153/checklist.md` for the owner surface.

## 4. Handoff

- [ ] 4.1 EH-151 wires the named public-share slot and its shared export route, passing `applyPublicShareResponsePolicy`; it is not part of this change.
- [ ] 4.2 EH-154 includes the owner export route in its share-link threat model and download-policy gate.
