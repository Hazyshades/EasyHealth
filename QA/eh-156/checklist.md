# EH-156: Semantic document retrieval

**Roadmap status:** In progress
**Build / environment:** Reviewed Sprint 8 build, local or staging Supabase with `vector` enabled, worker running
**Test run date:** PENDING
**Tester:** PENDING

## What this checklist covers

Page-aware narrative chunks, asynchronous re-indexing, profile-scoped vector search, stale-source handling, and deletion isolation.

## Before you start

- Use two synthetic profiles, `EH156-PROFILE-A` and `EH156-PROFILE-B`.
- Upload one de-identified multi-page narrative document for each profile with distinct phrases.
- Wait for OCR/process completion and the assistant re-index job to complete.
- Do not use real medical records or real provider credentials in manual testing.

## Interface checks

### EH156-UI-01: Retrieve a narrative phrase

1. Open **Ask about records** as `EH156-PROFILE-A`.
2. Ask for a phrase that appears only on page 2 of Profile A's narrative document.
3. Submit the request.
4. Open the returned citation.

**Expected:** The answer uses the matching narrative page when available. The citation identifies the document and page. Profile B's narrative is not included.

**Result:** PENDING

### EH156-UI-02: Observe index-unavailable behavior

1. Use a newly processed synthetic document before its re-index job completes.
2. Ask for a phrase from that document.

**Expected:** The UI remains usable. If no semantic source is available, it states that narrative search is unavailable or provides a limited answer without inventing content.

**Result:** PENDING

### EH156-UI-03: Delete the source document

1. Create a semantic-source answer for Profile A.
2. Delete the source through the supported document deletion flow.
3. Ask the same question after deletion completes.

**Expected:** The deleted document and its page chunks are absent from citations. No stale chunk or re-index job is exposed.

**Result:** PENDING

## Developer evidence

- `pnpm test:eh156`
- `pnpm test:eh156-db`
- `pnpm typecheck:worker`
- Confirm the vector extension, HNSW index, queue claim/completion/failure RPCs, profile RLS, and document cascade checks pass.
- Record stale write-generation and deletion-worker evidence separately from the UI result.

## Limitations

Production embedding availability, provider spend, and restore/replay behavior remain release gates tracked by EH-161.
