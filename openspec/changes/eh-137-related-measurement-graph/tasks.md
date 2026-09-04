## 1. Curated graph contract

- [x] 1.1 Add versioned graph node, edge, relationship-type, and curated same-analyte variant types under `src/lib/knowledge/`.
- [x] 1.2 Project panel memberships from the existing panel registry and validate reviewed keys, roles, ordering, edge uniqueness, analyte identity, and variant axes.
- [x] 1.3 Add deterministic measurement/panel query helpers, canonical serialization, and graph digest exports without importing the graph into resolver or assessment paths.

## 2. Read-only API

- [x] 2.1 Add `GET /api/knowledge/measurements/[key]/relationships` with reviewed-key validation, `404` handling, versioned JSON, and no profile/observation access.

## 3. Biomarkers presentation

- [x] 3.1 Build a reusable responsive relationship component with visible type labels, neutral descriptions, graph version, links for measurement neighbors, and explicit no-scoring copy.
- [x] 3.2 Load the selected measurement graph from the public endpoint in the Biomarkers page and preserve primary-table/trend behavior across loading, error, and empty states.

## 4. Regression and delivery evidence

- [x] 4.1 Add synthetic focused verification for graph curation, queries, determinism, API-safe serialization, invalid keys, and resolver/assessment independence; register `test:eh137`.
- [x] 4.2 Create `QA/eh-137/checklist.md` with executable synthetic-data UI checks and separate developer evidence requirements.
- [x] 4.3 Run OpenSpec validation, focused graph/UI checks, typecheck, and the required Registry documentation drift/tests; record Registry docs/Wiki status without claiming unrelated catalog changes.
