## 1. Hub boundary and dedup

- [x] 1.1 Extract `cacheThumbnailUrls(docs)` in `documents-hub.tsx` and call it from both the `loadDocuments` response handler and the reuse-server-list branch.
- [x] 1.2 Remove `asDocuments`; widen the hub view type to plain `string` for `document_type` and assign `initialDocuments` directly, keeping the label fallback rendering.

## 2. Failure surfacing

- [x] 2.1 Add `initialLoadFailed?: boolean` input and a `loadError` state; set it from the prop and from non-ok/rejected client fetches.
- [x] 2.2 Render the error card with Retry (hard reload via `loadDocuments`), clear on any success, and gate the empty state behind successful loads only.
- [x] 3.1 Extend `QA/app-navigation-hot-path/checklist.md` with a failure-state manual check (blocked initial load shows error + Retry).
- [x] 3.2 Run `pnpm typecheck`, `pnpm test:app-navigation-hot-path`, and `openspec validate documents-hub-review-fixes --strict`.
