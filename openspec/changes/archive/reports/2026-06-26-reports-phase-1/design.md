## Context

EasyHealth currently exposes a single-use Doctor summary at `/app/summary` backed by `POST /api/doctor-summary` ($0.05 x402). The handler loads **all** observations for the session profile, runs one generic safety prompt, and returns JSON without persistence. Documents are listed at `/app/documents` but are not selectable for summary generation.

This change introduces Phase 1 of a Reports module: persisted reports, configurable generation, and CRUD APIs. Constraints from `easyhealth.mdc` remain: EN-first UI, educational language only, mandatory disclaimer, x402 on generation, no PHI on-chain, minimize diff scope.

## Goals / Non-Goals

**Goals:**

- Persist every paid report generation in Supabase with metadata (title, type, detail level, document scope).
- Replace summary UX with `/app/reports` (list), `/app/reports/create` (form), `/app/reports/[id]` (view + back link).
- Support 3 report types with distinct system prompts; 4 detail levels affecting prompt length guidance.
- Allow optional manual document selection; default to all eligible documents when none selected.
- Redirect to report view after successful creation; allow unlimited new generations (each paid).
- Remove legacy `/app/summary` and `/api/doctor-summary` entirely.

**Non-Goals (Phase 1):**

- Search, time-range filters, and month grouping on the list (Phase 2).
- "Include only out-of-range indicators" toggle (Phase 2).
- Five additional specialties beyond the initial three (Phase 2).
- Imaging/consultation content in reports when no biomarkers were extracted.
- Report editing or in-place regeneration UI (user creates a new report via `/reports/create`).
- PDF export or doctor portal sharing.

## Decisions

### 1. Database schema: `reports` table

**Decision:** Add `004_reports.sql`:

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  report_type text not null
    check (report_type in ('general_practice', 'cardiology', 'endocrinology')),
  detail_level text not null
    check (detail_level in ('compact', 'standard', 'detailed', 'full')),
  document_ids uuid[] null,
  content jsonb not null,
  summary_preview text not null,
  created_at timestamptz not null default now()
);
create index reports_profile_created on public.reports (profile_id, created_at desc);
```

`document_ids NULL` means "all eligible documents at generation time." Non-null array means explicit user selection.

`content` stores the full `doctorSummarySchema` object plus server-appended `disclaimer`.

**Rationale:** JSONB matches existing patterns; array of UUIDs is simple for document scope without a join table.

**Alternatives:** Join table `report_documents` — rejected as over-engineering for hackathon scope.

### 2. Eligible documents for reports

**Decision:** A document is eligible when `status = 'completed'` **and** it has at least one row in `observations` with matching `document_id`.

Imaging/consultation uploads without extracted biomarkers are **excluded** from the selection modal and from the "all documents" default.

**Rationale:** Reports are biomarker-driven today; metadata-only documents would produce empty or hallucination-prone context. Simplest correct behavior for MVP.

**Alternatives:** Include all completed documents with filename-only context — rejected due to weak signal and safety risk.

### 3. Report types and prompts (3 specialties)

**Decision:** Static config in `src/lib/report-prompts.ts`:

| `report_type`       | UI label                         | Focus |
|---------------------|----------------------------------|-------|
| `general_practice`  | Primary care (general practice)  | Holistic wellness, preventive framing |
| `cardiology`        | Cardiology                       | Lipids, cardiac-related markers |
| `endocrinology`     | Endocrinology                    | Glucose, HbA1c, thyroid-related markers |

Shared `SAFETY_PROMPT` block prepended to every specialty system prompt. Output schema remains `doctorSummarySchema` for all types.

**Detail levels** adjust prompt instruction only (not price):

| Level      | UI hint      | Prompt guidance |
|------------|--------------|-----------------|
| `compact`  | ~1 page      | Brief bullets, minimal prose |
| `standard` | 2–3 pages    | Default balanced depth |
| `detailed` | 4–5 pages    | Expanded sections |
| `full`     | Comprehensive| Maximum detail within educational bounds |

**Rationale:** One Zod schema keeps rendering/storage uniform; specialty differentiation is prompt-only.

### 4. API surface

**Decision:**

| Method | Path | Auth | Payment | Purpose |
|--------|------|------|---------|---------|
| `GET` | `/api/reports` | Session | No | List reports for profile, newest first |
| `GET` | `/api/reports/[id]` | Session | No | Single report (403 if wrong profile) |
| `POST` | `/api/reports` | Session | x402 $0.05 | Generate + persist |
| `DELETE` | `/api/reports/[id]` | Session | No | Delete own report |

`POST` body:

```typescript
{
  title: string;
  report_type: 'general_practice' | 'cardiology' | 'endocrinology';
  detail_level: 'compact' | 'standard' | 'detailed' | 'full';
  document_ids?: string[] | null; // omit or null = all eligible
}
```

Response: `{ id, title, report_type, detail_level, document_ids, content, summary_preview, created_at }`.

Remove `POST /api/doctor-summary` and `src/app/app/summary/`.

**Rationale:** RESTful naming aligns with UI routes; payment only on generation.

### 5. Observation query for generation

**Decision:** After resolving document scope:

1. If `document_ids` is null/omitted → query observations where `document_id` is in the set of eligible document IDs for the profile.
2. If `document_ids` is provided → validate each ID belongs to profile and is eligible; query observations filtered to those IDs.
3. If zero observations → return 400 before LLM call (after x402 — **note**: validate eligibility client-side first; server still validates post-payment).

**Post-payment 400** is acceptable if client sent stale IDs; document this in UI copy.

### 6. `summary_preview`

**Decision:** Server sets `summary_preview = overview.slice(0, 120).trim()` with ellipsis if truncated. No extra LLM call.

### 7. Frontend routes and navigation

**Decision:**

- `/app/reports` — list with "+ Create report" button; cards show title, preview, type badge, detail badge, date, View / Delete.
- `/app/reports/create` — form with default title `Report from {locale date}`; document picker modal; submit triggers x402 then redirects to `/app/reports/[id]`.
- `/app/reports/[id]` — render report sections; top bar with **Back to reports** link to `/app/reports`.
- Sidebar: `{ href: "/app/reports", label: "Health reports" }`.
- Update dashboard and landing links; delete `/app/summary`.

**Document picker modal:**

- Fetch eligible documents via new `GET /api/reports/eligible-documents` **or** extend `GET /api/documents` with `?eligible_for_report=true`.
- **Decision:** Add query param `eligible_for_report=1` on `GET /api/documents` returning only completed docs with observations (avoids extra route).
- Disabled when zero eligible docs; Create button disabled same condition.
- Select all / Clear selection; footer shows selected count.
- If user never opens modal → submit with `document_ids: null`.

### 8. x402 and payment receipts

**Decision:** `POST /api/reports` uses `withGateway(handler, "$0.05", "/api/reports", ...)`. Record `payment_receipts` with endpoint `/api/reports` (existing middleware behavior).

Each new report = new payment. No idempotent reuse.

### 9. Regeneration

**Decision:** No dedicated "Regenerate" button in Phase 1. User navigates to `/app/reports/create`, fills the form (optionally same values), pays again. View page includes secondary link "Create another report".

## Risks / Trade-offs

- **[Risk] User expects imaging reports in health report** → Mitigation: document picker only shows eligible lab-backed docs; empty state explains "Upload and process lab results first."
- **[Risk] x402 charged then 400 on no observations** → Mitigation: disable create when no eligible docs; server validates document IDs after payment.
- **[Risk] Breaking bookmarks to `/app/summary`** → Mitigation: intentional removal per product decision; update all internal links.
- **[Trade-off] No list filters in Phase 1** → Accept; chronological list sufficient for demo.
- **[Trade-off] Flat $0.05 for all detail levels** → Accept for hackathon simplicity.

## Migration Plan

1. Apply `004_reports.sql` to Supabase.
2. Deploy new `/api/reports` routes alongside existing `doctor-summary`.
3. Ship new frontend pages; switch sidebar and links.
4. Remove `doctor-summary` route and `summary` page in same release.
5. Rollback: re-add doctor-summary handler from git; `reports` table is additive.

## Open Questions

- None blocking Phase 1; filters, abnormal-only, and 5 additional specialties deferred to Phase 2.
