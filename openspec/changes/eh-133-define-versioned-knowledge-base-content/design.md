## Context

EH-134 is implemented on branch `eh-134` and is awaiting merge through PR #224. Its reviewed implementation already owns the first Knowledge Base runtime boundary under `src/lib/knowledge-base/`: `MeasurementEducationArticle`, its Zod schema, an intentionally empty `MEASUREMENT_ARTICLES` catalog, Registry-backed validation, published-only lookups, a Registry-derived view model, and a separate authenticated results projection. The implementation deliberately publishes no article corpus; EH-136 owns the first reviewed records.

The original EH-133 plan proposed a separate `article.json` plus `body.md` filesystem format. That would duplicate the EH-134 contract, rename fields (`articleType` versus `type`, `review` versus `in_review`), and force a later migration before the first article is published. EH-133 must instead extend the existing boundary and establish rules that later panel/content work can share.

The Registry remains authoritative. `MeasurementDefinition` owns identity, maturity, provenance, aliases, unit policy, specimen, and assessment bindings; `PanelDefinition` owns panel identity and ordered membership. Knowledge Base records own educational copy and editorial metadata only. Assessment, observation, and Health Profile paths must not depend on the Knowledge Base.

## Goals / Non-Goals

**Goals:**

- Preserve the EH-134 measurement article field names and lifecycle states as the canonical contract.
- Define a shared discriminated article boundary that can represent measurement and panel subjects without duplicating their Registry facts.
- Keep article records version-controlled in typed catalog modules and expose deterministic, exact-locale, published-only reader projections.
- Require content version, review metadata, sources, related measurement keys, and explicit deprecation state for published educational records.
- Make invalid subject references, unsupported fields, duplicate identities, unsafe sources, and invalid lifecycle combinations fail closed.
- Keep general education separate from authenticated user observations and source-document evidence.
- Give EH-135 and later publication/index work one contract or one explicit adapter rather than parallel schemas.

**Non-Goals:**

- No second JSON/Markdown filesystem loader, frontmatter parser, MDX renderer, or content directory.
- No article corpus or first reviewed pages; EH-136 owns publication of those records.
- No panel article page, CBC route, member-card layout, index, search, relationship graph, stale-source workflow, or claim-scanning workflow; those belong to EH-135 through EH-140.
- No Supabase content table, CMS, editor workflow, or database migration.
- No changes to Registry definitions, aliases, units, panels, assessment bindings, observations, resolver behavior, score calculations, or Health Profile projections.
- No implicit locale fallback and no product-chrome translation.

## Decisions

### 1. EH-134 is the compatibility baseline

The apply phase must run after PR #224 is merged and the EH-133 branch is rebased onto that result. The existing measurement contract remains the source of truth for names and shapes:

- `type: "measurement"`;
- `measurementDefinitionKey` as the concrete Registry subject;
- lowercase kebab-case `slug`;
- non-empty `locale` and `contentVersion` strings;
- `reviewStatus: "draft" | "in_review" | "published" | "deprecated"`;
- nullable `reviewedBy`, `reviewedAt`, `deprecatedAt`, and `replacementSlug`;
- non-empty `title`, `summary`, `whatItMeasures`, `interpretationFactors`, and `sources`;
- curated `relatedMeasurementKeys`.

EH-133 may add shared helpers or a panel variant, but it must not create aliases for these fields or silently translate them to the shapes used by unmerged downstream branches.

### 2. Keep version-controlled content in typed catalog modules

The EH-134 catalog is a TypeScript constant and remains intentionally empty until reviewed records are supplied. EH-133 adds the shared catalog/validation boundary around that approach. Article copy remains typed fields rather than inert Markdown bodies, so required educational sections are visible to TypeScript and Zod validation.

This is still version-controlled content: edits are reviewed as code, `contentVersion` records the editorial revision, and Git history is the publication audit trail. A later change may introduce a different storage format only through an explicit migration that provides one adapter and preserves this public runtime contract.

Rejected alternatives:

- A parallel JSON/Markdown tree would duplicate the currently reviewed loader contract and create two sources of truth.
- Supabase/CMS storage would add runtime editing, authorization, migration, and audit scope not required by issue #33.
- Untyped Markdown would allow required review metadata and Registry references to drift away from the rendered article shape.

### 3. Add a shared discriminator without coupling presentation

The common Knowledge Base layer represents article identity and editorial metadata. Measurement records keep the EH-134 measurement-specific sections. A panel record uses the same lifecycle/source/version envelope and a `panelKey`; its required purpose, composition, subgroup, and member fields are owned by EH-135 and must be validated through the same boundary.

The shared contract must reject a measurement record with a panel subject and a panel record with a measurement subject. It must not require a panel route or publish panel content as part of EH-133.

### 4. Keep Registry references read-only and derive display facts

The validator resolves the primary measurement subject through `getMeasurementDefinition` and requires an active reviewed Registry 2.0 definition. Panel subjects resolve through the static Panel Registry when the panel variant is supplied. Registry-derived display names, aliases, units, specimen, panel membership, assessment bindings, ranges, score roles, readiness groups, and contribution groups are never copied into article metadata.

`relatedMeasurementKeys` remains a curated list of concrete keys. A missing, provisional, retired, or unpublished related article is not turned into a guessed link; the reader omits that related link. The primary article subject still fails validation when it is unknown or not an active reviewed definition.

### 5. Publication and deprecation are fail-closed

Zod validates the strict record shape; semantic helpers validate cross-field and catalog rules:

- `published` records require review metadata and at least one HTTPS source. They are returned only when the primary Registry subject is active and reviewed.
- `draft` and `in_review` records may exist in the version-controlled catalog but are never returned by published lookups.
- `deprecated` records require `deprecatedAt`, are excluded from current published projections, and remain available only to validation/internal tooling. `replacementSlug` is explicit metadata, not an automatic redirect contract; a future route may add same-locale replacement validation without changing article identity.
- `reviewedAt` is parsed as an offset-aware timestamp and source URLs are restricted to HTTPS, matching EH-134.
- Unsupported metadata fields, invalid lifecycle combinations, duplicate locale/slug identities, and invalid subject references fail validation.

The current schema requires a source list on every structurally valid article, including non-published fixtures. This preserves the EH-134 contract; later editorial workflow changes must be explicit rather than changing draft semantics implicitly.

### 6. Keep private data outside the article contract

The general article loader accepts only type, slug, locale, or Registry subject inputs. It never accepts or returns a profile id, observation id, document id, patient value, or source-document evidence. A future article page may render a separate **Your results** section by calling the authenticated `/api/biomarkers` path and applying exact definition-key filtering, as EH-134 already does. The static article projection remains safe to share across profiles.

### 7. Verify the contract at the repository boundary

Add focused pure verification for the shared contract and catalogs. Synthetic records must cover valid measurement and panel discriminators, exact locale lookup, published filtering, Registry maturity/provenance, HTTPS sources, duplicate identities, deprecation metadata, unsupported private/scoring fields, and withholding of unresolved related links. Verification must run without Supabase, patient data, or network access.

The EH-134 verifier remains a compatibility test and must continue to pass after the shared contract is added. The QA checklist must mark article UI checks unavailable until EH-136 supplies a reviewed record; it must not claim that the empty catalog proves a visible article flow.

## Risks / Trade-offs

- **[Risk] PR #224 is not merged when apply starts.** → **Mitigation:** Treat merge/rebase as a hard prerequisite; do not apply against a checkout that lacks the EH-134 files.
- **[Risk] Unmerged EH-135/EH-136/EH-139 branches use divergent article shapes.** → **Mitigation:** Make this contract the integration point and require each downstream branch to migrate through one explicit adapter before merge.
- **[Risk] Typed fields make long prose diffs less convenient than Markdown.** → **Mitigation:** Keep required article sections structurally validated now; defer any storage-format change until it can preserve the same runtime contract.
- **[Risk] Registry keys can be retired while content remains versioned.** → **Mitigation:** Fail the primary subject validation and update or deprecate the record; never silently remap it.
- **[Risk] Related keys may not yet have published articles.** → **Mitigation:** Withhold the link and retain the explicit key; never fabricate a route from a raw key.
- **[Risk] Reviewer identifiers or patient data could enter repository content.** → **Mitigation:** Use controlled reviewer/team identifiers, strict fields, synthetic fixtures, and explicit rejection of profile/observation/document fields.

## Migration Plan

1. Merge PR #224 and rebase the EH-133 branch onto the merge result.
2. Extend the existing `src/lib/knowledge-base` types and validators without renaming EH-134 fields or adding a parallel storage path.
3. Add the shared panel discriminator/subject contract and deterministic catalog helpers; leave the production catalog empty.
4. Add synthetic contract verification, package/workflow wiring, and `QA/eh-133/checklist.md` with unavailable UI checks recorded honestly.
5. Migrate EH-135 panel records and later EH-136/EH-139 content loaders through the shared contract or one explicit adapter before those changes merge.
6. Run the focused tests, type checks, OpenSpec validation, and required Registry documentation checks. No database rollback is needed; rollback is a code/catalog revert.

## Open Questions

The exact panel-specific educational sections remain owned by EH-135. That is intentionally non-blocking for this shared contract; the panel discriminator, subject boundary, lifecycle metadata, source rules, and private-data separation are fixed here.
