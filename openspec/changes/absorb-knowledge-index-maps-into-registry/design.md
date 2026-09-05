## Context

EH-138 index projection in `src/lib/knowledge-base/navigation.ts` already loads published markdown records and Registry definitions. It then throws away Registry panel membership for related-panel links and assigns Body system from two slug tables:

- `CATEGORY_BY_SLUG` — hemoglobin → blood, glucose → metabolic, …
- `RELATED_PANEL_KEYS_BY_SLUG` — hemoglobin → cbc, glucose → [], tsh → thyroid, …

`toPublishedArticle` already calls `listPanelsForMeasurementDefinition` into `article.panels`, but `record.relatedPanelKeys` still comes from the slug table. `biomarker-article.tsx` reads `getKnowledgeArticleBySlug(article.slug)?.record.relatedPanelKeys` instead of the Registry list already on the article.

Body system is not an identity axis on `MeasurementDefinition`. The named Body system used by Health Profile is the reviewed assessment binding’s `system` (`getRegistryV2System`). `KnowledgeCategory` is `Exclude<BodySystemId, "general">`. The current slug map matches those named systems for the ten EH-136 articles.

`collapse-knowledge-base-catalogs` owns “what is an article” and public admission. This change only owns how the index *projects* Registry facts onto published articles. It does not reopen routes (`collapse-knowledge-base-route-adapters`) or CBC client Registry validation.

## Goals / Non-Goals

**Goals:**

- Index category, category filter, and related-panel links derive from Registry at projection time.
- Delete `CATEGORY_BY_SLUG` and `RELATED_PANEL_KEYS_BY_SLUG`.
- A new published measurement article needs no slug-table row to appear under the right Body system and panels.
- Article records still do not store score role, readiness groups, or copied Registry display names.
- Tests hit the projection interface (category for a definition, panels for a definition), not source-text of the maps.

**Non-Goals:**

- Catalog collapse, publication stale window, or lifecycle mapping.
- Collapsing `/knowledge` vs `/knowledge-base` vs `/app/knowledge`.
- Moving CBC `getPanelDefinition` off the client.
- Changing Registry bindings, panel members, or article copy.
- Using Observations or Health Profile scores as category evidence.
- CMS or database.

## Decisions

### 1. Panel membership is Registry panel membership

Related-panel keys on the index record SHALL be the keys from `listPanelsForMeasurementDefinition` for every measurement-definition key the article lists, de-duplicated, stable order (panel registry order).

The article template SHALL read that projection (or `article.panels`), not a slug map.

Editorial `relatedMeasurementKeys` stay on the article. They are not panel membership.

Rejected: keeping `RELATED_PANEL_KEYS_BY_SLUG` as an “editorial override.” That is the leak. If education needs a panel that is not Registry membership, that is a Registry or article-copy change, not an index table.

### 2. Education category is named Body system, derived not stored

Category SHALL be the reviewed assessment binding’s `system` when it is a named Body system (not `general`). Projection reads `getRegistryV2System` (or the same reviewed-binding lookup) per article measurement-definition key.

Rules:

- One named Body system across the article’s keys → that `KnowledgeCategory`.
- All keys resolve to `general` or missing binding → article is published-routable but omitted from category groups and category filters (fail closed for grouping, not a guessed slug).
- Conflicting named Body systems on one article → catalog/index validation fails; do not pick a winner.

Rejected: writing `category` onto markdown manifest rows. That copies Health Profile Body system into the catalog.

Rejected: inferring category from the first panel (CBC → blood). Glucose has no panel and is still metabolic.

### 3. Assessment coupling stays at projection time

EH-133 forbids copying assessment fields onto article records. This change reads Body system only when building the index projection. Articles, publication admission, and safety policy still do not import score role or readiness groups.

The education index grouping matching Health Profile Body system is intentional: the same Registry fact, two readers.

### 4. Current EH-136 roster must keep today’s groups

After deleting the maps, hemoglobin/hematocrit/WBC/platelets/MCV remain `blood` and CBC members; glucose and HbA1c remain `metabolic` with no panel; TSH `thyroid`; ALT `liver`; creatinine–eGFR `kidney`. If a current article would drop out of its group, stop and fix the projection or record the binding gap — do not restore the slug table.

## Risks / Trade-offs

- [Category depends on assessment bindings] → Mitigation: projection-only read; articles do not store the binding. A display-only or unbound definition will not get a named category until the Registry names a Body system.
- [Multi-key articles disagree] → Mitigation: fail validation rather than majority vote. creatinine–eGFR must share kidney.
- [Panel list grows (iron studies on CBC members)] → Mitigation: accept Registry membership as truth; education copy can still explain “related, not guaranteed CBC.”
- [Apply before catalog collapse] → Acceptable: navigation can derive from current published records. Prefer applying after change 1 so admission and projection share one catalog.

## Migration Plan

1. Replace slug lookups in `toPublishedArticle` with Registry reads.
2. Point the article template at projected `relatedPanelKeys` / `panels`.
3. Delete the two maps.
4. Update EH-138 verifier: hemoglobin is blood + cbc via Registry; glucose has empty panels; no source-text for the map constants.
5. Rollback is a git revert.

## Open Questions

None. Unbound definitions have no category rather than a fallback slug.
