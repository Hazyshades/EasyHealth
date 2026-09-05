## ADDED Requirements

### Requirement: Knowledge Base index categories come from named Body system

The Knowledge Base index SHALL assign a published measurement article a `KnowledgeCategory` by reading the Registry’s named Body system for the article’s measurement-definition keys. Named Body system SHALL be the reviewed assessment binding’s `system` when that value is not `general`. The index SHALL NOT keep a per-slug category table. Article catalog records SHALL NOT store Body system, score role, or readiness groups.

#### Scenario: Hemoglobin groups under blood without a slug row

- **WHEN** the hemoglobin article is public and its measurement-definition keys have reviewed Body system `blood`
- **THEN** the index lists that article under the blood category
- **AND** `/knowledge?category=blood` includes it
- **AND** no `CATEGORY_BY_SLUG` entry is required

#### Scenario: Glucose groups under metabolic without a panel

- **WHEN** the glucose article is public and its measurement-definition keys have reviewed Body system `metabolic`
- **THEN** the index lists that article under the metabolic category
- **AND** related-panel keys may be empty

#### Scenario: Unnamed Body system is omitted from category groups

- **WHEN** every measurement-definition key on a public article has Body system `general` or no reviewed binding
- **THEN** the article remains public by catalog admission
- **AND** it does not appear under a category heading or category filter
- **AND** the projection does not invent a slug category

#### Scenario: Conflicting Body systems fail closed

- **WHEN** one public article lists measurement-definition keys whose reviewed named Body systems differ
- **THEN** index projection validation fails
- **AND** the article is not shown under a guessed category

### Requirement: Related panel links come from Registry panel membership

Related-panel keys on the index projection SHALL be the de-duplicated panel keys from `listPanelsForMeasurementDefinition` for the article’s measurement-definition keys, in Registry panel order. The public article page SHALL render those panels from the projection. The index SHALL NOT keep a per-slug related-panel table. Curated `relatedMeasurementKeys` on the article SHALL remain editorial and SHALL NOT be treated as panel membership.

#### Scenario: CBC members link to the CBC panel from Registry membership

- **WHEN** a public hemoglobin article’s definition is a CBC panel member
- **THEN** the index record’s related-panel keys include `cbc`
- **AND** the article page can link to `/knowledge/panels/cbc`
- **AND** no `RELATED_PANEL_KEYS_BY_SLUG` entry is required

#### Scenario: Panel filter uses Registry membership

- **WHEN** a user opens `/knowledge?panel=cbc`
- **THEN** the index shows only public articles whose definitions are CBC members in the Panel Registry
- **AND** glucose is absent when it is not a CBC member

#### Scenario: Editorial related measurements stay on the article

- **WHEN** a public article lists `relatedMeasurementKeys`
- **THEN** those keys remain curated article metadata
- **AND** they do not replace Registry panel membership for panel filters or related-panel links

### Requirement: Index projection does not copy assessment policy onto the catalog

The index projection MAY read reviewed assessment-binding Body system to group education. It SHALL NOT persist that binding on the Knowledge Base catalog record, SHALL NOT use score role or readiness groups as category evidence, and SHALL NOT read Observations, Documents, or session identity.

#### Scenario: Category lookup does not query a profile

- **WHEN** the public index builds category groups
- **THEN** it uses catalog-published articles plus Registry Body system and panel membership
- **AND** it does not read Observations or scores

#### Scenario: Catalog record stays free of assessment fields

- **WHEN** a maintainer inspects a Knowledge Base catalog article
- **THEN** the record has no `system`, `scoreRole`, or readiness-group field
- **AND** Body system appears only on the index projection
