## ADDED Requirements

### Requirement: Knowledge Base articles use the canonical typed contract

The Knowledge Base SHALL represent an article as a strict version-controlled record using the EH-134 field names. Every article SHALL include `type`, `slug`, `locale`, `contentVersion`, `reviewStatus`, `reviewedBy`, `reviewedAt`, `deprecatedAt`, `replacementSlug`, `title`, `summary`, `sources`, and `relatedMeasurementKeys`. `reviewStatus` SHALL be `draft`, `in_review`, `published`, or `deprecated`; `locale` and `contentVersion` SHALL be non-empty strings; sources SHALL be structured HTTPS references; and unsupported metadata fields SHALL be rejected. A measurement article SHALL have `type: "measurement"` and exactly one `measurementDefinitionKey`. A panel article SHALL have `type: "panel"` and exactly one `panelKey`. The two subject fields SHALL not be interchangeable. Measurement-specific educational sections remain typed fields in the EH-134 contract; panel-specific sections are defined by EH-135 through this same envelope.

#### Scenario: Valid measurement article is accepted

- **WHEN** an article has `type: "measurement"`, a valid lowercase kebab-case slug, a non-empty locale and content version, one measurement-definition key, required educational sections, sources, and lifecycle metadata
- **THEN** the Knowledge Base validator accepts its structural contract

#### Scenario: Article subject does not match article type

- **WHEN** a measurement article supplies a `panelKey`, or a panel article supplies a `measurementDefinitionKey`
- **THEN** validation rejects the record before it can be exposed by a reader

#### Scenario: Unsupported fields cannot enter the contract silently

- **WHEN** an article record contains profile, observation, document, patient-value, assessment, score, range, or other fields outside the typed article contract
- **THEN** strict validation fails rather than passing those fields to a future article reader

### Requirement: Article catalogs are version-controlled and deterministically addressable

Article records SHALL remain in version-controlled typed catalog modules under `src/lib/knowledge-base`; EH-133 SHALL NOT introduce a competing JSON/Markdown filesystem catalog, CMS, database table, or runtime content API. The catalog SHALL enforce unique `type + locale + slug` identity and deterministic output order. Lookup SHALL support exact locale and Registry subject boundaries without implicit locale fallback. Published lookup SHALL return only records with `reviewStatus: "published"` that pass structural and semantic validation. The production catalog MAY remain empty until a later change supplies clinically reviewed records.

#### Scenario: Catalog record is version controlled

- **WHEN** a maintainer adds or edits an article record
- **THEN** the change is represented in the typed Knowledge Base catalog and its `contentVersion` identifies the editorial revision without changing Registry or scoring code

#### Scenario: Duplicate article identity is rejected

- **WHEN** two records have the same type, locale, and slug
- **THEN** catalog validation reports the duplicate and no published projection is considered valid

#### Scenario: Exact locale lookup does not fall back

- **WHEN** a reader requests a locale for which no matching record exists
- **THEN** lookup returns no article instead of silently returning another locale

#### Scenario: Unpublished records remain hidden

- **WHEN** a matching record is `draft`, `in_review`, or `deprecated`
- **THEN** published lookup returns no article and does not expose its educational content

### Requirement: Article subjects reference authoritative Registry data

A publishable measurement article SHALL reference an existing active reviewed Registry 2.0 `MeasurementDefinition`. A publishable panel article SHALL reference an existing static `PanelDefinition`. The validator SHALL never silently remap an unknown, provisional, or retired primary subject. Article metadata SHALL NOT copy or override Registry display names, aliases, units, specimen, panel membership, assessment bindings, ranges, score roles, readiness groups, or contribution groups; readers derive those facts from the Registry.

`relatedMeasurementKeys` SHALL remain an explicit curated list of concrete keys. A related key without a published article or without a resolvable current definition SHALL not become a guessed link; the reader SHALL withhold that related link while preserving the explicit source record for validation or later content work.

#### Scenario: Unknown primary measurement reference fails closed

- **WHEN** a publishable measurement article references a measurement-definition key absent from Registry 2.0
- **THEN** validation fails and the article is not returned by published lookup

#### Scenario: Provisional measurement reference cannot publish

- **WHEN** a measurement article references a definition that is not reviewed or is not Registry 2.0 sourced
- **THEN** validation fails rather than treating provisional data as a reviewed educational subject

#### Scenario: Panel subject uses the Panel Registry

- **WHEN** a panel article references a known static panel key
- **THEN** the subject is resolved through the Panel Registry and panel membership remains Registry-owned

#### Scenario: Unavailable related article does not create a link

- **WHEN** a valid article lists a related measurement key that has no published article
- **THEN** the reader omits the related link instead of constructing a route from the raw key

### Requirement: Publication requires review and source evidence

A `published` article SHALL have a non-empty `contentVersion`, at least one structured HTTPS source, a non-empty reviewer identifier, and a valid offset-aware review timestamp. `draft` and `in_review` records SHALL remain hidden from published readers. A `deprecated` record SHALL have an effective `deprecatedAt` timestamp and SHALL be excluded from current published projections. `replacementSlug`, when present, SHALL be explicit metadata and SHALL not imply an automatic redirect until a route-level policy validates it. The structural EH-134 contract SHALL continue to require a source list on every article record, including non-published records.

#### Scenario: Complete reviewed article becomes readable

- **WHEN** a measurement or panel article is marked `published` with valid review metadata, at least one HTTPS source, and a current Registry subject
- **THEN** the validator accepts it and the published reader may return it

#### Scenario: Published article without review metadata is rejected

- **WHEN** an article is marked `published` but `reviewedBy` or `reviewedAt` is missing or invalid
- **THEN** validation fails and published lookup does not return it

#### Scenario: Published article with an unsafe source is rejected

- **WHEN** a published article contains an HTTP or otherwise invalid source URL
- **THEN** validation fails and the article cannot be exposed as published education

#### Scenario: Deprecated article is withheld

- **WHEN** an article is marked `deprecated` without a valid `deprecatedAt`, or is otherwise a deprecated record
- **THEN** validation rejects the incomplete record or published lookup excludes the valid deprecated record

### Requirement: General education remains separate from private health data

Knowledge Base records and general article lookup SHALL contain only version-controlled educational content, editorial metadata, and read-only Registry references. They SHALL NOT accept, embed, or return a profile id, observation id, document id, patient value, or private source evidence. A future user-specific results section SHALL use an authenticated profile-scoped data path separately from the article projection.

#### Scenario: The same article is safe across profiles

- **WHEN** two authenticated users request the same published article
- **THEN** the general article projection is identical and contains no profile-specific observation data

#### Scenario: Article lookup has no patient-data input

- **WHEN** a caller resolves an article by type, slug, locale, or Registry subject
- **THEN** the general loader does not require or accept a profile, observation, or document identifier

#### Scenario: Personal results stay outside article content

- **WHEN** a future article page displays a user's own measurement history
- **THEN** those values are fetched through the authenticated Health Profile/observation path and are not stored in or returned as Knowledge Base content

### Requirement: Knowledge Base validation is deterministic and testable

The repository SHALL provide focused pure verification for article schemas, typed catalogs, Registry references, lifecycle filtering, source safety, deprecation metadata, exact-locale lookup, duplicate identities, and private-data separation. Verification SHALL use synthetic or de-identified records, SHALL not require Supabase or patient data, and SHALL keep the EH-134 verifier passing as a compatibility contract. The production catalog SHALL not claim user-visible article coverage while it is empty.

#### Scenario: Mixed lifecycle fixtures are filtered safely

- **WHEN** verification loads draft, in-review, published, and deprecated synthetic records
- **THEN** only valid current published records appear in the published projection

#### Scenario: Invalid content fails verification

- **WHEN** a fixture contains an unknown primary Registry key, unsafe source, duplicate identity, invalid lifecycle metadata, or unsupported private field
- **THEN** the verifier exits unsuccessfully without exposing the fixture as publishable content

#### Scenario: Empty production catalog is represented honestly

- **WHEN** the catalog contains no reviewed article records before EH-136
- **THEN** validation passes for the empty catalog and no route claims that an article is available
