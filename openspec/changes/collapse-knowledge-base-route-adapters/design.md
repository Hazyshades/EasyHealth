## Context

Three Next.js trees render Knowledge Base articles:

- `/knowledge`: EH-138 index, markdown measurement pages, Registry panel pages with an education overlay.
- `/knowledge-base`: EH-139 publication-gated index and generic article page (`KNOWLEDGE_BASE_ROUTE = "/knowledge-base"`).
- `/app/knowledge`: signed-in index that hard-codes CBC, a measurement route over the empty catalog, and a client CBC page that loads Observations.

Templates split the same way: `biomarker-article.tsx`, `measurement-article.tsx`, `article-page.tsx`, `panel-article.tsx`, `panel-article-template.tsx`.

`collapse-knowledge-base-catalogs` (prerequisite) owns catalog identity and publication admission. This change does not reopen those rules. It assumes public readers already use one “public or not” decision and that `in_review` CBC is signed-in-only.

Biomarkers hrefs already point at `/knowledge/biomarkers/<slug>`. The signed-in nav item is `/app/knowledge`; a second public nav item already points at `/knowledge`.

## Goals / Non-Goals

**Goals:**

- One article-page module renders measurement and panel education (disclaimer, sources, review date, body, related links).
- Two adapters: public (no Observations) and signed-in (existing profile-scoped results strip).
- `/knowledge` is the only public URL family; `/knowledge-base` permanently redirects.
- Public panel education, when admitted, uses the same article-page module as measurement pages.
- Tests hit the article-page module and redirect behavior, not three template copies.

**Non-Goals:**

- Catalog collapse, lifecycle mapping, or stale-window admission (change 1).
- Deleting `CATEGORY_BY_SLUG` / `RELATED_PANEL_KEYS_BY_SLUG`.
- Moving CBC Registry validation off the client.
- Publishing CBC or changing article copy.
- Merging the public search index into the signed-in Knowledge home.
- CMS, database table, or runtime content API.

## Decisions

### 1. Canonical public URLs stay type-prefixed under `/knowledge`

- Index: `/knowledge`
- Measurement article: `/knowledge/biomarkers/<slug>`
- Panel article: `/knowledge/panels/<key>`

Rejected: flattening to `/knowledge/<slug>`. Measurement and panel slugs can collide (`cbc` is both a panel key and a possible future slug), and Biomarkers already deep-link the type-prefixed path.

### 2. `/knowledge-base` is a redirect adapter, not a third product surface

- `GET /knowledge-base` → 308 `/knowledge`
- `GET /knowledge-base/<slug>` → 308 to the catalog’s public path for that slug, or `/knowledge` if the slug is missing, unpublished, or ambiguous

Deprecated-slug redirects from EH-139 follow the same catalog redirect helper, never an external URL.

`KNOWLEDGE_BASE_ROUTE` becomes `/knowledge` or is removed in favor of catalog path helpers. No public page remains under `src/app/knowledge-base` except the redirect routes.

Rejected: keeping `/knowledge-base` as the “governance” tree. Admission already lives in the catalog; a second URL family is the leak.

### 3. Two adapters justify the article-page seam

Public adapter: catalog public reader only. No session, no Observations, no `/api/biomarkers`.

Signed-in adapter: same article-page module plus the existing profile-scoped results strip (`/api/biomarkers` → `selectMeasurementObservations` / `selectPanelArticleResults`). May use the non-public catalog reader for `in_review` CBC only.

Rejected: one route that optionally hydrates Observations from the public tree. That would leak profile reads across the public seam.

Rejected: three adapters (measurement public, panel public, signed-in). Panel vs measurement is article type inside the module, not a third adapter.

### 4. Index pages stay separate from the article-page module

`/knowledge` keeps EH-138 search/filter. `/app/knowledge` keeps the signed-in home (currently CBC preview). Collapsing indexes is not required for article locality and would mix search UX with the Observation strip.

### 5. Empty signed-in measurement route follows the catalog

`/app/knowledge/measurements/<slug>` uses the shared catalog. If no signed-in-readable article exists, `notFound`. It does not keep `MEASUREMENT_ARTICLES = []` as a private corpus.

## Risks / Trade-offs

- [Inbound `/knowledge-base` links break without redirects] → Mitigation: permanent redirects in this change; verifier covers index, published slug, unknown slug, deprecated slug.
- [Panel vs measurement templates lose layout] → Mitigation: type-specific sections (CBC subgroups, related Registry panels) remain inside the article-page implementation; visual QA on hemoglobin and CBC.
- [Signed-in CBC still client-validates Registry] → Accepted; that is change 5, out of scope.
- [Apply before change 1] → Mitigation: this change’s tasks start only after catalog admission is the public gate; otherwise redirects would freeze the old split.

## Migration Plan

1. Land `collapse-knowledge-base-catalogs`.
2. Extract the article-page module from the current public measurement template.
3. Point `/knowledge/biomarkers` and `/knowledge/panels` (when education is public) at it; point signed-in CBC/measurement at the signed-in adapter.
4. Replace `/knowledge-base` pages with redirects; update `KNOWLEDGE_BASE_ROUTE` and verifiers.
5. Delete unused templates.
6. Rollback is a git revert; no database.

## Open Questions

None. Canonical public prefix is `/knowledge`. CBC stays unpublished.
