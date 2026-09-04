## ADDED Requirements

### Requirement: Knowledge Base articles SHALL use an explicit review lifecycle

Every Knowledge Base article SHALL declare a stable slug, article type, locale, positive content version, title, summary, Markdown body, and exactly one lifecycle state: `draft`, `review`, `published`, or `deprecated`. Article metadata SHALL remain independent from Registry resolution and assessment inputs.

#### Scenario: Draft and review content remain non-public

- **WHEN** an article has state `draft` or `review`
- **THEN** the article SHALL remain available to local validation and editorial tooling
- **AND** the public article reader SHALL not return or render the article

#### Scenario: Invalid article identity fails validation

- **WHEN** two articles declare the same slug, or a slug is not lowercase kebab-case
- **THEN** the Knowledge Base validation SHALL fail
- **AND** no article from the invalid registry SHALL be considered publishable

### Requirement: Published content SHALL have review and source evidence

An article SHALL be eligible for public publication only when its state is `published`, `reviewedBy` is non-blank, `reviewedAt` is a valid past ISO-8601 timestamp, and `sources` contains at least one uniquely identified HTTPS source with a non-blank title. Missing or malformed evidence SHALL fail the build validation rather than being inferred.

#### Scenario: Unreviewed article cannot publish

- **WHEN** a published article has no reviewer or no review timestamp
- **THEN** the publication decision SHALL be blocked
- **AND** the public reader SHALL not return the article
- **AND** the build validation SHALL report the article slug and missing evidence

#### Scenario: Published article with sources is eligible while fresh

- **WHEN** a published article has reviewer metadata, at least one valid HTTPS source, and its review timestamp is within the freshness window
- **THEN** the publication decision SHALL be public
- **AND** the article SHALL be available to the public route

#### Scenario: Source evidence is not silently substituted

- **WHEN** a published article has an empty source list or a source with an invalid URL/title
- **THEN** validation SHALL fail
- **AND** the reader SHALL not publish the article using a placeholder or inferred source

### Requirement: Stale published content SHALL be reported and withheld

The publication policy SHALL use a versioned, explicit freshness window of 365 days from `reviewedAt`. The stale-content report SHALL list every published article whose review is older than that window, including its slug, content version, reviewer, review timestamp, and age in days. Stale articles SHALL not be returned as public content, and the release check SHALL fail until each stale article is re-reviewed or deprecated.

#### Scenario: Stale article appears in the report

- **WHEN** a published article's review timestamp is more than 365 days before the report's `asOf` timestamp
- **THEN** the report SHALL include exactly that article once
- **AND** the article SHALL be withheld from public reads
- **AND** the check SHALL exit non-zero

#### Scenario: Boundary review remains fresh

- **WHEN** a published article was reviewed exactly 365 days before `asOf`
- **THEN** the article SHALL remain fresh
- **AND** it SHALL not appear in the stale report

### Requirement: Public article pages SHALL display governance metadata

The canonical Knowledge Base article route SHALL render only policy-approved articles. Each rendered article page SHALL visibly show the article title, a localized last reviewed date linked to the stored `reviewedAt`, a list of all curated sources with their titles and links, and the mandatory medical disclaimer. The route SHALL not require or query a signed-in user's private data.

#### Scenario: Reader sees review and source metadata

- **WHEN** a reader opens a fresh published article
- **THEN** the page SHALL display `Last reviewed` with a `<time>` value matching `reviewedAt`
- **AND** the page SHALL display every source title and HTTPS link
- **AND** the page SHALL display the medical disclaimer

#### Scenario: Non-public article is not rendered

- **WHEN** a reader opens a draft, review, stale, or unknown slug
- **THEN** the route SHALL respond with the framework's not-found result
- **AND** the article body and governance metadata SHALL not be exposed

### Requirement: Deprecated article slugs SHALL redirect safely

A deprecated article SHALL declare an optional replacement slug and deprecation timestamp. The canonical route SHALL permanently redirect a deprecated slug to the replacement only when that replacement is itself a fresh published article; otherwise it SHALL permanently redirect to the internal Knowledge Base index. Redirect destinations SHALL be internal paths derived from validated slugs and SHALL never be arbitrary URLs.

#### Scenario: Deprecated article has a valid replacement

- **WHEN** a reader opens a deprecated slug with a fresh published replacement
- **THEN** the route SHALL issue a permanent redirect to `/knowledge-base/<replacement-slug>`
- **AND** it SHALL not render the deprecated body

#### Scenario: Deprecated replacement is unavailable

- **WHEN** a deprecated slug has no replacement, or its replacement is draft, review, stale, deprecated, or missing
- **THEN** the route SHALL issue a permanent redirect to `/knowledge-base`
- **AND** it SHALL not redirect to an external URL or an unreviewed article

#### Scenario: Self-referential deprecation is rejected

- **WHEN** a deprecated article names its own slug as the replacement
- **THEN** build validation SHALL fail
- **AND** the route SHALL not use that target for redirection

### Requirement: Publication governance SHALL be a build and CI gate

The repository SHALL expose a real-registry check and a deterministic behavioral verifier. The production build preflight SHALL run the real-registry check, and the behavioral verifier SHALL be reachable from CI. The governance gate SHALL not change database migrations, Registry behavior, assessment logic, or score inputs.

#### Scenario: Invalid content blocks production build

- **WHEN** the real Knowledge Base registry contains a published article missing review evidence, sources, or freshness
- **THEN** the Knowledge Base check SHALL fail with a non-zero exit status
- **AND** the production build SHALL stop before Next.js compilation

#### Scenario: Behavioral verifier protects the contract

- **WHEN** the Knowledge Base verifier runs against deterministic fixtures
- **THEN** it SHALL cover lifecycle visibility, publication evidence, stale reporting, deprecation targets, and rendered metadata
- **AND** it SHALL exit successfully only when all assertions pass
