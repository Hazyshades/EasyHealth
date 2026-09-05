## ADDED Requirements

### Requirement: Knowledge Base articles render through one article-page module

Public and signed-in Knowledge Base article routes SHALL render measurement and panel education through one article-page module. That module SHALL display title, summary, last reviewed date, every HTTPS source, educational body, and the medical disclaimer. Type-specific sections (measurement identity facts, panel subgroups) MAY live in the module implementation. Separate page trees SHALL NOT re-implement the shared education chrome.

#### Scenario: Public measurement article uses the article-page module

- **WHEN** a reader opens a public measurement article at `/knowledge/biomarkers/hemoglobin`
- **THEN** the page is rendered by the article-page module
- **AND** it shows title, last reviewed date, sources, body, and medical disclaimer
- **AND** it does not read Observations

#### Scenario: Public panel education uses the same module

- **WHEN** a panel article is public and a reader opens `/knowledge/panels/<key>`
- **THEN** the education overlay is rendered by the same article-page module
- **AND** it does not read Observations

#### Scenario: Signed-in article reuses the module

- **WHEN** a signed-in reader opens a Knowledge Base article under `/app/knowledge`
- **THEN** the education chrome comes from the same article-page module
- **AND** the signed-in adapter MAY add a profile-scoped results strip from existing Observation reads

### Requirement: Public and signed-in adapters are the only article-page seams

The public adapter SHALL use only the catalog’s public reader and SHALL NOT query session identity, Observations, Documents, or `/api/biomarkers`. The signed-in adapter SHALL use the existing profile-scoped Biomarkers read for the results strip and MAY use the catalog’s non-public reader for `in_review` panel education. Public routes SHALL NOT call the non-public reader.

#### Scenario: Public adapter has no profile data

- **WHEN** an anonymous reader opens any `/knowledge` article route
- **THEN** the response contains only catalog education
- **AND** it does not include Observation values, document filenames, or a results strip

#### Scenario: Signed-in adapter may show in-review CBC

- **WHEN** a signed-in reader opens `/app/knowledge/panels/cbc` and CBC is `in_review`
- **THEN** the signed-in adapter MAY render the CBC article
- **AND** public `/knowledge/panels/cbc` still does not return that education overlay

#### Scenario: Signed-in measurement slug uses the shared catalog

- **WHEN** a signed-in reader opens `/app/knowledge/measurements/<slug>`
- **THEN** lookup uses the shared Knowledge Base catalog
- **AND** a missing or non-readable article yields not-found
- **AND** lookup does not use an empty private measurement catalog

### Requirement: `/knowledge` is the canonical public Knowledge Base URL family

The public Knowledge Base index SHALL be `/knowledge`. A public measurement article SHALL live at `/knowledge/biomarkers/<slug>`. A public panel page SHALL live at `/knowledge/panels/<key>`. `KNOWLEDGE_BASE_ROUTE` and new public hrefs SHALL use this family. The public search index MAY remain a separate page from the article-page module.

#### Scenario: Published measurement keeps the Biomarkers href

- **WHEN** a measurement definition has a public article with slug `hemoglobin`
- **THEN** the href is `/knowledge/biomarkers/hemoglobin`

#### Scenario: Public index stays at /knowledge

- **WHEN** a reader opens the public Knowledge Base home
- **THEN** the URL is `/knowledge`
- **AND** EH-138 search and filters remain available on that index

### Requirement: `/knowledge-base` permanently redirects to canonical public paths

`/knowledge-base` SHALL permanently redirect to `/knowledge`. `/knowledge-base/<slug>` SHALL permanently redirect to the catalog’s canonical public path for that slug when the article is public; otherwise it SHALL permanently redirect to `/knowledge`. Deprecated slugs SHALL follow the catalog deprecation redirect onto the `/knowledge` family, never to an external URL. Redirect routes SHALL NOT render article bodies.

#### Scenario: Index redirect

- **WHEN** a reader opens `/knowledge-base`
- **THEN** the route issues a permanent redirect to `/knowledge`
- **AND** it does not render a second index

#### Scenario: Published slug redirect

- **WHEN** a public measurement article has slug `alt`
- **AND** a reader opens `/knowledge-base/alt`
- **THEN** the route issues a permanent redirect to `/knowledge/biomarkers/alt`

#### Scenario: Unknown or non-public slug redirect

- **WHEN** a reader opens `/knowledge-base/<slug>` for a missing, draft, `in_review`, or stale article
- **THEN** the route issues a permanent redirect to `/knowledge`
- **AND** it does not render the article body

#### Scenario: Deprecated slug stays internal

- **WHEN** a deprecated article has a public replacement
- **THEN** `/knowledge-base/<deprecated-slug>` permanently redirects to the replacement’s `/knowledge` path
- **AND** if the replacement is not public, it permanently redirects to `/knowledge`
