## Context

The navigation hot-path merge introduced `src/app/app/documents/documents-hub.tsx` (client hub fed by a server wrapper) and `src/lib/documents/list.ts` (shared list query). Review found three defects:

- The thumbnail signed-URL cache seeding loop (`setCachedSignedUrl(thumbnailCacheKey(id), url, ttl)` per doc) exists twice: inside `loadDocuments`'s response handler and inside the reuse-server-list branch of the initial effect.
- `asDocuments()` claims `document_type: DocumentType` while the shared list type carries `document_type: string`. Nothing validates the narrowing.
- When `listDocumentsForProfile` fails server-side, `page.tsx` renders `<DocumentsHub initialDocuments={[]} skipInitialFetch={false} />`; the client refetch then typically fails too, and `.then((r) => r.json())` never checks `r.ok`, so the user sees an empty state that reads as "no documents".

Display code already falls back to the raw value when `DOCUMENT_TYPE_LABELS` lacks a key, so an unexpected `document_type` string is renderable today — only the type claim is false.

## Goals / Non-Goals

**Goals:**

- One implementation of thumbnail-cache seeding, used by both list paths.
- A hub type boundary that makes no unverifiable claim about `document_type`.
- List-load failures from both the server initial payload and client fetches are visible, in English, and recoverable via Retry.
- Hot-path budgets unchanged: no new requests on first paint success path.

**Non-Goals:**

- Changing `GET /api/documents`, `listDocumentsForProfile`, or error payloads.
- Server-side normalization of `document_type` values.
- Error handling for tab-specific processing polls beyond reusing the same state.
- Viewer, upload, or worker error states.

## Decisions

### 1. One helper owns cache seeding

Extract `cacheThumbnailUrls(docs)` (module-private in `documents-hub.tsx`) iterating rows and calling `setCachedSignedUrl` when both URL and TTL exist. Call it from `loadDocuments`'s response handler and from the reuse branch.

**Alternative:** move list-level caching into `@/lib/documents/signed-url-cache` (`cacheSignedUrls`). Rejected: one consumer today; promote if a second appears.

### 2. Widen the boundary instead of casting

Delete `asDocuments`. Local view type becomes `Omit<DocumentListItem, "document_type"> & { document_type: string }`, assigned straight from `initialDocuments`. Label rendering keeps its fallback to the raw value; equality-based filter/tab logic is unaffected; `UPLOAD_LINKS`/`TABS` lookups stay keyed by the separately-typed `activeTab`. Plain `string` was chosen over `DocumentType | (string & {})`: same contract without lint exposure to empty-object types.

**Alternative:** a runtime guard filtering unknown-type rows out of the table. Rejected: silently hides user documents to satisfy a type. **Alternative:** normalize types in `list.ts` against known values. Rejected: broader blast radius across API consumers for a UI-layer smell.

### 3. Single `loadError` state covers both sources

Add `initialLoadFailed?: boolean` hub input plus internal `loadError` state. Set `loadError` when (a) the server initial load failed (prop), or (b) a client fetch returns non-ok or rejects. Render an error `SurfaceCard` with static English copy and a Retry button that calls `loadDocuments({ soft: false })`. Any successful response clears `loadError`. Empty-state renders only after a successful load with zero rows; skeleton only during hard loads. Copy stays generic — no server error text reaches the UI (server already logs details).

**Alternative:** toast-only notification. Rejected: the failure is persistent state, it needs a persistent surface with an action.

## Risks / Trade-offs

- **[Risk] Plain `string` drops autocomplete** on `document_type` in hub code. → Mitigation: impact limited to display/equality; tab state keeps its own strict union.
- **[Risk] Retry doubles as the poll entry point and could mask a stuck poll loop.** → Mitigation: Retry triggers one hard load; existing 10s poll behavior unchanged.
- **[Trade-off] Generic error copy hides root cause from users.** Intentional: server logs carry specifics; the UI must not leak query errors.
