## ADDED Requirements

### Requirement: Internal navigation context is encoded and validated consistently

The application SHALL use stable query keys for the selected body system (`system`), measurement series (`measurement`), exact observation (`observation`), and originating internal path (`returnTo`). It SHALL encode nested paths with standard URL query encoding and SHALL reject external, protocol-relative, malformed, or control-character-containing return targets in favor of a local fallback.

#### Scenario: Nested profile context round-trips through a measurement link

- **WHEN** a system marker builds a Biomarkers link with `system=metabolic` and `returnTo=/app/profile?system=metabolic`
- **THEN** the generated URL contains independently decodable `system` and `returnTo` values
- **AND** reading the URL restores the same system and return path

#### Scenario: External return target is rejected

- **WHEN** a deep link contains `returnTo=https://example.invalid/account` or a protocol-relative `returnTo=//example.invalid/account`
- **THEN** navigation resolves to the documented local fallback
- **AND** no redirect to the external origin is rendered

### Requirement: Health Profile exposes contributing measurement and source context

The Health Profile SHALL preserve the selected system in the URL and SHALL provide a navigation action from each marker with a concrete measurement definition to the corresponding Biomarkers series. When a marker has an owned source document, the profile SHALL also provide a source-document action carrying the selected system/measurement context and a return path to the selected profile system.

#### Scenario: System assessment opens its contributing measurement series

- **WHEN** an authenticated user opens a system drawer and selects a marker with `measurement_definition_key=glucose` and a source document
- **THEN** the Biomarkers link opens `/app/biomarkers` with `measurement=glucose`, the system context, and a return path to that profile system
- **AND** the selected system remains addressable after a reload

#### Scenario: Marker source opens the matching document

- **WHEN** the same marker has source document id `doc-1`
- **THEN** the source action opens `/app/documents/doc-1`
- **AND** the URL carries the marker measurement and a return path to the originating profile system

#### Scenario: Incomplete marker remains safe and honest

- **WHEN** a profile marker has no concrete measurement definition or source document
- **THEN** the marker remains visible with its existing factual display
- **AND** the application does not render a fabricated measurement or document target

### Requirement: Biomarkers preserves selected measurement and historical source navigation

The Biomarkers page SHALL initialize its selected series from `measurement`, retain the selected exact observation when it belongs to that series, reflect selection changes in the URL, and visibly distinguish the selected observation when present. Each historical point or table row with an owned source document SHALL link to that document with measurement/observation context and a return path that restores the selected Biomarkers state.

#### Scenario: Deep-linked measurement selects its historical series

- **WHEN** an authenticated user opens `/app/biomarkers?measurement=glucose&observation=obs-1`
- **THEN** the glucose series is selected after observations load
- **AND** observation `obs-1` is highlighted when it belongs to that series
- **AND** the selection remains represented in the URL after rendering

#### Scenario: Historical point returns to the selected series

- **WHEN** the user opens a source link for observation `obs-1` from the selected series
- **THEN** the document URL includes `measurement=glucose`, `observation=obs-1`, and a validated return path to `/app/biomarkers`
- **AND** activating the breadcrumb/back action returns to the same measurement context

#### Scenario: Source-less observation does not invent navigation

- **WHEN** a historical observation has no document relation
- **THEN** its value remains visible in the table/chart data
- **AND** no link to an unrelated or guessed document is rendered

### Requirement: Timeline and Document Review preserve origin context

The Timeline SHALL include its active type/date/page context in source-document return paths. Document Review SHALL render an accessible breadcrumb and explicit back link to the validated origin, while retaining Documents as the fallback for ordinary document-list entry. The document page SHALL retain selected measurement and observation query context without weakening its existing source-review behavior.

#### Scenario: Timeline source returns to filters and page

- **WHEN** a user viewing a filtered page of Health Timeline opens an event source document
- **THEN** the document URL carries a return path containing the active timeline type/date/page context
- **AND** returning to Health Timeline restores that context

#### Scenario: Direct document link uses a safe fallback

- **WHEN** a user opens `/app/documents/doc-1` without a return path
- **THEN** Document Review shows a breadcrumb/back link to Documents
- **AND** the document remains accessible through the normal authenticated viewer flow

#### Scenario: Context-aware document link is accessible

- **WHEN** Document Review is opened with a valid return path and selected observation context
- **THEN** the page exposes a breadcrumb with a descriptive origin label and the current document as the current item
- **AND** keyboard activation of the back link navigates to the validated origin without relying on browser history

### Requirement: Deep-link data access remains profile-scoped

Deep-link query parameters SHALL affect selection and navigation context only. Health Profile and Biomarkers reads SHALL continue to use the authenticated profile-scoped APIs, and Document Review SHALL continue to authorize the document id through the existing owner check before returning source content.

#### Scenario: A foreign document id is not authorized by navigation context

- **WHEN** an authenticated user manually changes the document id in a context-aware document URL to another profile's id
- **THEN** the existing document owner boundary rejects the request
- **AND** no source file, extracted result, or document metadata from the other profile is displayed

#### Scenario: Selection parameters do not widen profile reads

- **WHEN** a user supplies arbitrary `measurement`, `observation`, or `system` values
- **THEN** the page only selects from data already returned for the authenticated profile
- **AND** invalid values fall back to the normal page selection without a cross-profile query
