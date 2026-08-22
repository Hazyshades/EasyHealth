## Context

EH-125 provides six immutable Registry 2.0 panel definitions with ordered `required`/`optional` memberships. The current application already exposes two authenticated read surfaces: `/api/documents` returns profile-owned source documents and `/api/biomarkers` returns current, projected laboratory observations with Registry 2.0 keys, unit presentation, source page metadata, and document IDs. The checkout has no Health Timeline route or panelized event component, so EH-128 needs a small timeline host even though EH-127 is listed as a roadmap dependency.

The implementation must preserve the existing source-of-truth boundaries: panel aliases are catalog metadata only; only a normalized reviewed measurement definition key can place an observation in a panel; panel membership cannot change resolver or assessment behavior; and a missing member is a reporting fact, not a medical finding.

## Goals / Non-Goals

**Goals:**

- Produce a pure, deterministic event grouping projection from the existing panel registry and normalized observation read model.
- Detect panels from observed Registry 2.0 definition keys, render members in catalog order, and retain shared many-to-many membership.
- Keep every observation visible exactly once in either one or more panel groups or the ungrouped section.
- Render absent members with neutral copy and no warning/error treatment.
- Provide a usable `/app/timeline` host with authenticated profile data, event-date ordering, document-type/date filters, incremental pagination, and source-document/page links.
- Exercise the contract with a focused TypeScript verification runner and synthetic fixtures.

**Non-Goals:**

- No database table, migration, RPC, backfill, or new write path.
- No panel detection from document filenames, lab names, OCR headings, alternate names, or partial free-text matches.
- No panel completeness score, clinical interpretation, diagnosis, reference-range status, or changes to Health Profile assessment eligibility.
- No repeated-measurement comparison, duplicate-document merge, or knowledge-base panel article.
- No change to the EH-125 panel roster or generated Registry documentation content.

## Decisions

### 1. Compose existing authenticated read APIs instead of adding persistence

The timeline page will load `/api/documents` and `/api/biomarkers` in parallel. Both routes already enforce the active session profile and current-source filtering, and the biomarker route already applies the user's lab unit presentation. The page joins observations to documents by `document_id`; this avoids a new SQL/RPC contract and keeps EH-128 read-only.

**Alternative:** add a dedicated `/api/timeline` query. Rejected for this slice because it would duplicate the mature observation projection and introduce a second source boundary before EH-127's event model exists.

### 2. Use a pure registry-key grouping projection

`src/lib/timeline/panel-grouping.ts` will accept observations and the panel definitions (defaulting to the runtime registry) and return ordered panel groups plus ungrouped observations. A panel is detected only when at least one observation has a member's exact `measurement_definition_key`. Each detected panel exposes all catalog members; members without observations carry an empty observation list and neutral UI metadata. Rows with no panel membership, including unresolved rows, go to `ungrouped`.

An observation is assigned to every owning panel, so shared definitions such as hemoglobin remain visible in both CBC and iron studies. The grouping projection marks the row as panel-assigned once, preventing a duplicate in `ungrouped`, but does not deduplicate it across panels.

**Alternative:** derive panels from raw names or panel aliases. Rejected because aliases are not extraction evidence and would allow false clinical grouping.

### 3. Keep the grouping model separate from presentation

The helper returns serializable member/observation metadata; `src/components/timeline/laboratory-event-card.tsx` owns copy, layout, neutral missing states, and links. This keeps deterministic behavior testable without a browser and lets the UI show the same projection on desktop and mobile.

### 4. Treat absence as neutral reporting metadata

Detected panels render a compact reported count and every member row. A missing row says `Not reported in this event` in muted text, regardless of `required` or `optional` role. No amber/red status, warning icon, completeness percentage, or “abnormal” language is used for absence. Numeric values and source links remain factual; existing reference ranges are displayed as document data only.

### 5. Add a thin timeline host for the missing dependency

Add `/app/timeline`, a `Timeline` navigation item, and page metadata. The page renders all supported document types as chronological event cards. Laboratory cards use the panel grouping projection; other event types retain a simple source-linked card so the page remains useful while future EH-127 structured event projections mature. Filters are client-side over the authenticated document result: type chips, an exact observed-date input, and a “Load more” page window.

**Alternative:** put panels inside the Documents table. Rejected because EH-128 explicitly targets laboratory events and the roadmap's product flow is a single chronological timeline; a table row cannot represent panel member grouping without duplicating the timeline model.

### 6. Preserve provenance through existing document deep links

Each laboratory event links to `/app/documents/<document-id>`. A member source link appends `?page=<source_page>` when the API provides a positive source page, preserving the existing `DocumentViewer` page query contract. The UI never invents a page; when absent, it links only to the document.

### 7. Verify behavior with pure synthetic fixtures

Add `scripts/verify-eh128-panel-grouping.ts` and a `test:eh128` package script. Fixtures cover a CBC subset with a missing optional member, an iron/CBC shared hemoglobin row, a non-panel normalized definition, an unresolved row, and an alias-looking filename/name that must not trigger a panel. Assertions cover stable ordering, neutral missing state metadata, many-to-many projection, ungrouped preservation, and page/document provenance URL construction.

## Risks / Trade-offs

- **[Risk]** Loading all profile documents and biomarkers before client pagination is less efficient for very large records. **Mitigation:** keep the rendered window bounded, use existing no-store APIs, and leave server pagination for the EH-127 event-model slice rather than inventing a second backend contract here.
- **[Risk]** A shared definition appears in multiple panel groups and could look duplicated. **Mitigation:** preserve the registry's many-to-many semantics and add a small “also part of another panel” explanation only if the row is visibly repeated; never hide a valid membership to make the UI look deduplicated.
- **[Risk]** A panel with one observed member displays many neutral missing rows. **Mitigation:** show detected panels only when at least one member is present, keep missing rows compact, and use neutral wording with no clinical severity styling.
- **[Risk]** Existing API response shapes evolve independently. **Mitigation:** use narrow local read types, tolerate null/legacy fields, and keep the grouping helper independent from Supabase relations.
- **[Risk]** Generated Registry documentation could drift during a consumer-only change. **Mitigation:** run the required registry documentation generation, drift, and test commands and record that canonical docs/Wiki are unchanged or pending publication.

## Migration Plan

1. Add the pure grouping helper, timeline event card, timeline page, navigation metadata, and focused runner; no data migration is required.
2. Deploy the read-only route with the existing document and biomarker APIs.
3. Verify `test:eh128`, typecheck, build, and the registry documentation checks; manually exercise synthetic lab events in the timeline.
4. Rollback by removing the timeline route/navigation and helper consumer; stored observations and the EH-125 panel registry remain untouched.

## Open Questions

- EH-127 may later replace the client-composed document/biomarker join with a server-paginated normalized medical-event API. That migration is intentionally deferred; this change keeps the grouping helper API independent so the later event source can be swapped without changing panel rendering.
- A later navigation/deep-link change may add selected-member URL state; EH-128 only guarantees document and source-page links.
