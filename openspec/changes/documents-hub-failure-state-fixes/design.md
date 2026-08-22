## Context

`DocumentsPage` passes an empty initial list and `initialLoadFailed` to `DocumentsHub` when `listDocumentsForProfile` fails. The hub currently starts a hard client load in that state, prioritizes its skeleton over the error card, and clears the error if that automatic request succeeds. Its periodic processing-status refresh also suppresses failures because soft loads do not set `loadError`. The current QA procedure blocks only the browser endpoint, which does not exercise the failed server-wrapper path when SSR succeeds.

## Goals / Non-Goals

**Goals:**

- Show the generic error card and Retry action as the first Documents Hub content after a failed server initial list.
- Treat every failed client list request, including a periodic refresh, as a recoverable list failure.
- Preserve list rows during successful periodic refreshes; never show a hard-load skeleton for those refreshes.
- Provide manual QA steps that independently reproduce server-initial and browser client-fetch failures.

**Non-Goals:**

- Change `listDocumentsForProfile`, `GET /api/documents`, response payloads, or server error logging.
- Add a production failure-injection interface.
- Change document upload, viewer, processing, or signed URL behavior.

## Decisions

### 1. Preserve the failed initial result until an explicit user action

When the initial server result failed on the initial Lab results tab, consume that initial state without starting `loadDocuments`; initialize the visible state so the error card wins over a skeleton. Retry remains the explicit hard client request and clears the error only after a successful response.

**Alternative:** automatically refetch and show the error only if that request also fails. Rejected: it violates the server-failure scenario and can erase evidence of the failure.

### 2. Record soft-fetch failures without making them hard loads

The shared `loadDocuments` failure path sets `loadError` for both soft and hard requests. Only hard requests update `loading`, so a successful periodic refresh still leaves current rows visible while a failed periodic refresh moves to the recoverable error card.

**Alternative:** ignore periodic failures until a user changes tabs. Rejected: a failed client list request would remain invisible and leave stale processing status presented as current.

### 3. QA uses distinct failure sources

The checklist will distinguish a server-wrapper failure produced by making the server's document-list dependency unavailable before navigating to Documents, and a browser endpoint failure produced by blocking `GET /api/documents` before a tab change or Retry. It will require restoration of the dependency/request path and verification that Retry restores a normal list or genuine empty state without exposing error details.

**Alternative:** one endpoint-blocking procedure for both cases. Rejected: successful SSR consumes the initial list and does not issue the browser endpoint request.

## Risks / Trade-offs

- **[Risk]** A periodic failure replaces visible rows with the error card. **Mitigation:** this is intentional contract compliance; Retry gives a direct recovery path and successful periodic updates still retain rows with no loading flash.
- **[Risk]** Local server-dependency failure setup varies by developer environment. **Mitigation:** state the required condition and observable result rather than inventing a production-only test control.
