# EH-155: Structured assistant retrieval

**Roadmap status:** In progress
**Build / environment:** Reviewed Sprint 8 build, local or staging Supabase, invited synthetic beta profile
**Test run date:** PENDING
**Tester:** PENDING

## What this checklist covers

Structured assistant retrieval from eligible observations and accepted document findings, with profile ownership and bounded filters.

## Before you start

- Use two synthetic profiles, `EH155-PROFILE-A` and `EH155-PROFILE-B`.
- Use only de-identified documents and values that are safe to expose in a test environment.
- Give Profile A one completed lab result, one accepted clinical note, and one rejected or incomplete document.
- Give Profile B different values and document IDs.
- Confirm the assistant is enabled only for the invited profile.

## Interface checks

### EH155-UI-01: Ask for a recorded result

1. Open **Ask about records** as `EH155-PROFILE-A`.
2. Ask: `What is in my latest lab result?`.
3. Submit once.

**Expected:** The answer uses only Profile A eligible records. Each personal statement has a source link. Rejected, incomplete, archived, or deleting documents do not appear.

**Result:** PENDING

### EH155-UI-02: Apply a document and date filter

1. Ask a question that references the completed lab result.
2. Repeat with a document-type or date filter when the interface exposes it.
3. Compare the source list with the unfiltered answer.

**Expected:** Filters narrow the returned source set. A date range outside the record returns a limited personal answer rather than an invented value.

**Result:** PENDING

### EH155-UI-03: Verify cross-profile isolation

1. Ask the same question as `EH155-PROFILE-A`.
2. Sign out and ask it as `EH155-PROFILE-B`.
3. Compare citations and visible values.

**Expected:** No source ID, filename, observation, note, or value from Profile A is visible to Profile B.

**Result:** PENDING

## Developer evidence

- `pnpm test:eh155`
- `pnpm typecheck`
- `supabase/tests/eh156_assistant_semantic_retrieval.sql` profile and privilege assertions consume the same ownership boundary used by semantic retrieval.
- Record the exact synthetic profile/document IDs and query filters. Do not paste source excerpts into retained logs.

## Limitations

No production claim is made until a reviewed environment proves profile isolation with real authentication, active document state, and the deployed retrieval route.
