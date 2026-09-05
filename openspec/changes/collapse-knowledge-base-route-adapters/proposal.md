## Why

Public education, publication-gated education, and signed-in education are three shallow route adapters for the same Knowledge Base article. After `collapse-knowledge-base-catalogs` gives one catalog and one admission rule, three page trees still re-implement layout, disclaimer, and lookup. New article types cannot land in one place.

## What Changes

- Deepen one Knowledge Base article-page module. Public vs signed-in become adapters: Observation strip off vs on. Measurement and panel articles share that module; type-specific sections stay in implementation, not in a second page tree.
- **BREAKING** (public URLs): `/knowledge` is the canonical public Knowledge Base. `/knowledge-base` and `/knowledge-base/<slug>` permanently redirect to the matching `/knowledge` index or article. Biomarkers hrefs already use `/knowledge/biomarkers/<slug>` and stay there.
- Signed-in `/app/knowledge` remains the profile-scoped adapter. It may render `in_review` CBC through the non-public catalog reader from change 1; public routes still fail closed.
- Collapse duplicate article templates (`biomarker-article`, `measurement-article`, `article-page`, and the two panel templates) into the one article-page module plus the two adapters.
- Keep Registry, Observation, Health Profile, assessment, `CATEGORY_BY_SLUG`, and CBC Registry lookup on the client unchanged. Do not republish CBC.

## Capabilities

### New Capabilities

- `knowledge-base-article-page`: one article-page module for Knowledge Base measurement and panel articles; public adapter without Observations; signed-in adapter with the existing profile-scoped results strip; canonical `/knowledge` URLs and safe redirects from `/knowledge-base`.

### Modified Capabilities

- None in `openspec/specs/`. Depends on in-flight `knowledge-base-catalog` from `collapse-knowledge-base-catalogs`; this change does not reopen catalog identity or admission.

## Impact

- Target domain: Knowledge Base product surface (auth-shell for `/app/knowledge` and nav; health-profile for Observation-row hrefs that already point at `/knowledge`).
- `src/app/knowledge/**`, `src/app/knowledge-base/**`, `src/app/app/knowledge/**`, `src/components/knowledge-base/**`, `src/components/knowledge/panel-article-template.tsx`, `KNOWLEDGE_BASE_ROUTE`, nav items, and Knowledge Base route verifiers (`scripts/verify-eh134*`, `verify-eh135*`, `verify-eh136*`, `verify-eh138*`, `verify-knowledge-base.ts`, `verify-public-panel-education.ts`).
- Prerequisite: `collapse-knowledge-base-catalogs` (one catalog, one admission decision, `in_review` not public).
- No database migration, Registry catalog change, Observation write path, or score/assessment change.
