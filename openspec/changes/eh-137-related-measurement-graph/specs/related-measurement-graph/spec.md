## ADDED Requirements

### Requirement: The relationship graph SHALL be versioned and curated

The system SHALL publish a deterministic graph release with a non-empty graph version. Graph nodes SHALL reference only existing reviewed Registry 2.0 measurement definitions or existing static panel definitions. Panel-member edges SHALL be projected from the released panel registry, while measurement-to-measurement edges SHALL be explicit curated records.

#### Scenario: A graph release identifies its source version

- **WHEN** a consumer queries a reviewed measurement's relationship graph
- **THEN** the response includes a non-empty graph version
- **AND** every returned edge carries the same graph version
- **AND** the response identifies the requested measurement as its root node

#### Scenario: An unreviewed or unknown definition cannot enter the graph

- **WHEN** graph validation or a graph query receives an unknown, provisional, or retired measurement key
- **THEN** validation reports the invalid graph member or the query returns no graph
- **AND** no fallback node is synthesized from the raw key

### Requirement: The graph SHALL expose only safe relationship types

The graph SHALL expose a typed `panel_member` relationship from a panel to a measurement and a typed `related_measurement` relationship between reviewed definitions of the same analyte. A related edge SHALL declare the curated identity axis it relates (`specimen`, `timing`, or `property`) and a neutral description. Panel membership SHALL retain its `required` or `optional` role and display order.

#### Scenario: A panel member is represented as catalog metadata

- **WHEN** a consumer queries a measurement belonging to two panels
- **THEN** the graph returns one `panel_member` edge for each owning panel
- **AND** each edge exposes the panel name and the existing member role/order
- **AND** the edge does not provide specimen evidence or an assessment binding

#### Scenario: A same-analyte variant is represented explicitly

- **WHEN** a curated serum/plasma, timing, or property variant is queried
- **THEN** the graph returns one `related_measurement` edge with the matching axis label
- **AND** the related definition is a reviewed Registry 2.0 definition of the same analyte
- **AND** the response does not state a diagnosis, treatment, or clinical equivalence claim

#### Scenario: Invalid relationship curation is rejected

- **WHEN** graph validation receives a duplicate edge, self-link, unknown key, cross-analyte link, or identity axis that does not match the definitions
- **THEN** validation fails with a reason identifying the invalid edge
- **AND** the invalid edge is not included in a released graph

### Requirement: Graph queries SHALL be deterministic and non-mutating

The system SHALL provide pure queries for a measurement's neighboring nodes, a panel's member nodes, and the complete released edge projection. Query results SHALL be stable regardless of input collection order, and querying the graph SHALL not mutate registry data or observation/assessment state.

#### Scenario: Source ordering does not change graph serialization

- **WHEN** the same valid graph inputs are supplied in different array orders
- **THEN** canonical serialization and digest are identical
- **AND** nodes and edges are returned in deterministic order

#### Scenario: Graph lookup has no resolver or score side effect

- **WHEN** a consumer queries measurement and panel relationships
- **THEN** the resolver result for a fixed input is unchanged
- **AND** assessment binding, score role, readiness groups, and contribution groups are unchanged
- **AND** no observation or database write is performed

### Requirement: The relationship API SHALL be public catalog metadata only

The system SHALL expose `GET /api/knowledge/measurements/{measurementDefinitionKey}/relationships` as a read-only endpoint for a reviewed definition. A successful response SHALL contain only the graph version, root node, catalog nodes, and typed edges. Unknown, provisional, retired, or invalid keys SHALL return `404`; the route SHALL not read or return profile, observation, or document data.

#### Scenario: A reviewed measurement graph is fetched

- **WHEN** a client requests the encoded key `alt_serum_catalytic_activity`
- **THEN** the endpoint returns `200`
- **AND** the JSON includes the graph version and labeled panel/measurement edges
- **AND** the response contains no profile identifier or observation value

#### Scenario: An invalid key is fetched

- **WHEN** a client requests an unknown or non-reviewed measurement key
- **THEN** the endpoint returns `404`
- **AND** the response does not create a graph from the request string

### Requirement: The UI SHALL label educational relationships without clinical inference

The Biomarkers surface SHALL render a reusable relationship component for the selected concrete measurement when a graph is available. Each visible edge SHALL show the neighboring panel or measurement, a human-readable relationship-type label, and its neutral curated description. The component SHALL state that catalog relationships do not alter assessment scores or provide medical advice, and loading/error/empty states SHALL not hide or change the primary observation surface.

#### Scenario: A selected measurement shows panel and related links

- **WHEN** an authenticated user selects a measurement with curated graph edges
- **THEN** the Biomarkers surface shows the measurement's related-relationships section
- **AND** each edge visibly labels `Panel member` or `Related measurement`
- **AND** measurement neighbors link to the existing measurement context without exposing another user's data

#### Scenario: Relationship data is unavailable or empty

- **WHEN** the graph request fails, is loading, or returns no curated edges
- **THEN** the relationship section shows a bounded loading, neutral error, or neutral empty state
- **AND** the existing biomarker table, trends, and scoring-related UI remain usable and unchanged

### Requirement: Graph behavior SHALL have reproducible verification evidence

The repository SHALL provide a focused verification command covering graph validation, curated edge queries, deterministic serialization, invalid-key behavior, API-safe serialization, and assessment independence. The verification SHALL use synthetic catalog fixtures and SHALL not require patient data or a database migration.

#### Scenario: The focused graph contract check passes

- **WHEN** the EH-137 verification command runs
- **THEN** it proves the released graph is valid and deterministic
- **AND** it proves panel and same-analyte relationships are labeled and queryable
- **AND** it proves graph queries do not change resolver or assessment projections
