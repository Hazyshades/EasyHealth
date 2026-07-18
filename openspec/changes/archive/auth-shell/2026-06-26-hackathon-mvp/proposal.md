## Why

EasyHealth currently exposes a flat three-link header (Health card, Upload, Doctor summary) where "Health card" is really a biomarker table—not a document archive. Users cannot see uploaded labs, understand how many records feed their insights, or get a visual health overview like reference products (e.g. Lissa Health). The hackathon demo needs a coherent **ingest → structure → visualize → report** flow with x402 payments intact, while staying within EU/US wellness constraints (no diagnoses or risk scores).

## What Changes

- **BREAKING**: Replace flat header nav with grouped sidebar: MY HEALTH / MY DATA / REPORTS.
- **BREAKING**: Move biomarker table + trends from `/app` to `/app/biomarkers`; `/app` becomes Dashboard or redirects to Health Profile.
- Add **Documents** hub at `/app/documents` with tabs: Lab results (active), Imaging reports, Consultations, DICOM (stub "Coming soon"), and primary CTA **Upload your lab**.
- Add **Health Profile** at `/app/profile`: body-map visualization, per-system educational insights sourced from biomarkers, records-used count, and mandatory medical disclaimer.
- Keep **Doctor summary** at `/app/summary` (Reports section); no functional change to x402 $0.05 flow.
- Extend `documents` with `document_type` and optional `ai_summary` for non-lab uploads later.
- Add `GET /api/documents` (session-scoped list) and `GET /api/health-profile` (computed system insights from observations).
- Upload page remains at `/app/upload` but is reachable from Documents CTA; x402 $0.01 on `POST /api/upload` unchanged.
- Health Profile uses **data coverage / educational framing** only—no "Critical", no organ health scores, no diagnostic language.

## Capabilities

### New Capabilities

- `app-shell`: Grouped sidebar navigation, app layout, and route structure for hackathon demo.
- `documents-hub`: Document list UI, type tabs, upload CTA, document cards with status and metadata.
- `health-profile`: Body-map visualization, system-level educational insights, records-used footer, disclaimer.
- `biomarkers-overview`: Biomarker table and trend charts (relocated from legacy Health card page).
- `documents-api`: Session-scoped document listing and `document_type` classification on ingest.
- `health-profile-api`: Server-side aggregation of observations into system insights for the profile view.

### Modified Capabilities

<!-- No existing openspec/specs baseline; upload and doctor-summary behavior preserved in code, not delta-spec'd here. -->

## Impact

- **Frontend**: `src/app/app/layout.tsx`, new sidebar component, new pages under `/app/documents`, `/app/profile`, `/app/biomarkers`; update `app-header.tsx` or replace with sidebar.
- **API**: New routes `GET /api/documents`, `GET /api/health-profile`; extend upload handler to set `document_type`.
- **Database**: Migration adding `document_type` (and optionally `ai_summary`) to `documents`.
- **Unchanged**: x402 middleware on `POST /api/upload` and `POST /api/doctor-summary`; Circle wallet auth; Supabase RLS patterns; medical safety rules in AI outputs.
