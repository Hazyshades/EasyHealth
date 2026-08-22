## Why

A post-merge review of the navigation hot-path change found two maintainability defects in the Documents hub — the thumbnail signed-URL cache seeding loop is duplicated across the client-fetch and initial-list paths, and `asDocuments` narrows `document_type` from `string` to the `DocumentType` union without any runtime check — plus one user-visible gap: when the server-side initial list fails, the hub renders a silent empty state instead of an error.

## What Changes

- Extract thumbnail-cache seeding into a single helper called from both the `GET /api/documents` response path and the reuse-server-list path.
- Remove the unchecked cast at the hub boundary so rows with unexpected `document_type` values still render (label fallback already exists) instead of relying on a false type claim.
- Surface documents list failures from both sources — failed server initial load and failed client fetch — in a visible error state with a Retry action; empty-state copy stops masking errors.
- Record the failure-state contract in QA evidence and keep the hot-path verification suite green.

Domain: **documents**. Affected capability spec IDs from `openspec/specs/`: `documents-hub`, `documents-loading-performance` (evidence only).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documents-hub`: adds a requirement that list-load failures are surfaced with a recoverable state instead of rendering as an empty list.
