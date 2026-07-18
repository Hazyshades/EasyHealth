## Context

Documents UX is dominated by client-driven fetch orchestration over Supabase-backed Next.js route handlers.

**Current pain (observed):**

1. **List poll storm** (`/app/documents`): if any document is `processing`, `setInterval(loadDocuments, 10000)` runs. `loadDocuments` calls `setLoading(true)`, which unmounts the table and all `DocumentThumb` components. On remount each thumb does `GET /api/documents/:id/thumbnail` → auth + owner + signed URL. Result: periodic N+1 thumbnail storms.

2. **Document open waterfall** (`/app/documents/[id]`): `DocumentViewer` sets `loading=true` until sequential/chained:
   - `GET /api/documents/:id`
   - then biomarkers + observations (sequential inside lab path) + file
   - then page signed URL  
   Page also waits on `params` Promise before mounting viewer. `currentPage` is in the main load effect deps → page flips re-run full reload.

3. **Per-request auth tax**: every document GET uses `getSessionProfileId()` → `auth.getUser()` + `ensureProfile()` (profiles SELECT). Then `assertDocumentOwner` does another full documents SELECT. Multiplying this across 5 calls ≈ multi-second open even when queries are simple.

4. **Other load endpoints** (secondary): dashboard fans out `documents` + `health-profile` + `profile`; reports list always full-screen loads; no shared client cache. Same session tax applies to `/api/biomarkers`, `/api/reports`, etc.

**Constraints:** EN-first UI; ownership + signed URLs only; no raw storage paths; processing poll still needed for in-flight jobs; keep x402/upload behavior unchanged.

## Goals / Non-Goals

**Goals:**

- Eliminate thumbnail request storms on list polling and tab revisits.
- Cut document-open time dramatically (target: first meaningful paint ≤ ~1–2s under normal latency; full panels progressive).
- Reduce redundant auth/DB work on read-path APIs.
- Soft-refresh patterns for background/list reloads (no flash empty loading when data already shown).
- Keep security model (session + ownership + signed TTL URLs).

**Non-Goals:**

- Speeding worker OCR/LLM pipeline.
- Mandating React Query/SWR (allowed if tiny helper is enough).
- Changing signed URL TTL product policy (default remains 900s).
- GraphQL or BFF rewrite outside documents.
- Prefetch CDN or image optimization service.

## Decisions

### D1 — Soft list refresh (must-fix)

**Decision:** Split initial load vs background refresh.

- Initial / tab change: `loading=true` allowed.
- Poll / silent refresh: update `documents` **without** `setLoading(true)`; keep previous rows visible (optional subtle indicator only if needed later).

**Why:** Stops remount → stops thumbnail re-fetch cascade. Smallest diff, largest win for the reported 10s storm.

**Alternatives:** Keep loading but preserve thumb cache only — still flashes UI and re-runs effects if unmounted.

### D2 — Thumbnail URLs from list API (batch sign)

**Decision:** Extend `GET /api/documents` items with optional `thumbnail_url` + `thumbnail_expires_in` when `thumbnail_storage_path` is set. Sign in the list handler (bounded concurrency, e.g. 8–10 parallel `createSignedUrl` calls). Client `DocumentThumb` uses list-provided URL; falls back to `/thumbnail` only if missing.

**Why:** Removes N+1 HTTP + N× auth/owner for list. One list request carries previews.

**Alternatives:**

- Dedicated `POST /api/documents/thumbnails` batch — extra round trip.
- Client module cache only — still N requests on first mount.

Keep `GET .../thumbnail` for detail/legacy callers.

### D3 — Document open bootstrap

**Decision:** Expand `GET /api/documents/[id]` (or `?include=viewer`) to return in one response:

- existing document meta + pages meta + type-specific panels
- extracted biomarkers (when applicable) and/or observations
- signed URLs: `file` (original), `page` for requested/current page (default 1), optional `thumbnail`

Client `DocumentViewer`:

1. One bootstrap fetch.
2. Paint shell + meta + status immediately when bootstrap returns (or progressive: show chrome before biomarkers if we later split — v1 single bootstrap is enough).
3. Biomarker accept / reprocess / page change remain separate endpoints.
4. **Remove `currentPage` from the full-reload effect**; page change only calls page URL endpoint (or uses preloaded page 1 from bootstrap).

**Why:** One auth + one owner check + parallel DB/sign work server-side beats 4–5 client round trips.

**Alternatives:** Only parallelize client fetches without API change — still 4× session tax.

### D4 — Slim session on hot path

**Decision:** Change `getSessionProfileId` (or add `getSessionUserIdFast`):

- After `auth.getUser()`, if `user.id` present, return `user.id` **without** calling `ensureProfile` on every request.
- Keep `ensureProfile` at login/callback/layout bootstrap (already runs in app layout via onboarding helpers that touch profile).

Document that profile row creation remains the responsibility of auth entry paths; read APIs assume profile id = auth user id (existing invariant).

**Why:** Removes 1 Supabase round trip per API call across documents and other GETs.

**Alternatives:** In-memory request memo of profile — helps less across separate HTTP requests.

### D5 — Optional request-scoped memo of owned document

**Decision:** Within a single route handler that needs doc multiple times, reuse one `getOwnedDocument` result. For bootstrap, load document once then parallel child queries.

No cross-request server cache required in v1.

### D6 — Viewer params / loading copy

**Decision:** Resolve `id` without artificial double loading: use React `use(params)` or pass id from unwrapped params so first paint is viewer loading, not params loading. Progressive: do not block entire page on secondary assets if bootstrap already has meta (v1: one spinner until bootstrap completes is OK if bootstrap is single and fast).

### D7 — Secondary load endpoints (audit, light fixes)

Apply only cheap consistent fixes:

| Surface | Fix |
|---------|-----|
| Documents list poll | Soft refresh (D1) |
| Document viewer poll (8s while processing) | Soft refresh meta/biomarkers; no full loading gate |
| Reports list | Prefer keep previous data when filter changes if easy; avoid unnecessary remounts |
| Dashboard triple fetch | Keep parallel; relies on D4 for session tax; no mega-endpoint required |
| Biomarkers page | No poll storm today; benefits from D4 only |
| Thumbnail endpoint | Remain; used as fallback |

### D8 — Client signed-URL cache (small)

**Decision:** Tiny module-level or component cache: `documentId → { url, expiresAt }`. Reuse until ~60s before TTL. Used by thumbs if list URL present and by page/file if re-fetched.

## Architecture (target open path)

```
BEFORE (client waterfall)
  auth×5  owner×5  data×5  →  Loading document… 10s

AFTER
  Client ──1×──▶ GET /api/documents/:id?include=viewer
                    │
                    ├─ getUser (no ensureProfile)
                    ├─ getOwnedDocument once
                    ├─ parallel: pages, biomarkers, observations, type panels
                    └─ parallel: sign file + page1
                    │
  Client ◀──────────┘ paint meta + preview + panels
  page flip ──▶ GET pages/n only (or cache)
```

## List poll (target)

```
processing exists?
  every 10s → GET /api/documents?type=…  (soft, no loading)
                items include thumbnail_url
                DocumentThumb: same URL props → no remount storm
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| List sign latency if many thumbs | Cap concurrency; sign only for returned page of results; omit URL if sign fails (icon fallback) |
| Bootstrap payload large (many biomarkers) | Acceptable for single document; select needed columns only |
| Skipping ensureProfile leaves missing profile edge case | Auth callback + layout already ensure; log and 401/500 if FK fails later |
| Signed URL expiry while tab open | Client cache respects TTL; refresh on 403/expired |
| Behavior change if poll stops updating status | Soft refresh still updates status fields in place |
| Over-fetch type panels for wrong type | Keep conditional server branches by `document_type` |

## Migration Plan

1. Ship session slim (D4) — low risk, global win.
2. Soft list refresh (D1) — kills storm immediately.
3. List thumbnail_url (D2) + DocumentThumb.
4. Bootstrap detail (D3) + viewer refactor + page-nav fix.
5. Soft viewer processing poll; light secondary pages.
6. Manual Network verify: open document, leave list with processing doc open 30s — thumbnails not re-fetched every 10s.

Rollback: feature is additive for list fields; client can ignore `thumbnail_url`. Bootstrap can be gated by query flag if needed.

## Open Questions

- Exact query flag vs always-on expanded detail payload: prefer **always expand detail GET for viewer consumers** and keep list lean; viewer is the only heavy client of detail.
- Whether to add `ETag` / short `Cache-Control` private for list: defer; stick to soft client refresh + fewer requests first.
