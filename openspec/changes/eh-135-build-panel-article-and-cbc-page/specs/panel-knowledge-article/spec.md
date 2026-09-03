## ADDED Requirements

### Requirement: Panel education uses versioned reviewed-content metadata

The system SHALL represent each panel article using the canonical EH-133 typed contract (`type: "panel"`, kebab-case slug, locale, content version, review status, nullable reviewer metadata, lifecycle metadata, source references, and related Registry 2.0 measurement-definition keys) plus the EH-135 presentation fields for purpose, composition, subgroups, member explanations, related markers, and disclaimer. A visible article whose clinical review is pending SHALL use `reviewStatus: "in_review"`, identify itself as a preview, and SHALL NOT present itself as clinically reviewed.

#### Scenario: CBC preview exposes honest metadata

- **WHEN** the CBC panel article is loaded
- **THEN** it has article type `panel`, slug `cbc`, locale `en`, a non-empty content version, a visible preview/review-pending state, at least one source, and exact Registry 2.0 member references
- **AND** it does not invent a reviewer or review timestamp

#### Scenario: Article content is independent from assessment logic

- **WHEN** article copy, source metadata, or subgroup explanations are changed
- **THEN** the change does not alter resolver outcomes, panel membership, score roles, readiness, assessment eligibility, or stored observations
- **AND** the article module has no dependency on assessment calculation or write APIs

### Requirement: The reusable panel template explains purpose and variable composition

The panel article template SHALL render the panel purpose, a prominent explanation that panel composition varies by laboratory/report, alternate panel names when available, ordered subgroup sections, member cards, sources, and the product medical disclaimer. Missing panel members SHALL be described as reporting variation rather than as abnormal, failed, or clinically incomplete results.

#### Scenario: Composition caveat is visible before member detail

- **WHEN** a user opens a panel article
- **THEN** the page states that a panel is a group of related measurements and that laboratories may include different members
- **AND** the page does not imply that every listed member appears on every laboratory report

#### Scenario: Sources and disclaimer remain visible

- **WHEN** a user reaches the end of the panel article
- **THEN** each source shows a title, publisher, and external link
- **AND** the medical disclaimer is visible without requiring user data or a successful API request

### Requirement: The CBC article distinguishes blood-cell subgroups and member roles

The CBC article SHALL contain distinct red-cell, white-cell, and platelet subgroup sections. Each member card SHALL reference an exact Registry 2.0 measurement-definition key and SHALL use a neutral role label that distinguishes core/common members, often-included optional members, or related measurements. Related markers SHALL be clearly identified as outside the CBC member set when applicable.

#### Scenario: CBC subgroup coverage is explicit

- **WHEN** the CBC article is rendered
- **THEN** the user can identify separate red-cell, white-cell, and platelet sections
- **AND** hemoglobin/hematocrit/red-cell indices appear in the red-cell section, WBC/differential measures appear in the white-cell section, and platelet count/indices appear in the platelet section

#### Scenario: Optional and related markers do not become required claims

- **WHEN** a member is optional in the Registry 2.0 panel or is related from another panel
- **THEN** its card uses an optional/related label and explanatory copy
- **AND** the page does not call it universal, guaranteed, or required on every report

### Requirement: User CBC results are exact-key, source-preserving, and separate

The CBC page SHALL load profile-owned results through the existing authenticated biomarker read API and SHALL show a distinct `Your CBC results` section. It SHALL include only observations whose `measurement_definition_key` exactly belongs to the CBC panel member set, preserve the value, unit, observed date, and source document metadata, and provide links to the existing Biomarkers/source navigation. It SHALL NOT infer membership from names, aliases, filenames, headings, assessment state, or reference ranges.

#### Scenario: Matching results link back to the user's record

- **WHEN** the authenticated response contains a resolved CBC observation
- **THEN** the observation appears in `Your CBC results` with its stored value/unit and date
- **AND** its link opens `/app/biomarkers` with the measurement and observation context and a safe return path to the article

#### Scenario: Unrelated and unresolved rows stay out of CBC results

- **WHEN** the response contains a non-CBC resolved definition, an unresolved row, or a row whose display name says “CBC” but whose definition key is not a CBC member
- **THEN** none of those rows appears in `Your CBC results`
- **AND** the educational article remains available

#### Scenario: Empty and failed result reads are truthful

- **WHEN** the biomarker response contains no CBC rows or the request fails
- **THEN** the article still renders its purpose, caveat, subgroup cards, sources, and disclaimer
- **AND** the result section shows an explicit no-results or retryable error state without fabricated values

### Requirement: Knowledge routes are discoverable within the authenticated app

The system SHALL provide an authenticated Knowledge index linking to `/app/knowledge/panels/cbc` and SHALL expose a `Knowledge` navigation item using the existing app navigation conventions. The CBC route SHALL remain accessible on desktop and mobile, preserve keyboard focus states, and retain current navigation behavior for existing entries.

#### Scenario: User can discover the CBC page

- **WHEN** an authenticated user opens the Knowledge entry point
- **THEN** the page identifies the CBC panel article and provides a link to the CBC route
- **AND** the sidebar and mobile navigation expose the same Knowledge destination

#### Scenario: Unauthenticated access remains gated

- **WHEN** an unauthenticated request opens the Knowledge index or CBC route
- **THEN** the existing `/app` authentication/onboarding boundary handles the request
- **AND** the knowledge page does not introduce a public user-data endpoint or bypass session checks
