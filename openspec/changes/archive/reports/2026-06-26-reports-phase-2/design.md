## Context

Phase 1 shipped `/app/reports` with create/view/delete, three report types, document selection, and x402-paid `POST /api/reports`. The list is a flat chronological feed with no search or grouping. Generation always sends all observations in scope; there is no abnormal-only filter.

Phase 2 adds list UX parity with reference products and completes the eight-specialty dropdown from the original exploration, while staying within hackathon constraints (EN UI, educational-only outputs, sync processing).

## Goals / Non-Goals

**Goals:**

- Filter and search saved reports without loading full content client-side for every row.
- Group list UI by calendar month for scanability.
- Let users optionally restrict report input to out-of-range biomarkers only.
- Add five specialty prompts with the same `doctorSummarySchema` output.
- Persist `abnormal_only` on each report for display on detail view.

**Non-Goals:**

- Full-text search inside `content` JSON (title + `summary_preview` only).
- Custom date-range picker (preset ranges only).
- Imaging/consultation without biomarkers.
- PDF export, report editing, or tiered x402 pricing.
- Regenerate-in-place UI (still via `/app/reports/create`).

## Decisions

### 1. Database migration

**Decision:** `005_reports_phase2.sql`:

```sql
alter table public.reports
  drop constraint if exists reports_report_type_check;

alter table public.reports
  add constraint reports_report_type_check
  check (report_type in (
    'general_practice', 'cardiology', 'endocrinology',
    'gastroenterology', 'hematology', 'nephrology', 'neurology', 'pulmonology'
  ));

alter table public.reports
  add column if not exists abnormal_only boolean not null default false;
```

Existing rows keep `abnormal_only = false`.

**Rationale:** Additive column; widen enum via constraint replace (no data migration needed).

### 2. List API query params

**Decision:** `GET /api/reports` accepts:

| Param | Values | Behavior |
|-------|--------|----------|
| `q` | string | Case-insensitive ILIKE on `title` OR `summary_preview` |
| `range` | `all` (default), `30d`, `90d`, `year` | Filter `created_at` |
| `type` | report_type slug or omit | Exact match on `report_type` |

Response unchanged: `{ reports: ReportSummary[] }` ordered `created_at desc`.

Server-side filtering keeps client simple; typical users have tens of reports, not thousands.

**Alternatives:** Client-only filter — rejected; doesn't scale and diverges from API contract.

### 3. Month grouping (UI only)

**Decision:** Group filtered results client-side by `created_at` month using `en-US` locale labels (e.g. `June 2026`). Collapsible section per month, default expanded; show count in header `(N)`.

**Rationale:** No API change needed; grouping is presentation. Filters apply before grouping.

### 4. Abnormal-only observation filter

**Decision:** `abnormal_only: boolean` in `POST` body (default `false`). When `true`, after loading observations for document scope, filter:

```typescript
obs => (obs.ref_low != null && obs.value < obs.ref_low)
    || (obs.ref_high != null && obs.value > obs.ref_high)
```

If zero observations remain → HTTP 400: `"No out-of-range indicators found for the selected documents"`.

Store `abnormal_only` on the report row. Show badge on list/detail when `true`.

**Rationale:** Matches Lissa "Additional settings" pattern; reduces noise for focused specialty reports.

**Edge case:** Observations without ref bounds are excluded when `abnormal_only` is true (cannot classify as abnormal).

### 5. Five new report types

**Decision:** Add to `report-prompts.ts`:

| Key | Label | Prompt focus |
|-----|-------|--------------|
| `gastroenterology` | Gastroenterology | Liver enzymes, GI-related markers |
| `hematology` | Hematology | CBC components, iron, coagulation when present |
| `nephrology` | Nephrology | Creatinine, eGFR, electrolytes, kidney-related markers |
| `neurology` | Neurology | B12, folate, neurological-related markers when present |
| `pulmonology` | Pulmonology | Oxygenation-related and respiratory markers when present |

Same safety block and output schema as Phase 1 types.

### 6. Reports list filter bar UI

**Decision:** Row below page title:

- Text input placeholder `Search`
- Select: All time | Last 30 days | Last 90 days | This year
- Select: All types | (each of 8 types)
- Optional refresh icon re-fetches with current filters

Debounced search (300ms) to limit API calls.

### 7. Document modal — abnormal toggle

**Decision:** In create flow modal, collapsible **Additional settings** section with checkbox:

`Include only out-of-range indicators` (default unchecked).

Value sent as `abnormal_only` on submit. Independent of document selection.

## Risks / Trade-offs

- **[Risk] Abnormal-only yields empty report after payment** → Mitigation: client warns when toggle on; server returns clear 400; consider pre-check endpoint later (out of scope).
- **[Risk] Constraint migration fails if typo in constraint name** → Mitigation: use `drop constraint if exists` with exact Phase 1 name from `004_reports.sql`.
- **[Trade-off] Search only title/preview** → Accept for hackathon; sufficient for finding named reports.

## Migration Plan

1. Apply `005_reports_phase2.sql`.
2. Deploy API changes (backward compatible: new params optional, new body field optional).
3. Deploy UI updates.
4. Rollback: revert frontend/API; column and constraint can remain.

## Open Questions

- None blocking; preset time ranges are sufficient for MVP.
