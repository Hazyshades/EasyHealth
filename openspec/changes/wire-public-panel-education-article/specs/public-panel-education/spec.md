## ADDED Requirements

### Requirement: Public panel routes overlay education articles when present

The public Knowledge Base panel detail route SHALL continue to resolve a Registry panel by key. When a non-deprecated panel education article exists for that same key, the page SHALL render that article’s purpose, composition caveat, subgroup members, related markers, sources, disclaimer, and review chips. When no such article exists, the page SHALL keep the registry composition view with required and optional members. Unknown Registry keys SHALL resolve as not found.

#### Scenario: CBC public page uses the education article

- **WHEN** an anonymous user opens `/knowledge/panels/cbc`
- **THEN** the page renders the CBC panel education article
- **AND** it shows at least one titled source with a public HTTPS link
- **AND** it shows the medical disclaimer
- **AND** it does not render the registry-only composition page as the sole body

#### Scenario: Panel without an education article stays a composition page

- **WHEN** an anonymous user opens a public panel route whose Registry key has no education article
- **THEN** the page still renders the Registry panel name and required/optional members
- **AND** it does not invent sources, reviewer metadata, or an education article

#### Scenario: Unknown panel key is not found

- **WHEN** a user opens `/knowledge/panels/` with a key that is not a Registry panel
- **THEN** the route resolves as not found

### Requirement: Public panel education stays session-independent

Public panel education SHALL render as static educational content. The public panel route SHALL NOT fetch profile, document, observation, or assessment data, SHALL NOT render a “Your results” block, and SHALL NOT put profile ids, observation ids, document ids, or laboratory values in the public URL or page data. A link to authenticated Biomarkers MAY appear without private query identifiers.

#### Scenario: Anonymous CBC page has no private results

- **WHEN** an anonymous user opens `/knowledge/panels/cbc`
- **THEN** the educational article, sources, and disclaimer are visible
- **AND** the page does not show “Your CBC results”, upload CTAs for saved results, or values from `/api/biomarkers`

#### Scenario: Public page does not require a session

- **WHEN** the public panel route is requested without cookies
- **THEN** it still renders the education or registry fallback
- **AND** the route module does not call a private API

### Requirement: Unpublished panel education is labeled as preview

A public panel education article whose `reviewStatus` is `in_review` SHALL be labeled as an educational preview with clinical review pending. The page SHALL NOT display “Clinically reviewed”, SHALL NOT invent `reviewedBy` or `reviewedAt`, and SHALL NOT present a last-reviewed date when `reviewedAt` is null. A `published` article MAY show clinically reviewed labeling only when reviewer and `reviewedAt` are present.

#### Scenario: In-review CBC stays a preview

- **WHEN** the CBC education article is `in_review` with null reviewer metadata
- **THEN** the public CBC page shows educational-preview and review-pending labeling
- **AND** it does not show a last-reviewed date or “Clinically reviewed”

#### Scenario: Deprecated article does not overlay the public page

- **WHEN** a panel education article is deprecated or its `panelKey` does not match the route key
- **THEN** the public page does not render that article
- **AND** it falls back to the registry composition view when the Registry panel exists
