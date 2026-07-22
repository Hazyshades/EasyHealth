## Why

Phase 1 delivered persisted health reports with three specialties and a flat chronological list. Users with many reports cannot find past outputs quickly, cannot narrow generation to out-of-range biomarkers only, and lack specialty options shown in reference products (e.g. Lissa Health). Phase 2 completes the Reports module polish for demo and real use without changing the x402 payment model.

## What Changes

- Add **list filters** on `/app/reports`: text search, time range (all time / last 30 days / last 90 days / this year), and optional report-type filter.
- Add **month grouping** on the reports list (collapsible sections by `YYYY, Month` with count).
- Add **"Include only out-of-range indicators"** toggle in the document selection modal on create; persist choice on the report row.
- Extend **report types** from 3 to 8 with distinct specialty prompts: Gastroenterology, Hematology, Nephrology, Neurology, Pulmonology (in addition to existing Primary care, Cardiology, Endocrinology).
- Extend `GET /api/reports` with query params for search, time range, and report type.
- Extend `POST /api/reports` body with `abnormal_only` boolean (default `false`).
- Database migration: widen `report_type` check constraint and add `abnormal_only boolean not null default false` to `reports`.

## Capabilities

### New Capabilities

<!-- None — extending existing reports capabilities -->

### Modified Capabilities

- `reports-api`: List filtering query params, `abnormal_only` on generation and persistence, five new report types and prompts.
- `reports-ui`: Search/filter bar, month-grouped list, abnormal-only toggle in document modal, eight report types in create form.

## Impact

- **Database**: Migration `005_reports_phase2.sql` (alter `reports.report_type` check, add `abnormal_only`).
- **API**: `GET /api/reports` query params; `POST /api/reports` body + observation filtering logic.
- **Lib**: `src/lib/report-prompts.ts` — 5 new types; `src/lib/reports.ts` — `filterAbnormalObservations` helper.
- **Frontend**: `src/app/app/reports/page.tsx`, `src/app/app/reports/create/page.tsx`.
- **Unchanged**: x402 $0.05 price, report output schema, eligible-document rules, no PHI on-chain.
