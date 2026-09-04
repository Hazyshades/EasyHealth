## ADDED Requirements

### Requirement: Measurement education content is typed and review-gated

The Knowledge Base SHALL represent a measurement article as a versioned record with a concrete `measurementDefinitionKey`, kebab-case `slug`, locale, `contentVersion`, review status, review metadata, educational sections, at least one source, related measurement definition keys, and deprecation metadata. A record SHALL be eligible for the user-facing route only when its status is `published`, its referenced Registry definition is active and reviewed, its `reviewedBy` and `reviewedAt` values are present, and every source uses HTTPS. Draft, in-review, deprecated, structurally invalid, or definition-less records SHALL NOT be returned as published content.

#### Scenario: Published article has complete review evidence

- **WHEN** a measurement article has `reviewStatus=published`, a reviewed active measurement definition, a non-empty `contentVersion`, `reviewedBy`, `reviewedAt`, and one or more HTTPS sources
- **THEN** the article lookup returns the record for its locale and slug
- **AND** the record can be projected into the reusable measurement article view model

#### Scenario: Incomplete or unreviewed content is withheld

- **WHEN** an article is draft, deprecated, missing review metadata, missing sources, or references a provisional/unknown measurement definition
- **THEN** the published lookup returns no article
- **AND** the user-facing route renders its not-found/unavailable state without exposing the content

#### Scenario: Editorial version changes stay independent from scoring

- **WHEN** a published article's prose, `contentVersion`, source list, or related keys changes
- **THEN** the measurement-definition resolver and assessment bindings remain unchanged
- **AND** the article contract contains no score threshold or universal reference-range field

### Requirement: The measurement article template renders safe educational sections

For a published measurement article, the application SHALL render a reusable authenticated page at `/app/knowledge/measurements/[slug]` with separate general-education and **Your results** regions. The education region SHALL contain headings for what it measures, aliases, common units, specimen, panel membership, related measurements, interpretation factors, and sources. The page SHALL always render a medical disclaimer. The template SHALL NOT render a universal scoring range, diagnosis, treatment recommendation, or test-order prompt.

#### Scenario: Measurement page shows the complete education structure

- **WHEN** an authenticated user opens a published measurement article
- **THEN** the page shows the article title and summary plus the required education sections
- **AND** Registry-owned aliases, accepted units, specimen, and panel membership are shown as factual metadata
- **AND** the sources section exposes the article's HTTPS sources
- **AND** the disclaimer is visible

#### Scenario: Education and personal data are visibly separated

- **WHEN** the article has matching observations for the signed-in profile
- **THEN** general copy appears in the education region
- **AND** uploaded-document values appear only under a distinct **Your results** heading
- **AND** a user value is not presented as a universal range, score, diagnosis, or clinical recommendation

#### Scenario: Missing optional relationships remain honest

- **WHEN** a definition has no supported panel, no published related article, or no source observation
- **THEN** the page states that the relationship or source is unavailable
- **AND** it does not construct a guessed link or imply that a missing relationship exists

### Requirement: Registry metadata is authoritative and related links are safe

The template SHALL derive aliases, common units, specimen, and panel membership from the existing reviewed measurement and panel registries. Related measurement entries SHALL resolve through concrete measurement definition keys and SHALL link only to a matching published article slug. The template SHALL NOT duplicate or reinterpret assessment bindings, resolver outcomes, or reference ranges.

#### Scenario: Registry changes flow into the page metadata

- **WHEN** the Registry definition supplies aliases, accepted units, specimen, and panel membership
- **THEN** the article view model reflects those current Registry values
- **AND** no separately authored copy is required for those identity fields

#### Scenario: Related article is not published

- **WHEN** an article lists a valid related measurement definition whose article is not published
- **THEN** the related measurement display name remains visible as non-link text
- **AND** no route is generated from the raw definition key

### Requirement: Personal results remain profile-scoped and source-linked

The page SHALL load personal observations only through the existing authenticated `/api/biomarkers` response and SHALL retain observations whose exact `measurement_definition_key` matches the article's definition key. Each retained observation SHALL show its reported value, unit, and observed date. An observation SHALL link to its source document only when the response contains an owned document id; the link SHALL carry measurement, observation, and validated return context back to the article. The page SHALL provide explicit loading, retryable error, and no-results states.

#### Scenario: Matching observations appear under Your results

- **WHEN** the authenticated Biomarkers response contains observations for the article's concrete definition
- **THEN** those observations appear under **Your results** with their value, unit, and observed date
- **AND** an observation with a source document has a link to that document
- **AND** the document link carries the article measurement and observation context

#### Scenario: Non-matching observations are not mixed into the article

- **WHEN** the Biomarkers response contains observations for other measurement definitions
- **THEN** those observations do not appear in the article's **Your results** region
- **AND** the page does not issue a profile-wide or cross-profile query using a user-supplied id

#### Scenario: Source-less observation stays visible without a fabricated target

- **WHEN** a matching observation has no document relation
- **THEN** its value, unit, and date remain visible
- **AND** no source-document link is rendered for that row

#### Scenario: Personal results have no available data or encounter a retryable failure

- **WHEN** no matching observation is returned
- **THEN** the page explains that no uploaded result is available and provides a link to the Biomarkers view
- **WHEN** the Biomarkers request fails
- **THEN** the page shows a non-disclosing error and an accessible retry action
- **AND** no general educational content is replaced with an invented personal result

### Requirement: Article navigation and accessibility remain within the app boundary

The page SHALL provide a breadcrumb/back link to Biomarkers and a direct action to view all matching results. Article, related-article, Biomarkers, and source-document links SHALL be keyboard accessible with visible focus treatment. External sources SHALL use safe new-tab link attributes. The page SHALL preserve the app shell's responsive behavior and reduced-motion policy.

#### Scenario: User returns to their Biomarkers context

- **WHEN** a user activates the article's Biomarkers link or a source-document breadcrumb/back link
- **THEN** navigation returns to `/app/biomarkers` with the article's measurement context
- **AND** the route remains same-origin

#### Scenario: Source links are safe and usable

- **WHEN** a user opens an article source or navigates through related content
- **THEN** HTTPS source links open with `rel="noreferrer"` when a new tab is requested
- **AND** all controls expose descriptive accessible names and visible keyboard focus
