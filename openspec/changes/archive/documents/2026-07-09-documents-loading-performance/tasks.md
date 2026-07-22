## 1. Session hot path

- [x] 1.1 Slim `getSessionProfileId` (or add fast helper used by read APIs): return `user.id` after `auth.getUser()` without `ensureProfile` on every request
- [x] 1.2 Confirm profile ensure still runs on auth callback / app entry (login, session bootstrap, onboarding layout) so missing-profile edge cases stay covered
- [x] 1.3 Smoke-check a few GETs (`/api/documents`, `/api/profile`, `/api/biomarkers`) still authorize correctly after the slim

## 2. Documents list: kill poll + thumbnail storm

- [x] 2.1 Split initial vs soft refresh in `documents/page.tsx`: never `setLoading(true)` on the 10s processing poll
- [x] 2.2 Keep previous rows visible during soft refresh; only show full "Loading documents…" on first load / tab change
- [x] 2.3 Stabilize poll effect so interval is not needlessly recreated every documents array identity change (deps on "hasProcessing" boolean, not full array churn)
- [x] 2.4 Extend `GET /api/documents` to attach signed `thumbnail_url` + `thumbnail_expires_in` with bounded parallel signing; degrade per-item on sign failure
- [x] 2.5 Update `DocumentThumb` to prefer list `thumbnail_url`; remove mount-time N+1 `/thumbnail` when URL present
- [x] 2.6 Add small client cache for thumbnail URLs (by document id + expiry) for fallback/thumbnail endpoint path

## 3. Document detail API bootstrap

- [x] 3.1 Expand `GET /api/documents/[id]` to load owned document once, then parallelize pages, type panels, biomarker count/list, observations as needed
- [x] 3.2 Include signed original file payload and signed page-1 (or `?page=`) preview in the detail response
- [x] 3.3 Keep dedicated `/file`, `/pages/[n]`, `/biomarkers`, `/observations`, `/thumbnail` working for download, page nav, accept/reprocess refresh
- [x] 3.4 Ensure response still uses no raw storage paths; ownership errors unchanged (401/404)

## 4. Document viewer client

- [x] 4.1 Refactor `DocumentViewer` to one bootstrap detail fetch for initial open; map response into existing state shapes
- [x] 4.2 Remove `currentPage` from the full-document load effect; page changes only fetch page preview (or use cache)
- [x] 4.3 Soft processing poll (existing ~8s): refresh without full-page `Loading document…` gate
- [x] 4.4 Fix `[id]/page.tsx` params handling so there is no extra params-only loading stage before the viewer
- [x] 4.5 Parallelize any remaining client secondary fetches if bootstrap is partial; accept/reprocess still refresh via existing endpoints

## 5. Broader load-endpoint audit (light)

- [x] 5.1 Audit dashboard (`/app`), reports list, biomarkers, reports create document picker for `setLoading(true)` flashes and needless remounts; apply soft-refresh only where cheap and user-visible
- [x] 5.2 Confirm no other `setInterval` paths re-trigger document thumbnail storms
- [x] 5.3 Optional: shared tiny `signedUrlCache` helper used by thumbs/pages/file if duplication appears

## 6. Verification

- [x] 6.1 Manual Network: open `/app/documents` with a processing doc — over 30s, poll may hit list API but MUST NOT re-fire `/thumbnail` for every row each cycle
- [x] 6.2 Manual Network: open a document detail — primary path is one detail GET (plus at most page nav later); no 4–5 sequential pre-paint chain
- [x] 6.3 Manual: page navigation on multi-page doc does not re-download biomarkers/file
- [x] 6.4 Manual: download original, accept biomarkers, reprocess still work
- [x] 6.5 Regression: empty list, failed docs, legacy docs without previews, type tabs, DICOM coming-soon unchanged in product behavior
