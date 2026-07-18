## Why

Documents hub and document open feel slow because the client over-fetches: a 10s processing poll remounts the list and re-requests every thumbnail; opening a document chains 4–5 sequential authenticated API calls before paint. Shared per-request auth (`getUser` + `ensureProfile` + ownership SELECT) multiplies latency on every load endpoint. We need faster perceived and real load times for list, open, and related read APIs without changing product behavior.

## What Changes

- Fix documents list polling so background refresh does **not** set full-page loading or remount thumbnails (eliminates periodic `/thumbnail` storms).
- Stop N+1 thumbnail fetches: embed signed thumbnail URLs (or a batch-safe path) in list responses; cache signed URLs client-side for their TTL.
- Collapse document-open waterfall: single bootstrap (or parallel) load for meta + biomarkers/observations + file/page signed URLs; progressive UI (shell/meta first, not one blocking "Loading document…").
- Fix document viewer reload bug: page navigation must not re-fetch full document + biomarkers + file.
- Slim session resolution on read APIs: resolve profile id without redundant `ensureProfile` DB work on every request (ensure once at login/layout; hot path uses auth user id).
- Audit and optimize other client load paths that share the same anti-patterns (dashboard multi-fetch, reports list loading flash, biomarkers reload) where cheap wins apply.
- Keep existing security: ownership checks, signed storage URLs only (no raw paths), English UI copy.

**Not in scope:** worker/OCR/AI pipeline speed, CDN redesign, new client data library mandate (SWR/React Query optional, not required), DICOM.

## Capabilities

### New Capabilities

- `documents-loading-performance`: Performance requirements for documents list/open fetch orchestration, polling, thumbnail/signed-URL delivery, and progressive loading behavior.

### Modified Capabilities

- `documents-hub`: List loading/polling UX must soft-refresh; thumbnails must not re-fetch every poll.
- `documents-api`: List may include signed thumbnail URLs; optional detail bootstrap / richer single-response open payload; session-hot-path efficiency expectations for document GETs.
- `document-viewer`: Open must not block paint on full multi-endpoint waterfall; page change must only load page preview; progressive load of panels.

## Impact

- **Domain:** documents (primary); light touch auth-shell session helper and other pages that call the same load APIs.
- **API:** `GET /api/documents`, `GET /api/documents/[id]` (+ optional bootstrap query or expanded payload), `GET .../thumbnail`, `.../file`, `.../pages/*`, `.../biomarkers`, `.../observations`; shared `getSessionProfileId` / access helpers.
- **UI:** `src/app/app/documents/page.tsx`, `src/app/app/documents/[id]/page.tsx`, `src/components/documents/document-viewer.tsx`; secondary soft-load fixes on dashboard/reports/biomarkers if patterns match.
- **Deps:** none new required; Supabase signed URLs and auth unchanged in product terms.
- **Risk:** over-eager caching of signed URLs past TTL; must refresh when near expiry. Bootstrap payload size for large biomarker lists should stay acceptable.
