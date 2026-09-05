## 1. Prerequisite and article-page module

- [x] 1.1 Confirm `collapse-knowledge-base-catalogs` admission is the public gate before switching routes.
- [x] 1.2 Extract one article-page module that renders title, last reviewed date, sources, body, medical disclaimer, and type-specific measurement/panel sections.

## 2. Adapters

- [x] 2.1 Point public `/knowledge/biomarkers/<slug>` and public panel education overlay at the public adapter (catalog public reader only, no Observations).
- [x] 2.2 Point signed-in `/app/knowledge` article routes at the signed-in adapter (same module plus existing profile-scoped results strip; non-public reader only for `in_review` CBC).
- [x] 2.3 Make `/app/knowledge/measurements/<slug>` use the shared catalog and `notFound` when no signed-in-readable article exists.

## 3. Canonical URLs

- [x] 3.1 Keep `/knowledge`, `/knowledge/biomarkers/<slug>`, and `/knowledge/panels/<key>` as the public URL family; update `KNOWLEDGE_BASE_ROUTE` and href helpers.
- [x] 3.2 Replace `/knowledge-base` and `/knowledge-base/<slug>` with permanent redirects to the matching `/knowledge` path or `/knowledge` when the slug is missing or not public.
- [x] 3.3 Send deprecated `/knowledge-base` slugs to the catalog replacement’s `/knowledge` path, never an external URL.

## 4. Cleanup

- [x] 4.1 Delete unused duplicate templates once public and signed-in routes share the article-page module.
- [x] 4.2 Keep `/knowledge` search index and `/app/knowledge` home as separate pages, not a third article template.

## 5. Verification

- [x] 5.1 Cover public measurement/panel render without Observations, signed-in CBC still available while `in_review`, and `/knowledge-base` redirects (index, published slug, unknown/non-public slug, deprecated slug).
- [x] 5.2 Update EH-134/135/136/138/139/public-panel verifiers off `/knowledge-base` as a live tree; drop source-text assertions that encode the old split.
- [x] 5.3 Run focused Knowledge Base route verifiers, typecheck, and `openspec validate collapse-knowledge-base-route-adapters --type change --strict`; record only observed results.

Observed 2026-09-05:

- `pnpm exec tsc --noEmit` passed
- `tsx scripts/verify-eh134-knowledge-base.ts` passed
- `tsx scripts/verify-eh135-panel-article.ts` passed
- `tsx scripts/verify-eh136-knowledge-base-pages.ts` passed (10 published pages)
- `tsx scripts/verify-eh138-knowledge-base.ts` passed
- `tsx scripts/verify-knowledge-base.ts` passed
- `tsx scripts/verify-knowledge-base-routes.ts` passed
- `tsx scripts/verify-public-panel-education.ts` passed
- `tsx scripts/verify-eh140-knowledge-base.ts` passed (33 files, no blocking findings)
- `tsx scripts/verify-knowledge-base-client-imports.ts` passed
- `tsx scripts/verify-knowledge-base-catalog.ts` passed
- `openspec validate collapse-knowledge-base-route-adapters --type change --strict` passed
