## 1. Database

- [x] 1.1 Add migration `004_reports.sql` with `reports` table, check constraints, index, and RLS policy for service role
- [x] 1.2 Apply migration to Supabase (local or remote)

## 2. Server — report prompts and helpers

- [x] 2.1 Create `src/lib/report-prompts.ts` with 3 report types, 4 detail levels, shared SAFETY_PROMPT, and label maps for UI
- [x] 2.2 Add helper `getEligibleDocumentIds(profileId)` — completed documents with at least one observation
- [x] 2.3 Add helper `buildReportContext(observations)` reusing doctor-summary observation mapping

## 3. Server — APIs

- [x] 3.1 Extend `GET /api/documents` with `?eligible_for_report=1` filter
- [x] 3.2 Implement `GET /api/reports` — list reports for session profile
- [x] 3.3 Implement `GET /api/reports/[id]` — single report with ownership check
- [x] 3.4 Implement `DELETE /api/reports/[id]` — delete own report
- [x] 3.5 Implement `POST /api/reports` with x402 $0.05, body validation, document scope resolution, LLM generation, `summary_preview`, and persistence
- [x] 3.6 Delete `src/app/api/doctor-summary/route.ts`

## 4. App shell and navigation

- [x] 4.1 Update `AppSidebar` REPORTS link to "Health reports" → `/app/reports`
- [x] 4.2 Update dashboard (`/app/page.tsx`) and landing page links from Doctor summary to Health reports
- [x] 4.3 Delete `src/app/app/summary/page.tsx`

## 5. Reports list UI

- [x] 5.1 Create `/app/reports/page.tsx` — fetch `GET /api/reports`, render cards with type/detail badges
- [x] 5.2 Add "+ Create report" button linking to `/app/reports/create`
- [x] 5.3 Implement delete with confirmation calling `DELETE /api/reports/[id]`
- [x] 5.4 Add empty state when no reports exist

## 6. Create report UI

- [x] 6.1 Create `/app/reports/create/page.tsx` with name, report type, and detail level fields
- [x] 6.2 Build document selection modal fetching `GET /api/documents?eligible_for_report=1` with select all / clear
- [x] 6.3 Disable Select documents and submit when zero eligible documents
- [x] 6.4 Wire submit to `payForResource('/api/reports')` with form body; redirect to `/app/reports/[id]` on success

## 7. Report detail UI

- [x] 7.1 Create `/app/reports/[id]/page.tsx` — fetch and render full report sections + disclaimer
- [x] 7.2 Add "Back to reports" link to `/app/reports`
- [x] 7.3 Add "Create another report" link to `/app/reports/create`

## 8. Verification

- [x] 8.1 Manual smoke test: upload lab → create report (all docs) → view → back → delete
- [x] 8.2 Manual smoke test: create report with manual document subset
- [x] 8.3 Verify `/app/summary` and `/api/doctor-summary` return 404
- [x] 8.4 Verify unpaid `POST /api/reports` returns 402
