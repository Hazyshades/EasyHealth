## 1. Catalog module

- [x] 1.1 Add the single Knowledge Base catalog module: unique type/locale/slug identity, list, subject lookup, and fail-closed catalog validation.
- [x] 1.2 Map markdown measurement records into that catalog, including lifecycle `review` → `in_review`, without exporting a second published-lookup interface from `content.ts`.
- [x] 1.3 Map typed panel records (CBC) into the same catalog; keep panel layout fields on the panel record, not as a separate published catalog.
- [x] 1.4 Remove empty `MEASUREMENT_ARTICLES` and duplicate `KNOWLEDGE_BASE_ARTICLES` from the public barrel so one catalog name remains.

## 2. Publication admission

- [x] 2.1 Route public eligibility through one admission decision: published, reviewed, sourced, reviewed Registry/panel subject, not stale (365 days, injectable `asOf`).
- [x] 2.2 Point public measurement load, `/knowledge-base` readers, and `getKnowledgeArticleHref` at that decision.
- [x] 2.3 Stop admitting `in_review` panel education on public panel routes; keep signed-in CBC on a non-public reader.

## 3. Client seam

- [x] 3.1 Provide a JSON-safe published href projection so Biomarkers can resolve measurement-definition keys without importing filesystem catalog code.
- [x] 3.2 Add verification that client Knowledge Base imports do not pull the markdown filesystem loader.

## 4. Verification

- [x] 4.1 Cover duplicate identity, lifecycle mapping, stale withholding on hrefs and public reads, and in-review CBC hidden from the public overlay.
- [x] 4.2 Update EH-133/136/138/139/public-panel scripts to the catalog interface; drop source-text helper-name assertions that encode the old split.
- [x] 4.3 Confirm signed-in `/app/knowledge/panels/cbc` still renders in-review CBC and public `/knowledge/panels/cbc` falls back without the overlay.

## 5. OpenSpec completion

- [x] 5.1 Run focused Knowledge Base verifiers, typecheck, and `openspec validate collapse-knowledge-base-catalogs --type change --strict`; record only observed results.

Observed results (2026-09-05):

- `pnpm exec tsc --noEmit`: pass
- `tsx scripts/verify-eh133-knowledge-base.ts`: pass
- `tsx scripts/verify-eh134-knowledge-base.ts`: pass
- `tsx scripts/verify-eh135-panel-article.ts`: pass
- `tsx scripts/verify-eh136-knowledge-base-pages.ts`: pass (10 pages)
- `tsx scripts/verify-eh138-knowledge-base.ts`: pass
- `tsx scripts/verify-knowledge-base.ts`: pass
- `tsx scripts/verify-public-panel-education.ts`: pass
- `tsx scripts/verify-knowledge-base-catalog.ts`: pass
- `tsx scripts/verify-knowledge-base-client-imports.ts`: pass
- `tsx scripts/verify-eh140-knowledge-base.ts`: pass (31 files, no blocking findings)
- `tsx scripts/check-knowledge-base.ts --as-of 2026-09-05T12:00:00.000Z`: 10 articles, 10 published, 0 stale
- `openspec validate collapse-knowledge-base-catalogs --type change --strict`: valid
