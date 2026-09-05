## ADDED Requirements

### Requirement: Knowledge Base has one catalog

The Knowledge Base SHALL expose one version-controlled catalog of articles. Every article SHALL have a unique identity of `type`, `locale`, and `slug`. `type` SHALL be `measurement` or `panel`. Markdown measurement bodies and typed panel records MAY exist as adapters behind that catalog; they SHALL NOT be separate catalogs with their own published-lookup interface. The production catalog MAY include unpublished records; unpublished records SHALL NOT appear in public projections.

#### Scenario: Duplicate identity is rejected

- **WHEN** two catalog records share the same type, locale, and slug
- **THEN** catalog validation fails
- **AND** no public projection from that catalog is considered valid

#### Scenario: Adapters do not create a second catalog

- **WHEN** a reader asks for the Knowledge Base article list
- **THEN** the response comes from the single catalog module
- **AND** it does not concatenate independently published measurement, panel, and publication corpora at the call site

#### Scenario: Empty measurement catalog is not a public source of truth

- **WHEN** a signed-in measurement education route looks up a slug that exists only in the markdown corpus
- **THEN** lookup uses the shared catalog
- **AND** it does not depend on an empty `MEASUREMENT_ARTICLES` list as the default corpus

### Requirement: Article lifecycle uses one vocabulary

Every article SHALL declare exactly one lifecycle state: `draft`, `in_review`, `published`, or `deprecated`. Adapters SHALL map any legacy `review` state to `in_review` before the record enters the catalog. Public and signed-in readers SHALL NOT branch on a second state enum.

#### Scenario: Markdown review state maps to in_review

- **WHEN** a markdown manifest article has status `review`
- **THEN** the catalog record's lifecycle is `in_review`
- **AND** public lookup does not treat `review` as a distinct public-eligible state

#### Scenario: Deprecated records stay in the catalog

- **WHEN** an article is `deprecated`
- **THEN** the catalog still stores it
- **AND** public lookup does not return its body
- **AND** deprecation redirect policy may still read the record

### Requirement: One publication-admission decision gates public reads

An article SHALL be public only when its lifecycle is `published`, `reviewedBy` is non-blank, `reviewedAt` is a valid past ISO-8601 timestamp, `sources` contains at least one uniquely identified HTTPS source, its Registry subject is an existing reviewed active measurement definition or an existing panel definition, and the review is not older than 365 days before the decision's `asOf` instant. Draft, `in_review`, deprecated, stale, unsourced, and unknown-subject articles SHALL fail closed. The same decision SHALL be used by public measurement article load, public Knowledge Base routes, public panel education overlay, measurement-definition href maps, and the release check.

#### Scenario: Fresh published measurement article is public everywhere

- **WHEN** a measurement article is `published` with valid review evidence, HTTPS sources, a reviewed Registry subject, and a review within 365 days
- **THEN** public measurement load returns it
- **AND** the href map exposes its measurement-definition keys
- **AND** the `/knowledge-base` public reader returns it
- **AND** the release check accepts it

#### Scenario: Stale published article is withheld everywhere

- **WHEN** a published article's `reviewedAt` is more than 365 days before `asOf`
- **THEN** public measurement load returns no article
- **AND** the href map omits its measurement-definition keys
- **AND** the `/knowledge-base` public reader returns no article
- **AND** the release check fails and lists that slug once in the stale report

#### Scenario: In-review panel education is not public

- **WHEN** the CBC panel article is `in_review`
- **THEN** the public panel overlay does not return the panel education article
- **AND** the public panel route may still render the Registry panel page without that overlay
- **AND** the signed-in Knowledge Base MAY still render the in-review CBC article through a non-public reader

#### Scenario: Href map does not bypass admission

- **WHEN** a measurement definition key belongs only to a draft, in-review, stale, or unpublished article
- **THEN** `getKnowledgeArticleHref` returns no href

### Requirement: Filesystem catalog stays off the client

Client modules SHALL NOT import Knowledge Base filesystem loaders, `node:fs`, or markdown hydration. Public href lookup from Biomarkers SHALL use a JSON-safe projection of already-admitted catalog records.

#### Scenario: Biomarkers table can resolve a published href

- **WHEN** a client Biomarkers table asks for a href for `hemoglobin_whole_blood` and that key belongs to a public article
- **THEN** the lookup returns `/knowledge/biomarkers/hemoglobin`
- **AND** the client module graph does not include the markdown filesystem loader

#### Scenario: Client import of filesystem load fails closed in verification

- **WHEN** verification inspects client Knowledge Base imports
- **THEN** it fails if a client module imports the markdown filesystem catalog module

### Requirement: Catalog remains independent of private health data

The catalog and publication-admission decision SHALL NOT read Observations, Documents, scores, or assessment bindings. Signed-in “your results” strips SHALL continue to use existing profile-scoped reads after the article is chosen.

#### Scenario: Public admission does not query a profile

- **WHEN** a public reader asks whether an article is public
- **THEN** the decision uses only catalog metadata, review evidence, freshness, and Registry subject identity
- **AND** it does not read Observations or session identity
