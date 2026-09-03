## Context

The repository already exposes reviewed Registry 2.0 measurement definitions and a static panel registry in `src/lib/biomarkers`, while authenticated Biomarker rows are loaded from the profile-scoped `/api/biomarkers` route. There is no Knowledge Base route or content layer. The change must connect those surfaces without turning educational content into a resolver, assessment, or observation consumer.

EH-138 is a frontend and static-content change across the new `knowledge-base` surface and the existing `health-profile` navigation entry point. The public pages must be useful without a session; private observations must remain available only through existing authenticated app routes.

## Goals / Non-Goals

**Goals:**

- Define versioned, review-gated static article records keyed by concrete reviewed measurement-definition keys.
- Render a public `/knowledge` index with category sections, normalized canonical/alias search, and panel filters.
- Render measurement article and panel detail routes with safe educational copy, source links, related links, and accessible breadcrumbs.
- Use the existing static panel registry to preserve required/optional order and explicitly explain variable panel composition.
- Add article links to Biomarker rows only when the row's concrete key has a published article.
- Provide a link from an article back to `/app/biomarkers?measurement=<key>` without passing observation values, profile ids, or document ids through the public route.
- Verify search precedence, alias coverage, panel filtering, route links, and the absence of private-data reads in Knowledge Base code.

**Non-Goals:**

- No database tables, migrations, RPCs, API routes, Supabase queries, cookies, or user-data fetching for Knowledge Base pages.
- No changes to Registry definitions, aliases, maturity, resolver outcomes, units, conversions, assessment bindings, score logic, or Health Profile projection.
- No universal reference ranges, diagnosis language, treatment instructions, or test-order prompts in article content.
- No claim that every Registry definition has an article; unpublished panel members remain visible as unlinked members with an explicit unavailable-article state.
- No locale switch, editorial CMS, personalization, sharing of observations, or cross-profile navigation.

## Decisions

### 1. Keep content in a dedicated static module

Add a `src/lib/knowledge-base` module containing typed article records, review metadata, version, source links, related definition keys, and slugs. The article records are the publication allow-list. At render time they join to the existing reviewed Registry definition and static panel membership data for canonical names, active aliases, units, specimen, and membership.

**Alternative rejected:** putting article copy on `MeasurementDefinition`. That would couple editorial changes to resolver/assessment releases and would make the Registry carry product prose it does not own.

### 2. Key article records by concrete measurement definition

A published article points to one concrete `measurementDefinitionKey`; its slug is stable and human-readable. The detail route refuses missing, retired, unreviewed, or provenance-invalid definitions. This preserves specimen and value-kind identity instead of treating an analyte alias as a universal clinical definition.

**Alternative rejected:** using only `analyteKey` as the article identity. One analyte can have serum, plasma, whole-blood, timing, or value-kind variants that must not be silently conflated.

### 3. Use server-rendered GET navigation for the index

`/knowledge` is a server page reading `q`, `category`, and `panel` query parameters. The search form uses ordinary GET submission, so the filtered index is refreshable, copyable, and usable without client state. Search candidates are limited to published article records and panel names; query normalization reuses `normalizeMeasurementLabel` and its accent-folded form, while only active Registry aliases participate.

**Alternative rejected:** a new search API or a client-side fetch. It would add an unnecessary data path and create a privacy review surface for content that is static at build/request time.

### 4. Render panels from the existing static panel registry

Panel pages use `PANEL_DEFINITIONS` and `listPanelsForMeasurementDefinition` rather than inferring membership from a user's observations or assessment groups. Each member retains display order and required/optional role. A link is rendered only when a published article exists; a member without one remains factual text and is labeled as not yet published.

**Alternative rejected:** deriving panels from the observed rows. That would make a user's incomplete laboratory panel look like a canonical panel definition and could leak private data into public content.

### 5. Preserve a one-way public/private boundary

Knowledge pages import only static content and reviewed Registry metadata. Their only user-specific affordance is a plain link to the authenticated `/app/biomarkers` route with a concrete measurement key. The shared AuthProvider treats `/knowledge` routes as public, using auth metadata only and avoiding `/api/profile`; profile resolution remains on private app routes. Biomarker rows use the same allow-list to link outward, but never append values, profile identifiers, observation identifiers, or source-document identifiers to a Knowledge Base URL.

**Alternative rejected:** fetching a user's matching observations on an article page. That would mix a public article response with private data and duplicate existing profile ownership checks.

### 6. Use shared breadcrumbs and existing visual primitives

Article and panel pages reuse `ContextBreadcrumbs`, `PageHeader`, `SurfaceCard`, `SearchInput`, and existing EasyHealth tokens. The public Knowledge Base header provides links back to EasyHealth and the authenticated app. Focus styles, semantic headings, labeled filters, reduced-motion-safe transitions, and responsive member lists follow the existing product register.

**Alternative rejected:** a separate design system or a modal article reader. A route is easier to deep-link, index, refresh, and review for accessibility.

## Risks / Trade-offs

- **[Risk]** The initial article allow-list covers fewer definitions than the Registry. → **Mitigation:** show all six canonical panels and their complete ordered memberships, link only published records, and state unavailable article coverage explicitly rather than creating broken or unreviewed pages.
- **[Risk]** A broad alias such as `glucose` can correspond to multiple concrete definitions. → **Mitigation:** publish one concrete definition per article, use the article's Registry identity on detail, and do not resolve private rows or invent specimen context on the public page.
- **[Risk]** Search normalization can make a query appear to match both a canonical name and an alias. → **Mitigation:** rank exact canonical/key matches before alias matches and expose the match kind in the result metadata/UI.
- **[Risk]** A future article slug or definition key may be retired. → **Mitigation:** validate publication at the catalog seam and return `notFound()` for invalid detail combinations; preserve existing links only through stable published slugs.
- **[Risk]** Adding a public route to the authenticated app's navigation can change user context. → **Mitigation:** use a clearly labeled standalone header and keep the return-to-app link explicit; no private state is carried across the boundary.

## Migration Plan

1. Ship the static content module, catalog helpers, public routes, and Biomarker-row links together.
2. Existing users continue to see their current Biomarker table; rows without a published article retain the existing display with no fabricated link.
3. No data migration or cache invalidation is required. Rollback is a code-only revert of the Knowledge Base routes, static module, navigation links, and focused verification script.
4. Future article additions update the static allow-list and content version/review metadata without changing Registry or assessment code.

## Open Questions

- Additional article coverage and localized content remain editorial follow-up; this change publishes only the reviewed initial set represented by the static records.
- Public SEO metadata and sitemap publication are not required for the navigation contract and remain outside this change.
