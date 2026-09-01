## Context

EasyHealth already has a reviewed Registry 2.0 catalogue (`MeasurementDefinition`) and a static panel registry, plus the authenticated `/api/biomarkers` projection used by the Biomarkers page. It does not yet have a Knowledge Base content boundary or a page that explains one concrete measurement. The next roadmap item (EH-136) will supply reviewed article records, so EH-134 must ship the reusable contract and renderer without inventing an unreviewed article or altering score/resolver behavior.

The page belongs inside the authenticated app shell because its secondary **Your results** section reads the signed-in user's observations. General education remains version-controlled content and is rendered separately from those observations. A source document link must continue through the existing document route and ownership check.

## Goals / Non-Goals

**Goals:**

- Define a typed, review-gated measurement article record that is independent of the Registry resolver and assessment engine.
- Provide a reusable route and renderer for a published article at `/app/knowledge/measurements/[slug]`.
- Render all EH-134 sections and distinguish general education from profile-owned results in structure, headings, and copy.
- Derive identity metadata (aliases, accepted units, specimen, and panel membership) from the existing Registry 2.0 and Panel Registry helpers.
- Link a user's matching observations to Biomarkers and profile-owned source documents with the existing safe navigation contract.
- Keep the route empty until a later issue supplies clinically reviewed content; unpublished records must never be user-visible.
- Provide deterministic contract verification and a tester-facing QA record.

**Non-Goals:**

- No database table, migration, RPC, CMS, editor, or content-publishing workflow.
- No initial published article corpus; EH-136 owns the first reviewed pages.
- No universal reference ranges, score bands, diagnoses, treatment advice, or test-order prompts in the template.
- No changes to Registry definitions, aliases, resolver outcomes, normalization, assessment bindings, or score calculations.
- No Knowledge Base index, search, panel article, related-measurement graph, or public unauthenticated route; those belong to later roadmap items.

## Decisions

### 1. Keep article content separate from Registry and observations

Add `src/lib/knowledge-base/types.ts` and `measurement-articles.ts` for the version-controlled article contract and catalog lookup. A measurement article stores authored educational copy plus `measurementDefinitionKey`, `slug`, `locale`, `contentVersion`, review/deprecation metadata, sources, and related definition keys. It does not copy the Registry's aliases, unit policy, specimen, panels, assessment bindings, or reference ranges.

The lookup returns only a record with `reviewStatus: "published"`, valid review metadata, at least one HTTPS source, an active reviewed measurement definition, and valid deprecation state. EH-134 leaves the production catalog empty; later reviewed content can be added without touching score logic.

**Alternative rejected:** putting article prose on `MeasurementDefinition`. That couples clinical content releases to resolver/catalog manifests and makes an editorial update look like a measurement identity change.

### 2. Build a server-side view model from authoritative registries

A pure `buildMeasurementArticleViewModel` helper resolves the article's concrete definition through `getMeasurementDefinition` and panel membership through `listPanelsForMeasurementDefinition`. It projects unique alias labels, accepted units, specimen label, panel names/roles, and related definitions into a serializable page model. Related links are emitted only when a matching published article exists; otherwise the definition is shown as unavailable rather than pointing at a guessed slug.

**Alternative rejected:** storing display aliases, units, and panel names inside each article. Duplicated identity metadata would drift from the Registry and could imply unsupported definitions.

### 3. Use an authenticated client renderer for the personal-results island

The dynamic app route resolves and validates the article on the server, then passes the view model to a client `MeasurementArticle` component. The component fetches `/api/biomarkers`, filters the returned profile-scoped observations by exact `measurement_definition_key`, and renders value, unit, date, and owned source links. It never accepts a profile id or observation query as a data selector. Loading, retryable error, and no-results states are explicit and keyboard accessible.

Source links use `buildHealthNavigationPath` with `measurement`, `observation`, and `returnTo` pointing to the article path. The document route remains responsible for `assertDocumentOwner`; the article adds no data-access path.

**Alternative rejected:** a new article API that joins observations by slug. It would duplicate profile authorization and create a second source-document projection for a page that can safely consume the existing Biomarkers contract.

### 4. Make safety boundaries visible in the markup

The general section uses an article heading and factual section headings. The personal section is a separate `section` titled **Your results**, with copy stating that values come from uploaded documents. The renderer does not receive or display reference bounds, assessment status, score roles, or universal interpretation thresholds. Sources are explicit HTTPS links, related measurements are plain links only when available, and the fixed medical disclaimer is always present.

**Alternative rejected:** placing personal values inline beside educational paragraphs. That makes a user's laboratory value look like a universal example and weakens the product's no-diagnosis boundary.

### 5. Defer content publication rather than fabricate review evidence

EH-134 ships no published article record. The route returns the normal Next not-found state for unknown, draft, incomplete, or deprecated slugs. The reusable renderer and deterministic tests use synthetic in-memory article records. QA marks the authenticated article flow as not manually testable until EH-136 publishes reviewed content and lists the exact developer evidence required in the meantime.

**Alternative rejected:** shipping a sample article as published. That would require inventing clinical review metadata and would violate the roadmap's separation between template delivery and content review.

## Risks / Trade-offs

- **[Risk]** No production article is visible immediately after deployment. → **Mitigation:** make the route and renderer ready for EH-136, keep the empty catalog intentional, and document the unavailable manual path instead of exposing unreviewed copy.
- **[Risk]** `/api/biomarkers` returns all eligible observations, so the client downloads more data than one article needs. → **Mitigation:** reuse the existing profile-scoped contract for this first template; do not add a weaker duplicate endpoint. A targeted read can be specified separately if performance evidence requires it.
- **[Risk]** Registry aliases or units may contain technical tokens that are hard for non-technical users to read. → **Mitigation:** present them as factual metadata with plain labels and preserve the source values; future editorial content can explain terms without rewriting identity data.
- **[Risk]** A related definition may have no published article yet. → **Mitigation:** render its Registry display name without a link and state that an article is unavailable; never construct a URL from a raw key.
- **[Risk]** A source observation can lack a document relation. → **Mitigation:** retain the value/date and omit the source action rather than inventing a document target.
- **[Risk]** A content record can be valid structurally but semantically unsafe. → **Mitigation:** require review metadata and HTTPS sources for publication, keep interpretation factors authored and review-gated, and explicitly exclude score/range/diagnosis fields from the template contract.
