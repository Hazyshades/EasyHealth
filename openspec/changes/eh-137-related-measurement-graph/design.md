## Context

The checkout already has a static Registry 2.0 catalog (`src/lib/biomarkers/measurement-resolution.ts`) and six reviewed panel definitions (`src/lib/biomarkers/panel-registry.ts`). The authenticated Biomarkers page can select a concrete measurement definition, but there is no separate, governed educational relationship contract. EH-133's Knowledge Base content schema and EH-134/135 article surfaces are not implemented in this checkout, so this change must provide a reusable graph contract without creating an article model or coupling graph data to patient observations.

The graph is catalog knowledge: it may describe a reviewed measurement's panel membership or a deliberately curated variant of the same analyte. It is not resolver evidence, an assessment binding, a reference-range source, or a clinical interpretation.

## Goals / Non-Goals

**Goals:**

- Publish a deterministic, versioned graph whose nodes are reviewed Registry 2.0 measurement definitions and existing panels.
- Represent panel membership without duplicating or modifying `PanelDefinition` or `MeasurementDefinition` records.
- Represent a small explicit set of neutral, same-analyte measurement relationships with a labeled variant axis.
- Provide pure measurement/panel query helpers and a read-only serialized HTTP endpoint.
- Render relationship type, neighbor name, and neutral description in a reusable responsive component.
- Make the component reachable from the existing Biomarkers page for the selected measurement.
- Prove that graph lookup does not change resolver output or any Registry 2.0 score/readiness projection.

**Non-Goals:**

- No Knowledge Base article schema, publication workflow, index, search, or panel article; those remain EH-133/EH-134/EH-135 work.
- No database table, migration, RPC, profile/observation query, worker change, or user-specific relationship.
- No new measurement definitions, panel members, aliases, units, specimen policies, assessment bindings, or score rules.
- No disease, diagnosis, treatment, ordering, universal reference-range, or abnormality inference.
- No inference of relationships from labels, analyte names, body systems, score roles, observations, or document text.

## Decisions

### 1. Keep graph data in a dedicated educational module

Add `src/lib/knowledge/measurement-relationship-graph.ts`. The module imports the existing Registry 2.0 and panel registries only as read sources. Panel-member edges are projected from the curated panel memberships; measurement-to-measurement edges are explicit source records in the new module. This avoids a second panel roster and keeps graph meaning separate from resolver and assessment code.

The graph has the independent release version `2026-09-01.0`. Every serialized graph and edge carries that version. A canonical serializer and SHA-256 digest sort node/edge projections so source-array ordering cannot change the released representation. The graph version is intentionally independent of the Registry manifest version: adding an educational edge must not masquerade as a change to identity, units, resolver behavior, or scoring.

**Alternative rejected:** add `relatedMeasurements` fields to every `MeasurementDefinition` or `PanelDefinition`. That would broaden the Registry identity contract, require every catalog record to carry educational metadata, and make a content relationship edit look like a clinical catalog change.

### 2. Use two deliberately narrow relationship types

The public edge union is:

- `panel_member`: a panel node points to one reviewed measurement node and carries the existing `required`/`optional` role and display order.
- `related_measurement`: one reviewed measurement node points to another reviewed measurement of the same analyte and carries an explicit axis (`specimen`, `timing`, or `property`) plus a neutral description.

Related edges are authored once in canonical direction and treated as undirected by measurement queries, so the API does not require mirrored records. Validation rejects self-links, duplicate keys, unknown keys, non-reviewed definitions, cross-analyte links, and an axis that does not match the identity difference. User-facing labels come from a fixed type-label map rather than raw author text.

**Alternative rejected:** derive all same-analyte pairs automatically. Identity-axis similarity alone is not a clinical curation decision and would expose relationships that have not been reviewed.

### 3. Expose pure queries and a static public API

The module provides:

- `listMeasurementRelationshipEdges()` for the complete released projection;
- `getMeasurementRelationshipGraph(measurementDefinitionKey)` for one reviewed measurement and its neighboring panels/measurements;
- `getPanelRelationshipGraph(panelKey)` for a panel and its member measurements;
- `validateMeasurementRelationshipGraph()` and canonical serialization/digest helpers.

Add `GET /api/knowledge/measurements/[key]/relationships`. It returns the graph version, root node, nodes, and typed edges for a reviewed definition. Unknown, retired, provisional, or non-Registry keys return `404`. The route performs no session or profile lookup because the payload is public catalog metadata and contains no observation data. A bounded public cache can be used because each graph response is versioned.

**Alternative rejected:** add graph data to `GET /api/biomarkers`. That route is profile-owned, uses `no-store`, and would mix general education with private observation projection.

### 4. Render relationships as factual progressive disclosure

Add `src/components/knowledge/related-measurement-graph.tsx` as a presentational component. It displays the selected measurement, each neighbor, a visible relationship-type chip (`Panel member` or `Related measurement`), the curated neutral description, panel role where applicable, and the graph version. Measurement neighbors link back to the existing Biomarkers route with the measurement query parameter; panel neighbors remain factual labels until a panel article route exists. The component includes a short boundary statement that these catalog links do not change assessment scores or provide medical advice.

The Biomarkers page fetches the selected measurement graph from the public endpoint. Loading, error, and empty states remain local to the educational section and never hide or alter the user's measurements, trends, or score-related UI. The graph is rendered only for a selected concrete measurement key; unresolved observations cannot create a graph request.

### 5. Verify the contract without browser or database fixtures

Add `scripts/verify-eh137-related-measurement-graph.ts` and `test:eh137`. The runner validates the released graph, checks panel and same-analyte variant queries, checks unknown/non-reviewed behavior, asserts deterministic serialization and digest, verifies JSON-safe API shape, and snapshots resolver plus assessment/readiness outputs before and after graph queries. No database fixture is needed because the feature is static and read-only; manual UI coverage is recorded separately in `QA/eh-137/checklist.md`.

## Risks / Trade-offs

- **[Risk]** Panel membership changes could make the educational projection stale. **Mitigation:** derive panel edges from `PANEL_DEFINITIONS`, validate role/order/key agreement, and include the panel registry version in canonical serialization.
- **[Risk]** A neutral “related” label could be read as clinical equivalence. **Mitigation:** require same-analyte reviewed definitions, expose the exact variant axis and description, and show the educational/no-scoring boundary in the component.
- **[Risk]** A public endpoint could accidentally expose patient data. **Mitigation:** route reads only static registries, performs no Supabase/session query, and serializes only catalog node/edge metadata.
- **[Risk]** A failed relationship fetch could distract from the primary Biomarkers task. **Mitigation:** keep the section non-blocking with a compact error state and preserve the existing observations page.
- **[Risk]** The page may request a graph for a definition with no curated neighbors. **Mitigation:** return a valid versioned root with an explicit empty state; do not invent fallback relationships.

## Migration Plan

1. Add the dedicated graph types, curated edges, projection/query helpers, validator, serializer, and digest.
2. Add the public GET route, reusable component, and Biomarkers-page fetch/render seam.
3. Add focused verification and the package script; run it with the existing Registry and type checks.
4. Create the required manual QA checklist with synthetic-data preconditions and developer evidence references.
5. Roll back by removing the route/component/page seam and graph module; no stored data or Registry catalog records require migration.
6. EH-133/134/135 can later consume the same query helpers from Knowledge Base pages without changing the graph contract.

## Open Questions

- Future Knowledge Base article routes may choose different URLs for measurement and panel neighbors; this change keeps links on the existing Biomarkers surface until those routes exist.
- Clinical Product may later approve additional relationship types or edge descriptions; those require a new graph version and focused curation evidence rather than automatic expansion.
