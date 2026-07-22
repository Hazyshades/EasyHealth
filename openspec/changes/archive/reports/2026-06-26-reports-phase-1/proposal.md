## Why

The current Doctor summary is a one-shot flow: users pay $0.05, receive an ephemeral JSON response, and lose the result on refresh. There is no report history, no configuration (specialty, detail level), and no control over which uploaded documents feed the summary. Expanding to a persisted **Reports** module matches reference products (e.g. Lissa Health), improves demo value, and keeps the x402 hero endpoint while making reports reusable for clinician visits.

## What Changes

- **BREAKING**: Remove `/app/summary` page and `POST /api/doctor-summary` endpoint.
- Add **Reports list** at `/app/reports` with saved report cards, View, and Delete actions.
- Add **Create report** flow at `/app/reports/create` with name, report type (3 specialties), detail level, and optional manual document selection.
- Add **Report view** at `/app/reports/[id]` with full content and a **Back to reports** button; after creation, redirect here.
- Add `reports` table in Supabase to persist generated reports and metadata.
- Add `POST /api/reports` ($0.05 USDC x402) to generate, save, and return a report; `GET /api/reports` and `GET /api/reports/[id]` for listing and viewing; `DELETE /api/reports/[id]` for removal.
- Update sidebar REPORTS link from "Doctor summary" → "Health reports" pointing to `/app/reports`.
- Users may create multiple reports (including with the same parameters); each generation requires a new x402 payment.
- `summary_preview` derived server-side from the first ~120 characters of `overview` (no extra LLM field).
- Document scope: only **completed** documents that have at least one linked observation (typically lab uploads); imaging/consultation without extracted biomarkers are excluded.

## Capabilities

### New Capabilities

- `reports-api`: Persisted reports CRUD, x402-paid generation, document-scoped observation context, specialty prompts.
- `reports-ui`: Reports list, create form, document selection modal, report detail view with back navigation.

### Modified Capabilities

- `app-shell`: REPORTS nav item route and label change; remove `/app/summary` from navigation and internal links.

## Impact

- **Database**: New migration `004_reports.sql` with `reports` table and RLS policy for service role.
- **API**: New `/api/reports` routes; remove `/api/doctor-summary`.
- **Frontend**: New pages under `/app/reports`; delete `src/app/app/summary/`; update `app-sidebar.tsx`, dashboard, and landing links.
- **Lib**: New `src/lib/report-prompts.ts` for 3 report types × 4 detail levels; refactor generation logic from doctor-summary handler.
- **Unchanged**: x402 $0.05 price, Circle wallet auth, `doctorSummarySchema` output shape, medical safety rules, no PHI on-chain.
