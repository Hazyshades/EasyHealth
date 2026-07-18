## MODIFIED Requirements

### Requirement: Health profile endpoint

The system SHALL expose `GET /api/health-profile` returning deterministic current-state assessments, readiness details, drawer-ready factual biomarker details, instrumental observations, and optional cached holistic synthesis for the authenticated user's profile.

#### Scenario: Authenticated profile request with biomarker data

- **WHEN** an authenticated user with one or more biomarker observations sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** the body includes `records_used_count`, a biomarker-observation count or equivalent profile display state, nullable overall assessment fields, `scoreable_named_system_count`, `scoreable_named_system_total`, `systems`, and `sources`
- **AND** `systems` contains all eight named systems and optionally General
- **AND** biomarker aggregation includes laboratory and instrumental observations
- **AND** may include `holistic_synthesis` when cached or generated

#### Scenario: Authenticated profile request without biomarkers but with consultations

- **WHEN** an authenticated user has no observations but has accepted consultation or other structured document data
- **THEN** the response status is 200
- **AND** the response distinguishes the absence of recognized biomarker observations from the onboarding empty state
- **AND** `holistic_synthesis` is present or generated from non-lab structured data

#### Scenario: Authenticated profile request without data

- **WHEN** an authenticated user with no observations and no structured document data sends `GET /api/health-profile`
- **THEN** the response status is 200
- **AND** `records_used_count` is 0
- **AND** `systems` is an empty array
- **AND** `holistic_synthesis` is null or absent

### Requirement: System insight structure

Each entry in `systems` SHALL include system id, display name, nullable current-state score, data confidence percentage, score-readiness details, scoreability state, markers array, and drawer-ready source document references.

#### Scenario: Scoreable system score and confidence returned

- **WHEN** a named system satisfies all configured `scoreRequiredGroups`
- **THEN** the system entry includes a 0-100 current state score
- **AND** includes a separate 0-100 data confidence percentage
- **AND** the confidence is not used as the displayed current state score

#### Scenario: Unscored system readiness returned

- **WHEN** a named system is empty, has incomplete required groups, or has required markers without usable document reference ranges
- **THEN** the system entry includes a null current state score
- **AND** includes missing required groups, required markers present without usable reference ranges, and supporting markers as applicable
- **AND** does not use `0` to represent unavailable readiness

#### Scenario: System with out-of-range marker

- **WHEN** a biomarker in a system has a value outside its reference range
- **THEN** the marker entry includes `status` of `out_of_range`
- **AND** includes `value`, `unit`, `observed_at`, `document_id`, and source document metadata when available
- **AND** does not include a diagnosis or disease label

### Requirement: Overall assessment denominator

The endpoint SHALL return `scoreable_named_system_count` and `scoreable_named_system_total` for the eight named body systems.

#### Scenario: Overall assessment remains unavailable below the threshold

- **WHEN** fewer than three named systems are scoreable
- **THEN** `overall_state_score` is null
- **AND** the response returns the current scoreable-system count and a total of 8

### Requirement: Systems include catalog-driven ids

`GET /api/health-profile` SHALL return the eight catalog named-system entries after the first biomarker observation, including `inflammation` and `nutrients`.

#### Scenario: Named-system placeholders in API payload

- **WHEN** a user has at least one biomarker observation and requests the health profile
- **THEN** the `systems` array contains cardiovascular, metabolic, thyroid, liver, kidney, blood, nutrients, and inflammation entries
- **AND** an entry without observations has a null score and no marker records

#### Scenario: Inflammation is explicitly non-scoreable

- **WHEN** an inflammation entry has one or more observations
- **THEN** its `state_score` is null and its scoreability state is `non_scoreable`
- **AND** its observations remain available as factual marker details

#### Scenario: General is conditional and unscored

- **WHEN** one or more observations is unmapped, specialty, or cataloged to General
- **THEN** the `systems` array includes General with a null score
- **AND** General markers do not contribute to the overall score

### Requirement: Scoring fields respect score roles and readiness groups

System `state_score` and `data_confidence` in the health profile API SHALL use separate catalog policies: score roles, `scoreRequiredGroups`, and coverage flags.

#### Scenario: Required-group alternatives are accepted

- **WHEN** a required group contains multiple canonical keys and at least one has a usable numeric observation with a document lab reference range
- **THEN** that required group is satisfied
- **AND** no other key in the same group is required for score readiness

#### Scenario: Confidence remains independent of score readiness

- **WHEN** an optional core marker is absent from `scoreRequiredGroups` but remains coverage-flagged
- **THEN** its absence can affect data confidence according to the coverage policy
- **AND** does not alone prevent a numeric score

#### Scenario: Supporting markers never unlock a score

- **WHEN** only extended, display, unmapped, or specialty markers are present
- **THEN** no named system becomes scoreable from those markers
- **AND** the observations remain available as factual supporting data

#### Scenario: Contribution groups avoid duplicate weight

- **WHEN** multiple usable core markers belong to one configured score-contribution group
- **THEN** the system score includes at most one deterministic contribution from that group
- **AND** score readiness remains governed only by `scoreRequiredGroups`

## ADDED Requirements

### Requirement: Catalog score-required groups

The server SHALL maintain a deterministic per-named-system `scoreRequiredGroups` registry for the technical minimum evidence required to render a current-state score.

#### Scenario: Required group represents alternatives

- **WHEN** a system has alternative acceptable biomarkers for one readiness condition
- **THEN** the registry represents them in one group
- **AND** the server treats one usable member as satisfying that group

#### Scenario: Existing reference ranges remain authoritative

- **WHEN** a required marker has a numeric value but no usable lab reference range on its source document
- **THEN** the registry does not treat the marker as satisfying its group
- **AND** the API returns it as present without usable reference rather than inventing a range
