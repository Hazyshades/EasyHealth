## ADDED Requirements

### Requirement: The Knowledge Base SHALL publish the first ten reviewed biomarker pages

The public Knowledge Base SHALL expose exactly ten English biomarker article records for the EH-136 launch slice: hemoglobin, hematocrit, WBC, platelets, MCV, glucose, HbA1c, TSH, ALT, and a combined creatinine/eGFR page. Each published record SHALL have a unique stable slug, `contentVersion`, `status: published`, `reviewStatus: reviewed`, non-empty `reviewedBy`, a valid `reviewedAt`, at least one source, and one or more reviewed Registry 2.0 measurement-definition keys.

#### Scenario: The launch roster is complete and bounded

- **WHEN** the Knowledge Base manifest is loaded
- **THEN** it contains exactly the ten EH-136 slugs
- **AND** every slug is unique and maps to one article body
- **AND** no draft, review, or deprecated article is included in the published route parameters

#### Scenario: A published article carries review evidence

- **WHEN** a published article is validated
- **THEN** its content version, locale, review status, reviewer, review date, source list, and Registry definition references are present
- **AND** an article missing any required publication evidence fails validation rather than becoming reachable

### Requirement: Article metadata SHALL be grounded in reviewed Registry 2.0 definitions and panels

Every article measurement-definition reference SHALL resolve to an active reviewed Registry 2.0 definition. The template SHALL derive display name, aliases, accepted units, specimen, and panel membership from that definition and the curated panel registry. Content SHALL NOT create or override a definition, alias, unit conversion, reference range, score role, assessment binding, readiness group, or Health Profile state.

#### Scenario: A reviewed definition supplies article metadata

- **WHEN** a published article references `hemoglobin_whole_blood`
- **THEN** the rendered metadata identifies the reviewed Hemoglobin definition, whole-blood specimen, its accepted units, aliases, and its curated panel membership
- **AND** the page exposes the Registry definition key as provenance metadata without presenting it as a user-entered observation

#### Scenario: An unreviewed or missing definition cannot publish

- **WHEN** an article references a missing, retired, provisional, or non-Registry definition
- **THEN** the Knowledge Base validator fails
- **AND** the route does not render the article as published

#### Scenario: The kidney article preserves both definitions

- **WHEN** the `creatinine-egfr` article is rendered
- **THEN** it references both `creatinine_serum` and `egfr`
- **AND** it presents them as related measurements without collapsing their identities or inventing a score or threshold

### Requirement: Every article SHALL use the approved safe educational template

The biomarker article template SHALL render the following distinct sections for every published article: what it measures, aliases, common units, specimen, panel membership, related measurements, interpretation factors, sources, review metadata, and a medical disclaimer. The page SHALL include a separate “Your EasyHealth data” area with links to the authenticated Biomarkers surface; general educational content and private observations SHALL remain visually and data-wise separate.

#### Scenario: A reader opens a published article

- **WHEN** a reader visits `/knowledge/biomarkers/{slug}` for a published slug
- **THEN** the page renders the article title and all required educational sections through the same template
- **AND** the source list and last-reviewed metadata are visible
- **AND** the private-data area contains navigation links but no observation values, document identifiers, profile identifiers, or Supabase response data

#### Scenario: An unknown or unpublished slug is requested

- **WHEN** a reader visits a slug that is not published
- **THEN** the route returns the framework's not-found response
- **AND** it does not disclose draft, review, or deprecated article content

### Requirement: Educational copy SHALL remain non-diagnostic and non-prescriptive

Published article bodies SHALL explain that a laboratory result needs the reporting laboratory's context and a qualified professional's interpretation. They SHALL NOT present a universal reference/scoring range, diagnose a disease from a result, recommend or change treatment or medication, or prompt a reader to order a test. The article disclaimer SHALL state that the content is educational and not medical advice.

#### Scenario: A result needs contextual interpretation

- **WHEN** a reader reviews interpretation factors
- **THEN** the copy explains that units, specimen, timing, method, laboratory reference information, symptoms, and other results can affect interpretation where relevant
- **AND** the copy directs questions to a qualified healthcare professional without making a diagnosis or treatment recommendation

#### Scenario: Unsafe content is added

- **WHEN** a body contains a universal numeric range, diagnostic conclusion, treatment instruction, medication instruction, or test-order prompt
- **THEN** the focused EH-136 publication check fails
- **AND** the unsafe article is not accepted as a completed launch page

### Requirement: Publication validation SHALL be deterministic

The repository SHALL provide a focused EH-136 verification command that validates the launch roster, manifest/body integrity, review/source evidence, Registry and panel references, required template content, safe-copy constraints, and deterministic article ordering without requiring a database or authenticated user.

#### Scenario: The focused verification command runs

- **WHEN** `pnpm test:eh136` runs with unchanged content and Registry inputs
- **THEN** it exits successfully and reports the ten-page roster
- **AND** a missing source, duplicate slug, changed Registry key, missing section, or unsafe claim causes a non-zero exit
