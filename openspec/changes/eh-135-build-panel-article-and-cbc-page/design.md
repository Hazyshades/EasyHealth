## Context

The checkout has a reviewed Registry 2.0 `PanelDefinition` catalog (`src/lib/biomarkers/panel-registry.ts`), the canonical EH-133 Knowledge Base model, and an authenticated `/api/biomarkers` read surface, but it has no panel-education presentation route. The existing Health Timeline already groups normalized observations by exact measurement-definition keys; EH-135 must reuse those boundaries without turning education into a resolver or assessment input.

The canonical EH-133 versioned article contract is now present in the master baseline. EH-135 extends its panel record with the reviewed-content presentation fields needed for the CBC preview; it must not claim clinical review that has not occurred in this checkout.

## Goals / Non-Goals

**Goals:**

- Define a serializable, versioned panel-article record using the canonical EH-133 contract, with an explicit in-review state, locale, source list, and Registry 2.0 measurement-definition references.
- Keep the article template reusable for future panels while making the CBC page complete: purpose, composition caveat, red-cell/white-cell/platelet subgroups, member cards, optional and related markers, sources, and disclaimer.
- Make the user's own CBC results a separate, clearly labeled section. Match only exact CBC membership keys and preserve existing Biomarkers/document navigation links.
- Expose the page through an authenticated Knowledge index and navigation entry with loading, error, empty, and populated result states.
- Provide deterministic pure verification that catches content drift and unsafe wiring without database writes or network access.

**Non-Goals:**

- No CMS, database table, migration, admin/editor workflow, article API, markdown renderer, or content authoring UI.
- No changes to Registry 2.0 definitions, panel membership, aliases, resolver behavior, score roles, readiness, reference-range interpretation, diagnosis, or test-order recommendations.
- No claim that the preview is clinically reviewed; `reviewedBy` and `reviewedAt` remain absent while the record is `reviewStatus: "in_review"`.
- No user-specific medical interpretation. Result cards show the stored value, unit, date, and source link only.

## Decisions

### 1. Keep panel education in a dedicated typed content module

Add `src/lib/knowledge-base/types.ts` and `src/lib/knowledge-base/panel-articles.ts`. A `PanelArticle` extends the canonical panel article fields with locale, content version, `reviewStatus`, nullable review metadata, title/summary/purpose/composition copy, subgroup member references, related measurement references, source records, and the shared medical disclaimer. The CBC record is `reviewStatus: "in_review"` until named clinical review evidence exists.

Each member reference stores an exact `measurementDefinitionKey`, a presentation role (`core`, `optional`, or `related`), and a plain-language explanation. A validation helper resolves keys against `getPanelDefinition("cbc")` and `getMeasurementDefinition`; it rejects duplicate keys, unknown definitions, subgroup omissions, and a `core`/`optional` role that disagrees with the panel registry. The article module imports catalog metadata only and never imports assessment code.

**Alternative:** store article copy as untyped Markdown. Rejected because required review/version/source metadata and exact Registry references would be easy to omit or drift, and the reusable template would need unsafe parsing rules.

### 2. Use a generic template with explicit content slots

Add `src/components/knowledge/panel-article-template.tsx`. It receives a validated `PanelArticle`, its `PanelDefinition`, and a result-state model. The template renders:

- a header with panel name, alternate names, preview/review state, title, and summary;
- a purpose section and a prominent composition note stating that panel membership describes a group, not a guaranteed lab-report checklist;
- subgroup sections in article order, with member cards that show the measurement name, explanation, and neutral `Core`, `Often included`, or `Related` labels;
- a separate `Your CBC results` section with value/unit/date/source links and no clinical status or range interpretation;
- related-marker education, source links with publisher/title, and the existing medical disclaimer.

The component uses existing `PageHeader`/`SurfaceCard`/`StatusChip`/breadcrumb conventions, full borders rather than accent stripes, and responsive grids that collapse to one column on small screens. It does not use animation or color alone for meaning. Result loading uses skeleton rows; fetch errors have an inline retry action; no-result copy teaches the user how to reach Biomarkers or upload a document.

### 3. Make exact-key result projection a pure helper

Add `src/lib/knowledge-base/panel-results.ts` with a typed `selectPanelArticleResults` helper. It accepts the `/api/biomarkers` read rows and a panel/article key set, filters only rows whose `measurement_definition_key` is an exact member key, excludes unresolved/non-member rows, and sorts by observed date descending with ordinal and ID tie-breakers. It retains document IDs and existing source metadata. It never filters by display name, alias, panel heading, filename, assessment eligibility, or reference-range status.

The CBC page calls `/api/biomarkers` with `cache: "no-store"`, converts the response into the narrow read type, and passes only this projection to the template. Each result link targets `/app/biomarkers` with `measurement`, `observation`, and a safe `returnTo` path, preserving the existing source/document deep-link contract. The educational article remains renderable when the API is empty or unavailable.

### 4. Add an authenticated Knowledge index and CBC route

Add `src/app/app/knowledge/page.tsx` as a lightweight index linking to `/app/knowledge/panels/cbc`, and add `src/app/app/knowledge/panels/cbc/page.tsx` as the client route that owns result loading. Add `Knowledge` to `APP_NAV_ITEMS` using the existing `LibraryIcon`, and extend `healthRouteLabel` for Knowledge breadcrumbs. Existing navigation order and active-path semantics remain unchanged for current entries.

The CBC route is nested under the authenticated `/app` layout, so it inherits session/onboarding gating. Static article content is available without a user result; profile data is fetched only through the already-authenticated biomarker endpoint. A failed endpoint shows the article plus a retryable result-section error, not a blank page or fabricated result.

### 5. Verify the content and UI wiring without changing persistence

Add `scripts/verify-eh135-panel-article.ts` and `pnpm test:eh135`. Synthetic rows exercise exact CBC membership, an unrelated definition, an unresolved row, duplicate observations, deterministic ordering, and source-link metadata. Assertions cover preview/review metadata, three required subgroups, optional and related labels, complete registry-key coverage, explicit composition wording, source URLs, disclaimer, result separation, navigation links, and absence of assessment/resolver imports in the knowledge module.

Add `QA/eh-135/checklist.md` from the repository template. Manual checks use synthetic/de-identified lab documents and record UI results only after execution; pure content and exact-key boundaries stay under developer evidence.

## Risks / Trade-offs

- **Preview content may be mistaken for clinical guidance.** Keep the preview/review state visible, use source-backed descriptive copy, avoid universal ranges/diagnoses/actions, and repeat the existing medical disclaimer.
- **Registry keys can drift from article subgroups.** Validate every article key against the runtime panel and definition registries in the focused runner; fail closed on unknown or duplicate keys.
- **User result rows can look like recommendations.** Keep them in a separate section, show factual value/unit/date/source only, and do not reuse status chips or assessment eligibility labels.
- **The `/api/biomarkers` response can fail or contain no rows.** Render the complete article independently, provide a retryable inline state, and offer links to Biomarkers/upload instead of hiding educational content.
- **A future content workflow may change editorial fields.** Keep the EH-135-specific richer record localized as an extension of the canonical EH-133 contract rather than spreading content assumptions across components.
- **Adding a nav item changes small-screen density.** Use the existing responsive `NavItem` component, verify the sidebar and bottom navigation at desktop/mobile widths, and preserve keyboard focus states.

## Migration Plan

1. Add typed CBC preview content, exact-key result projection, generic article template, Knowledge index, and authenticated CBC route.
2. Add the Knowledge navigation entry and focused verification command/QA checklist.
3. Run `pnpm test:eh135`, typecheck, production build, OpenSpec validation, and required Registry documentation checks; manually exercise the route with synthetic or de-identified data when an authenticated browser is available.
4. Keep the CBC record in the canonical contract's in-review state until named clinical review evidence exists; no route should treat it as published education.
5. Rollback by removing the Knowledge route/navigation and content module; existing observations, panel registry, and assessment behavior remain untouched.
