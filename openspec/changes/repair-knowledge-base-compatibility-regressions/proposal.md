## Why

The EH-135 panel Knowledge surface introduced two regressions against the already-implemented EH-133/EH-134 contracts: the public Knowledge Base index stopped exporting `measurementEducationArticleSchema`, and the existing `/app/biomarkers` breadcrumb label was dropped while adding the Knowledge label. Both changes are small compatibility breaks that can remain hidden because the current focused verifiers do not exercise those exact public boundaries.

## What Changes

- Restore `measurementEducationArticleSchema` in the public exports from `src/lib/knowledge-base/index.ts` without changing the canonical schema or article model.
- Restore the existing `healthRouteLabel` mapping for `/app/biomarkers` while retaining the new `/app/knowledge` and nested Knowledge mapping.
- Add regression assertions to the existing EH-134 and EH-131 verification commands so both compatibility boundaries are protected.
- Keep the repair limited to public exports, navigation labeling, and their focused verification; do not alter EH-135 panel content, result projection, Registry data, resolver behavior, assessment behavior, persistence, or the publication state of the CBC preview.

## Capabilities

### New Capabilities

- `knowledge-base-compatibility`: Preserve the public EH-133/EH-134 Knowledge Base schema surface and existing health-navigation route labels when adding panel education routes.

### Modified Capabilities

- None. No existing canonical capability specification under `openspec/specs/` changes its product requirements; this is a compatibility repair for implementation regressions.

## Impact

- **Target domains:** `health-profile` (Knowledge Base public contract) and `auth-shell` (authenticated app navigation labels).
- **Affected code:** `src/lib/knowledge-base/index.ts`, `src/lib/health-navigation.ts`, `scripts/verify-eh134-knowledge-base.ts`, and `scripts/verify-eh131-health-navigation.ts`.
- **Existing boundaries preserved:** EH-133 article schemas remain authoritative; EH-134 measurement routes and view models remain unchanged; EH-135 Knowledge routes continue using the app authentication boundary and the `Knowledge` breadcrumb label.
- **Operational scope:** no database, Registry catalog, generated biomarker documentation, API, or user-data behavior changes. Verification is pure and uses existing synthetic fixtures.
