## ADDED Requirements

### Requirement: Published Knowledge Base records are versioned and review-gated

The Knowledge Base SHALL expose only static article records whose publication state is `published`, whose content version is non-empty, whose review metadata is complete, and whose source list contains at least one public source. Each published measurement article SHALL reference one concrete reviewed Registry 2.0 measurement-definition key and a stable slug. Article copy SHALL remain separate from Registry resolver and assessment fields.

#### Scenario: Published article has complete editorial metadata

- **WHEN** the Knowledge Base catalog loads a published measurement article
- **THEN** the record includes a stable slug, concrete measurement-definition key, non-empty content version, completed review metadata, and at least one source link
- **AND** the article is eligible for index and detail navigation

#### Scenario: Unpublished or invalid content is not routable

- **WHEN** an article record is draft, retired, missing review metadata, or points to a non-reviewed/nonexistent definition
- **THEN** the record is absent from public index results
- **AND** its detail route resolves as not found

### Requirement: Users can browse Knowledge Base categories and panels

The public Knowledge Base index SHALL render published measurement articles grouped by educational category and SHALL render the canonical static panel list. Category navigation SHALL be deterministic and SHALL not depend on a session, observation, document, profile, or assessment response.

#### Scenario: Index shows category groups

- **WHEN** a user opens `/knowledge` without filters
- **THEN** the page shows category headings with the published articles assigned to each category
- **AND** every article links to its stable measurement article route

#### Scenario: Index shows canonical panels

- **WHEN** a user opens `/knowledge` without filters
- **THEN** the page shows the available static panels with their names and member counts
- **AND** each panel links to its panel detail route

#### Scenario: Category filter is shareable

- **WHEN** a user submits or opens `/knowledge?category=blood`
- **THEN** the index shows only published articles in the requested category
- **AND** the category filter remains represented in the URL after refresh

### Requirement: Search matches canonical names and approved aliases

The Knowledge Base index SHALL accept a GET search query and SHALL match published measurement articles by canonical display name, concrete definition key, analyte key, or active reviewed Registry alias. Matching SHALL use the Registry measurement-label normalization and its controlled accent-folded form. Results SHALL identify whether the leading match came from a canonical field or an alias, and search SHALL never include private observation text.

#### Scenario: Canonical name search returns an article

- **WHEN** a user searches for `Hemoglobin`
- **THEN** the index returns the published Hemoglobin article
- **AND** the result identifies the canonical match

#### Scenario: Alias search returns the canonical article

- **WHEN** a user searches for an active reviewed alias such as `HGB`
- **THEN** the index returns the matching Hemoglobin article
- **AND** the result identifies the alias match without exposing raw patient data

#### Scenario: Normalized search tolerates separators and accents

- **WHEN** a user searches using a case, separator, or approved accent variation of a published canonical name or alias
- **THEN** the same published article is returned when the normalized Registry form matches
- **AND** numeric-only or empty queries do not produce broad unrelated results

#### Scenario: Search query is shareable

- **WHEN** a user submits a search from the Knowledge Base index
- **THEN** the URL contains the encoded query
- **AND** refreshing or copying that URL produces the same filtered result set

### Requirement: Panel filters preserve membership semantics

The index SHALL support filtering published measurement articles by a canonical panel key. Panel detail SHALL render the static panel's members in display order with required/optional roles and SHALL state that real laboratory panel composition can vary. Panel membership SHALL not be inferred from observations or assessment bindings.

#### Scenario: CBC filter narrows the index

- **WHEN** a user selects the Complete blood count panel filter
- **THEN** the index shows only published articles whose concrete definitions are CBC members
- **AND** it does not include unrelated metabolic or private profile results

#### Scenario: Panel page preserves required and optional roles

- **WHEN** a user opens the CBC panel page
- **THEN** members are displayed in the registry display order with required or optional labels
- **AND** the page explicitly notes that not every laboratory includes every member

#### Scenario: Unpublished member has no broken link

- **WHEN** a static panel member has no published article
- **THEN** the panel page displays the member name and role as factual text
- **AND** it does not emit a link to a missing or unreviewed article

### Requirement: Article pages provide safe education and breadcrumbs

A published measurement article SHALL render the Registry-backed display name, what-it-measures copy, active aliases, accepted/common units, specimen, panel membership, related published measurements, public sources, content review/version metadata, and the medical disclaimer. Article pages SHALL not render universal reference ranges, diagnoses, treatment instructions, or prompts to order a test. Article and panel pages SHALL expose accessible breadcrumbs back to the Knowledge Base index and relevant parent context.

#### Scenario: Article renders safe factual sections

- **WHEN** a user opens a published measurement article
- **THEN** the page renders the article's factual educational sections, Registry identity metadata, sources, and disclaimer
- **AND** it does not render a universal scoring range, diagnosis, treatment instruction, or test-order prompt

#### Scenario: Article breadcrumb returns to index

- **WHEN** a user opens an article directly in a new tab
- **THEN** the breadcrumb identifies the Knowledge Base and current article
- **AND** the Knowledge Base breadcrumb links back to `/knowledge` without relying on browser history

#### Scenario: Related links stay within published content

- **WHEN** an article declares related measurement or panel keys
- **THEN** the page links only to related published articles or canonical panel pages
- **AND** missing or unpublished related content is omitted rather than linked speculatively

### Requirement: Public education and private results remain separated

Knowledge Base routes SHALL render without fetching Supabase, profile, document, observation, or assessment data. A published article MAY link to the authenticated `/app/biomarkers` route with only its concrete measurement key. Public URLs and page data SHALL not contain profile ids, observation ids, source-document ids, laboratory result values, or private response fields.

#### Scenario: Public page is session-independent

- **WHEN** an anonymous user opens the index, panel, or published article route
- **THEN** the page renders static educational content or a safe not-found response
- **AND** the Knowledge Base code does not call a private API or require a profile

#### Scenario: Article opens the user's private series safely

- **WHEN** an authenticated user selects the article's link to view their result
- **THEN** navigation goes to `/app/biomarkers?measurement=<concrete-key>`
- **AND** the Knowledge Base URL contains no observation value, profile id, observation id, or document id
- **AND** the private Biomarker page remains responsible for profile-scoped data access

#### Scenario: Biomarker row links only to published content

- **WHEN** an authenticated Biomarker row has a concrete measurement-definition key with a published article
- **THEN** the row exposes a link to that article's public route
- **AND** the link contains no private result payload

#### Scenario: Biomarker row without published content remains safe

- **WHEN** a Biomarker row has no concrete key or no published article
- **THEN** the row retains its existing value/source rendering
- **AND** no broken or guessed Knowledge Base link is shown
