## Why

The Knowledge Base index duplicates Body system and panel membership in `CATEGORY_BY_SLUG` and `RELATED_PANEL_KEYS_BY_SLUG`. The article template then asks those maps again, while `listPanelsForMeasurementDefinition` already knows membership. A new measurement definition cannot appear in search or related-panel links without a slug row, so the Registry is not the seam.

## What Changes

- Deepen the Knowledge Base index projection: Body system (education category) and panel membership come from the Registry at read time. Delete the slug tables.
- **BREAKING** (index grouping): a published article with no named Body system (`general` only, or no reviewed assessment binding) is omitted from category grouping rather than given a hand-maintained slug category. Panel-related links use Registry membership, not `RELATED_PANEL_KEYS_BY_SLUG`.
- Keep curated `relatedMeasurementKeys` on the article. Do not copy assessment score role, readiness groups, or bindings onto catalog records.
- Keep catalog identity, publication admission, public vs signed-in routes, and CBC Registry lookup on the client unchanged. Do not republish CBC.

## Capabilities

### New Capabilities

- `knowledge-base-index-projection`: Registry-derived Body system category and panel membership for Knowledge Base index, filters, and related-panel links; no per-slug membership tables.

### Modified Capabilities

- None in `openspec/specs/`. Archived EH-138 `knowledge-base-navigation` never landed in the main spec tree; this change is the first main-tree contract for index projection ownership. It does not reopen `knowledge-base-catalog` identity or `knowledge-base-article-page` routes.

## Impact

- Target domain: Knowledge Base product surface (health-profile Body system vocabulary; Registry panel membership).
- `src/lib/knowledge-base/navigation.ts`, `navigation-types.ts`, `src/components/knowledge-base/biomarker-article.tsx`, `src/app/knowledge/page.tsx`, EH-138 verifier (`scripts/verify-eh138-knowledge-base.ts`).
- Reads existing `listPanelsForMeasurementDefinition` and reviewed assessment-binding Body system. No Registry catalog edits, no new bindings, no database, no Observation reads.
- Soft prerequisite: `collapse-knowledge-base-catalogs` so the index reads one published catalog. Independent of `collapse-knowledge-base-route-adapters`.
