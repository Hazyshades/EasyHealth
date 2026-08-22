## Why

The recently shipped Documents Hub failure state does not immediately surface a failed server-provided initial list, silently ignores periodic refresh failures, and its manual QA path cannot reproduce the server failure scenario. This leaves users without the recoverable error state promised by the Documents Hub contract.

## What Changes

- Render the Documents Hub error card immediately when the server initial Lab results list fails; do not hide that failure behind an automatic client request.
- Surface failed periodic `GET /api/documents` refreshes with the same recoverable error state while preserving the existing no-loading-flash behavior on successful background refreshes.
- Correct the Documents Hub QA checklist so it separately verifies server-initial and client-fetch failure paths, successful Retry recovery, generic error copy, and genuine empty-state behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documents-hub`: tightens the list-failure requirement to cover immediate server-initial failure presentation and failed background refreshes, with an executable manual QA contract.
