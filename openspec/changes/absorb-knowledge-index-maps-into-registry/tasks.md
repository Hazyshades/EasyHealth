## 1. Index projection

- [x] 1.1 Derive education category from the reviewed named Body system of the article’s measurement-definition keys (`general`/unbound → no category; conflicting named systems fail closed).
- [x] 1.2 Derive related-panel keys from `listPanelsForMeasurementDefinition` across those keys, de-duplicated in Registry panel order.
- [x] 1.3 Delete `CATEGORY_BY_SLUG` and `RELATED_PANEL_KEYS_BY_SLUG`; stop omitting articles solely because they lack a slug-table row.

## 2. Readers

- [x] 2.1 Point the public article related-panel links at the projection (or `article.panels`), not a second slug lookup.
- [x] 2.2 Keep category filter and panel filter on `/knowledge` wired to the same projection; do not copy Body system onto catalog records.

## 3. Verification

- [x] 3.1 Cover EH-136 roster parity: CBC members → blood + `cbc`; glucose/HbA1c → metabolic with no panel; TSH thyroid; ALT liver; creatinine–eGFR kidney.
- [x] 3.2 Cover unbound/`general` omitted from category groups, conflicting Body systems failing validation, and panel filter using Registry membership only.
- [x] 3.3 Update `scripts/verify-eh138-knowledge-base.ts` off source-text assertions for the slug maps.

## 4. OpenSpec completion

- [x] 4.1 Run focused EH-138 (and Knowledge Base) verifiers, typecheck, and `openspec validate absorb-knowledge-index-maps-into-registry --type change --strict`; record only observed results.
