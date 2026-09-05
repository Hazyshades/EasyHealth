## Context

Knowledge Base now has three catalogs that share a name:

- Markdown corpus: `content/knowledge/biomarkers/manifest.json` plus bodies, loaded by `src/lib/knowledge-base/content.ts` for `/knowledge/biomarkers`.
- Empty typed measurement catalog: `MEASUREMENT_ARTICLES` in `measurement-articles.ts`, still the lookup used by `/app/knowledge/measurements`.
- Typed panel catalog: `PANEL_ARTICLES` / `CBC_PANEL_ARTICLE` in `panel-articles.ts`, used by `/app/knowledge` and overlaid on `/knowledge/panels`.
- Publication mapper: `content/knowledge-base/articles.ts` remaps the markdown corpus into a second `KNOWLEDGE_BASE_ARTICLES` for `/knowledge-base` and EH-139 stale checks.

`src/lib/knowledge-base/index.ts` exports both `KNOWLEDGE_BASE_ARTICLES` symbols. Publication is copied at the seams: `links.ts` and `content.ts` use `published` + `reviewed` without a stale window; `publication.ts` adds evidence and 365-day freshness; `panelEducationEligibleForPublicRoute` admits `in_review`.

EH-133 forbade a competing filesystem catalog; EH-136 shipped one anyway. This change keeps markdown as an adapter, not a second source of truth.

## Goals / Non-Goals

**Goals:**

- One catalog module answers “what is a Knowledge Base article?”
- One publication-admission interface answers “is this article public?”
- Markdown load and typed panel records sit behind that seam as adapters.
- Filesystem catalog code never reaches a client module.
- Existing public measurement pages, Biomarkers hrefs, `/knowledge-base` governance, and signed-in CBC preview keep working through the new interface.
- Tests hit the catalog and admission interface rather than source-text assertions about helper names.

**Non-Goals:**

- Collapsing `/knowledge`, `/knowledge-base`, and `/app/knowledge` into one article-page module.
- Deleting `CATEGORY_BY_SLUG` / `RELATED_PANEL_KEYS_BY_SLUG`.
- Moving CBC Registry validation off the client.
- Changing Registry, Observation, Health Profile, assessment, or article copy.
- Introducing a CMS, database table, or runtime content API.
- Publishing CBC; it stays `in_review` and signed-in-only until a later content change.

## Decisions

### 1. One catalog module, adapters behind the seam

The catalog is the deep module. It lists articles, looks up by type/locale/slug or Registry subject, and validates identity.

Adapters:

- Markdown measurement adapter: reads the existing manifest and bodies on the server.
- Typed panel adapter: supplies CBC and future panel records already in code.
- Test fixture adapter: in-memory articles for verifiers.

Rejected: deleting markdown and rewriting ten pages as TypeScript, or generating a second JSON catalog. The corpus stays where editors already work; only ownership of “the catalog” moves.

### 2. Canonical lifecycle is EH-133/EH-134

States: `draft`, `in_review`, `published`, `deprecated`.

The EH-139 `review` state maps to `in_review` at the markdown adapter. Public routes never see `review` as a third vocabulary.

Rejected: keeping both enums in the barrel. That is the leak.

### 3. Publication admission lives in the catalog module

One decision: public only when the article is `published`, has reviewer identity, a valid past review timestamp, at least one HTTPS source, a valid Registry subject, and a review no older than 365 days.

Call sites that must use it:

- `getKnowledgeArticleHref`
- public measurement article load (`getKnowledgeArticle` / published records)
- `getPublicKnowledgeBaseArticle` / list
- public panel overlay (`getPublicPanelEducationArticle`)
- `check-knowledge-base` / `validateKnowledgeBaseArticles`

Signed-in `/app/knowledge` MAY read `in_review` panel education through a separate non-public reader. That reader MUST NOT be used by `/knowledge` or `/knowledge-base`.

Rejected: leaving panel `in_review` on the public overlay “until CBC is reviewed.” That is a second admission rule.

### 4. Client-safe href projection

`getKnowledgeArticleHref` stays callable from `biomarker-table.tsx`. It MUST NOT import `fs`, `content.ts`, or markdown hydration.

The catalog exposes a JSON-safe published href map (measurement-definition key → `/knowledge/biomarkers/<slug>`) built from the same admission decision. The map is generated at module evaluation from catalog records the markdown adapter already validated, or from a committed projection that CI fails if it drifts.

Rejected: fetching hrefs from an API. Education links are static.

### 5. One exported catalog name

The barrel exports one `KNOWLEDGE_BASE_ARTICLES` (or equivalent list function) and one publication validator. Empty `MEASUREMENT_ARTICLES` is removed from the public interface. Panel-specific layout fields remain on panel records; they are not a second catalog.

`content/knowledge-base/articles.ts` becomes the markdown→catalog adapter or is deleted if the catalog module owns that mapping.

## Risks / Trade-offs

- [Public CBC overlay disappears] → Mitigation: signed-in `/app/knowledge/panels/cbc` still renders `in_review`; public `/knowledge/panels/cbc` falls back to the existing Registry panel page without education overlay. Record this in QA.
- [Barrel rename breaks verifiers] → Mitigation: update EH-133/136/138/139/public-panel scripts in the same change; keep behavior assertions, drop source-text helper-name matches where they encode the old split.
- [Filesystem accidentally ships to the client] → Mitigation: href map and navigation stay free of `node:fs`; add a verifier that client Knowledge Base imports do not pull `content.ts`.
- [Lifecycle mapping drops a published article] → Mitigation: adapter tests that each current EH-136 markdown article remains public after mapping.

## Migration Plan

1. Introduce the catalog module and adapters without switching routes.
2. Point publication, links, content published-lookup, and panel public overlay at the admission interface.
3. Remove duplicate catalog exports and the empty measurement catalog from the barrel.
4. Update verifiers; run typecheck and Knowledge Base scripts.
5. Rollback is a git revert; no database.

## Open Questions

None. CBC stays unpublished. Route collapse is a later change.
