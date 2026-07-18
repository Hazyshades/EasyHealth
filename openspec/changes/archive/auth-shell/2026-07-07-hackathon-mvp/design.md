## Context

EasyHealth is a Next.js App Router fork of `x402-ai-starter` with Circle wallet auth, Supabase (profiles, documents, observations), and two paid endpoints: `POST /api/upload` ($0.01) and `POST /api/doctor-summary` ($0.05). The current `/app` page shows biomarker tables and charts but no document list or visual health overview. Hackathon judges need a clear demo path: sign in → upload labs → see structured data → view profile map → generate paid doctor summary.

Constraints from `easyhealth.mdc`: EN-first UI, no diagnoses/risk scores, educational language only, mandatory disclaimer, no PHI on-chain, minimize diff scope, sync processing.

## Goals / Non-Goals

**Goals:**

- Deliver Lissa-inspired IA: Documents (ingest), Health Profile (visual synthesis), Biomarkers (analytics), Doctor summary (reports).
- Show how many records contribute to profile insights with source document citations.
- Preserve existing x402 payment flows without regression.
- Use deterministic server-side aggregation for Health Profile (no extra LLM call for hackathon).
- Ship a sidebar layout suitable for demo recording in one session.

**Non-Goals:**

- DICOM viewer, genetics, wearables, family profiles, doctor portal, B2B.
- Paid Health Profile refresh endpoint (free `GET` for hackathon; x402 can be added later).
- Full imaging/consultation parsing pipelines (tabs exist; only lab tab is functional).
- Report history persistence for doctor summaries.
- Mobile-native app or PWA install flow.

## Decisions

### 1. Sidebar layout replaces flat header nav

**Decision:** Add `AppSidebar` in `src/app/app/layout.tsx` with grouped links; keep wallet/balance info in a compact top bar.

**Rationale:** Matches Lissa reference IA and scales to more sections without crowding the header.

**Alternatives:** Keep header tabs only -rejected; does not communicate MY HEALTH / MY DATA grouping.

### 2. Route map

| Route | Purpose |
|-------|---------|
| `/app` | Dashboard: quick stats + CTAs (documents count, latest lab, links) |
| `/app/documents` | Document hub with type tabs |
| `/app/upload` | Upload zone (linked from Documents CTA) |
| `/app/profile` | Health Profile body map |
| `/app/biomarkers` | Table + trend charts (current `/app` content) |
| `/app/summary` | Doctor summary (unchanged) |

**Rationale:** Clear separation of concerns; `/app/biomarkers` is a **BREAKING** move from `/app`.

### 3. `document_type` on ingest

**Decision:** Add column `document_type text not null default 'lab'` with check constraint `('lab', 'imaging', 'consultation', 'dicom')`. Upload form accepts optional `document_type` (default `lab`). Non-lab tabs show empty state + "Coming soon" until parsers exist.

**Rationale:** Enables tab filtering without building imaging/DICOM parsers now.

### 4. Health Profile = deterministic aggregation, not LLM

**Decision:** `GET /api/health-profile` computes insights from `observations` joined to `documents`:

- Map biomarker keys to body **systems** via static config in `src/lib/health-systems.ts` (e.g. `ldl`, `hdl`, `triglycerides` → cardiovascular).
- Per system: marker count, in-range vs out-of-range vs unknown (using ref_low/ref_high), latest values with `observed_at` and `document_id`.
- **Coverage score** = percentage of tracked markers in that system that have at least one observation (0–100). Label as "Data coverage" not "Health score".
- **Overall coverage** = average of system coverage scores where system has any data.
- `records_used_count` = count of completed documents for profile.

**Rationale:** No extra cost/latency; avoids regulatory risk from LLM-generated "health scores"; aligns with medical safety rules.

**Alternatives:** LLM-generated profile ($0.02 x402) -deferred post-hackathon.

### 5. Body map UI

**Decision:** SVG silhouette component with positioned badges per system showing coverage % and color by band (green ≥70, amber 40–69, slate &lt;40 or no data). Click/hover shows marker list with citations. Footer lists contributing documents (filename + observed_at).

**Rationale:** Visual wow for demo without implying diagnosis. Use existing Tailwind/shadcn patterns.

### 6. Documents API

**Decision:** `GET /api/documents?type=lab` returns `{ documents: Document[] }` filtered by session profile, ordered by `created_at desc`. Fields: id, original_filename, status, document_type, lab_name, observed_at, created_at, error_message.

**Rationale:** Simple read for client list; no signed URLs in MVP (download later).

### 7. Documents hub tabs UX

**Decision:** Client-side tab state; filter list by `document_type`. DICOM tab shows static "Coming soon" card. Primary button "Upload your lab" links to `/app/upload?type=lab`.

**Rationale:** Minimal scope; demonstrates future product surface.

## Risks / Trade-offs

- **[Risk] Users interpret coverage % as health grade** → Mitigation: UI copy "Data coverage based on your uploaded records"; never use Critical/Healthy labels; always show disclaimer.
- **[Risk] Breaking `/app` bookmark** → Mitigation: `/app` becomes dashboard with links; biomarkers at new path; optional redirect note in changelog.
- **[Risk] Sparse data yields empty profile** → Mitigation: Empty state with "Upload your first lab" CTA and example silhouette without scores.
- **[Risk] Biomarker-to-system mapping incomplete** → Mitigation: Start with ~20 common keys from extraction; unmapped keys appear in "General" system.
- **[Trade-off] No document preview** → Accept for hackathon; show metadata only.

## Migration Plan

1. Apply Supabase migration `002_document_type.sql`.
2. Deploy API routes before UI pages (backward compatible).
3. Ship sidebar + new pages; update internal links in landing page.
4. Rollback: revert frontend routes; migration column is additive (safe to leave).

## Open Questions

- Should `/app` redirect to `/app/profile` or show dashboard? **Default: dashboard** for clearer onboarding.
- Add `ai_summary` column now or defer? **Defer** unless imaging tab needs placeholder text.
