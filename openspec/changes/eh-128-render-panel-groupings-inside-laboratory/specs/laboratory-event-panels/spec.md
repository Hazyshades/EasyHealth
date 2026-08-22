## ADDED Requirements

### Requirement: Laboratory events SHALL group observations by reviewed panel membership

The timeline SHALL group a laboratory event's normalized observations by exact Registry 2.0 `measurement_definition_key` membership from the versioned panel registry. Panel detection MUST NOT use panel display names, alternate names, document filenames, laboratory names, OCR headings, or free-text similarity.

#### Scenario: A CBC subset detects the CBC panel

- **WHEN** a laboratory event contains normalized observations for two or more CBC member definitions
- **THEN** the event renders one `Complete blood count` group
- **AND** the group renders its observed members in ascending panel `displayOrder`
- **AND** the group does not require every CBC member to be present

#### Scenario: A panel-looking document name does not detect a panel

- **WHEN** a laboratory event has a filename or source text such as `CBC` but no observation has a CBC member definition key
- **THEN** no CBC group is rendered from that text alone
- **AND** the measurements remain in the ungrouped section when they have no panel membership

### Requirement: Panel member rows SHALL expose optional and missing members neutrally

For every detected panel, the timeline SHALL render the catalog member order and SHALL distinguish observed members from members absent from that event without implying a diagnosis or medical warning. Required and optional role labels MAY be displayed as neutral catalog metadata but MUST NOT change warning state or score state.

#### Scenario: An optional member is absent

- **WHEN** a detected panel has an optional member with no matching observation in the event
- **THEN** the member row says `Not reported in this event` or equivalent neutral copy
- **AND** the row uses neutral styling
- **AND** the row does not display an error, warning, abnormal, or failed status

#### Scenario: A required member is absent

- **WHEN** a detected panel has a required member with no matching observation in the event
- **THEN** the member row is still rendered as a neutral not-reported row
- **AND** the panel is not marked medically incomplete or abnormal

### Requirement: Shared membership SHALL remain many-to-many and ungrouped observations SHALL be preserved

A normalized observation belonging to multiple panel definitions SHALL appear in every owning panel group. An observation with no owning panel definition, including a normalized non-panel measurement or an unresolved observation, SHALL appear in exactly one ungrouped section. A panel-assigned observation MUST NOT also appear in the ungrouped section.

#### Scenario: Hemoglobin is shared by CBC and iron studies

- **WHEN** an event contains a normalized `hemoglobin_whole_blood` observation
- **THEN** that observation appears in both the CBC and iron-studies groups when both panels are detected
- **AND** the observation is not repeated in `Other measurements`
- **AND** no duplicate measurement definition is created

#### Scenario: Non-panel and unresolved measurements remain visible

- **WHEN** an event contains a normalized measurement definition with no panel membership or an observation with no normalized definition key
- **THEN** each such observation appears in `Other measurements`
- **AND** no observation is silently dropped because it cannot be grouped

### Requirement: Panel and member ordering SHALL be deterministic

Panel groups SHALL follow the registry definition order, member rows SHALL follow ascending `displayOrder`, and multiple observations for one member SHALL use stable observation ordering without mutating the source collection.

#### Scenario: Input ordering changes

- **WHEN** the same event observations are supplied in a different source-array order
- **THEN** the rendered panel keys, member keys, and ungrouped observation order remain identical

### Requirement: Laboratory event provenance SHALL remain actionable

Every laboratory event SHALL link to its owning source document. A member observation with a valid source page SHALL link to that same document with the existing `page` query parameter; an observation without a source page SHALL link only to the document and MUST NOT invent a page.

#### Scenario: Source page is available

- **WHEN** a rendered member has `document_id = D` and `source_page = 2`
- **THEN** its provenance control links to `/app/documents/D?page=2`
- **AND** the event-level source control links to `/app/documents/D`

#### Scenario: Source page is unavailable

- **WHEN** a rendered member has a document ID but no valid source page
- **THEN** its provenance control links to `/app/documents/D`
- **AND** the UI does not claim a page number

### Requirement: The Health Timeline SHALL present profile-owned events around the panel groups

The application SHALL expose a `/app/timeline` page and navigation entry. It SHALL load only the active profile's existing timeline-event and normalized biomarker read surfaces, order events by observed medical date with upload-date fallback, support document-type and date-range filtering, and provide bounded pagination plus loading, error, and empty states.

#### Scenario: A user filters laboratory events by date range

- **WHEN** the user selects the Lab results filter and sets the same valid date in the From and To controls
- **THEN** only profile-owned laboratory documents with that observed date remain visible
- **AND** each visible laboratory event can open its source document

#### Scenario: The active profile has no matching events

- **WHEN** the timeline filters match no documents
- **THEN** the page shows a clear empty state and a way to clear filters
- **AND** it does not fabricate a panel or measurement
