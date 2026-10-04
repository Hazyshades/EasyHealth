# Proposal: eh-148-owner-report-export-surface

Domain: **reports**

## Why

EH-153 shipped a complete, scope-safe export package, but nothing calls it. `renderReportExport`, `createReportExportResponse`, and `ReportExportActions` have zero production references: there is no export route and no page renders the actions. A merged, verified export feature that no user can reach is not a delivered feature.

EH-148 owns the authenticated report detail surface, so the owner wiring belongs here.

## What Changes

- Add `GET /api/reports/[id]/export?format=pdf|csv|json` as the owner export route. It resolves the session, validates the requested format, and delegates to EH-153's `renderReportExport` with an owner access context; it never widens scope itself.
- Map EH-153 `ReportExportError` codes onto stable public HTTP responses through `classifyReportExportFailure`, so a failure returns a fixed message plus its closed export code and never leaks internal exception text, validation issue codes, or storage paths.
- Render EH-153's `ReportExportActions` on the authenticated report detail page, gated on a structured report whose read result permits export. Legacy reports keep the existing "sharing unavailable" presentation and gain no export control.
- Resolve the saved filename from `Content-Disposition` at the download sink and strip path separators and control characters again, so a download name can never escape the user's download folder.

## Capabilities

### Modified Capabilities

- `reports-ui`: the report detail surface offers owner PDF/CSV/JSON actions, downloads them through an owner-scoped route, and keeps the actions absent when export is unavailable.

## Impact

The route is a thin adapter: authorization, scope resolution, and serialization stay inside EH-153. The page gains one client component and a fetch/download handler. EH-151's public-share integration slot is untouched and remains that change's responsibility.
