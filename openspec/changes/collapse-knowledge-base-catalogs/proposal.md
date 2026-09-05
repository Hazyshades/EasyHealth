## Why

EH-133 through EH-140 each added a Knowledge Base catalog instead of deepening one. Three corpora now share the name `KNOWLEDGE_BASE_ARTICLES` and disagree on the record, so “is this article public?” is answered in five places. Publication admission cannot become one interface while three catalogs still answer “what is a Knowledge Base article?”

## What Changes

- Collapse the Knowledge Base catalogs into one catalog module. Markdown measurement articles and typed panel records become adapters behind that seam; filesystem load stays server-only.
- **BREAKING** (Knowledge Base readers): one article identity and one lifecycle vocabulary. Duplicate catalog constants, empty `MEASUREMENT_ARTICLES`, and the competing `review` / `in_review` state names leave the public interface.
- Concentrate publication admission in that same catalog module. Href maps, public measurement routes, public panel overlays, `/knowledge-base` reads, and the release check all use one “public or not” decision: published, reviewed, sourced, and not stale.
- **BREAKING** (public panel overlay): `in_review` panel education is no longer public. CBC remains readable on signed-in `/app/knowledge` until it is published.
- Keep Registry, Observation, Health Profile, and assessment paths unchanged. Do not collapse public vs signed-in routes, delete `CATEGORY_BY_SLUG`, or move CBC Registry lookup off the client in this change.

## Capabilities

### New Capabilities

- `knowledge-base-catalog`: one version-controlled Knowledge Base catalog, article identity, adapter-backed corpus load, and the single publication-admission interface used by public readers and the release check.

### Modified Capabilities

- None in `openspec/specs/`. Archived EH-133 `knowledge-base-content` and EH-139 `knowledge-base-publication-governance` never landed in the main spec tree; this change is the first main-tree contract for the catalog and admission rule those changes split.

## Impact

- Target domain: Knowledge Base product surface (health-profile for Observation-row hrefs; auth-shell for signed-in `/app/knowledge`).
- `src/lib/knowledge-base/` catalogs, `content/knowledge/biomarkers/`, `content/knowledge-base/articles.ts`, barrel `index.ts`, `links.ts`, public panel overlay lookup, and Knowledge Base verifiers (`scripts/verify-eh133*`, `verify-eh136*`, `verify-eh138*`, `verify-knowledge-base.ts`, `check-knowledge-base.ts`, `verify-public-panel-education.ts`).
- No database migration, Registry catalog change, Observation write path, score/assessment change, or route-tree collapse.
