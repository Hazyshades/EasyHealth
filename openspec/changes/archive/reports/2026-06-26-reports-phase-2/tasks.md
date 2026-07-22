## 1. Database

- [x] 1.1 Add migration `005_reports_phase2.sql` — widen `report_type` check to 8 values, add `abnormal_only boolean not null default false`
- [x] 1.2 Apply migration to Supabase (local or remote)

## 2. Server — prompts and helpers

- [x] 2.1 Add five report types and specialty prompts to `src/lib/report-prompts.ts` (gastroenterology, hematology, nephrology, neurology, pulmonology)
- [x] 2.2 Extend `createReportBodySchema` with `abnormal_only` optional boolean (default false)
- [x] 2.3 Add `filterAbnormalObservations()` in `src/lib/reports.ts`

## 3. Server — API

- [x] 3.1 Extend `GET /api/reports` with `q`, `range` (`all`|`30d`|`90d`|`year`), and `type` query params
- [x] 3.2 Include `abnormal_only` in list and detail API responses
- [x] 3.3 Extend `POST /api/reports` to accept `abnormal_only`, filter observations when true, persist flag, return 400 when no abnormal data

## 4. Reports list UI

- [x] 4.1 Add search input with 300ms debounce calling filtered `GET /api/reports`
- [x] 4.2 Add time-range and report-type filter dropdowns
- [x] 4.3 Group filtered reports by month with collapsible headers and counts
- [x] 4.4 Show abnormal-only badge on cards when applicable
- [x] 4.5 Add empty state for zero filter results with clear-filters action

## 5. Create report UI

- [x] 5.1 Add eight report types to create form selector
- [x] 5.2 Add **Additional settings** collapsible in document modal with abnormal-only checkbox
- [x] 5.3 Send `abnormal_only` in `POST /api/reports` body on submit

## 6. Report detail UI

- [x] 6.1 Display abnormal-only indicator on `/app/reports/[id]` when report was generated with that flag

## 7. Verification

- [x] 7.1 Verify list filters: search, 30d range, type filter
- [x] 7.2 Verify month grouping renders correctly with multiple reports
- [x] 7.3 Verify abnormal-only report generation and 400 when no out-of-range data
- [x] 7.4 Verify all eight report types appear in create form and validate on API
