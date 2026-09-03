## Why

EasyHealth already has reviewed Registry 2.0 measurement definitions and static panel membership, but it has no governed way to explain how those catalog entities relate. Users therefore cannot follow a safe educational path from a measurement to its panel or to a reviewed variant, while any ad-hoc relationship logic could be mistaken for assessment or disease inference.

EH-137 delivers a small, read-only relationship graph now so later Knowledge Base article and navigation work can consume one versioned contract rather than inventing separate links.

## What Changes

- Add a versioned, curated relationship graph for reviewed Registry 2.0 measurement definitions and existing panels.
- Define explicit relationship types for panel membership and related measurement links, with user-facing labels and neutral educational descriptions.
- Provide deterministic query helpers for a measurement's neighboring panels and related definitions, rejecting unknown or non-reviewed graph members.
- Expose a read-only API response containing the graph version, root node, typed nodes, and labeled edges; it contains no profile or observation data.
- Add a reusable responsive display component and render it from the authenticated Biomarkers surface for the selected measurement.
- Keep graph data outside resolver, assessment, score-readiness, and Health Profile projection paths; no disease, diagnosis, reference-range, or treatment inference is introduced.
- Add focused contract verification for curated edges, version/determinism, unknown-key handling, API-safe serialization, and assessment independence.

## Capabilities

### New Capabilities

- `related-measurement-graph`: Versioned, curated educational relationships among reviewed measurement definitions and panels, including read/query, API, and presentation contracts.

### Modified Capabilities

<!-- No existing main capability spec currently defines Knowledge Base relationships. The existing panel-registry contract is consumed, not changed. -->

## Impact

- Target domain: `health-profile` Registry 2.0 catalog consumers, with a separate educational Knowledge Base surface.
- New runtime modules under `src/lib/knowledge/` and a read-only route under `src/app/api/knowledge/`.
- Biomarkers page and a reusable UI component gain a factual relationship section; existing observation values, trends, and scoring remain unchanged.
- Focused verification and package-script coverage are added, along with `QA/eh-137/checklist.md`.
- No database migration, persistence, worker change, user-data query, or breaking API change is required. Existing panel definitions and measurement definitions remain the source of truth for referenced keys.
