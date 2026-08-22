## ADDED Requirements

### Requirement: Documents hub first paint does not wait on a serial identity fetch

After an authenticated navigation to `/app/documents`, the hub SHALL obtain the initial document list without requiring a completed `/api/profile` fetch first. Initial list authorization MAY use the session already resolved for the app layout. Tab changes and processing polls MAY still call `GET /api/documents`.

#### Scenario: First Lab results list uses server-provided data

- **WHEN** a signed-in user with an existing profile opens `/app/documents` on the Lab results tab
- **THEN** the initial list payload is available from the navigation/render of that page
- **AND** the hub does not block first list paint on `GET /api/profile`

#### Scenario: Tab change still uses the documents list API

- **WHEN** the user selects a different document type tab after the hub has rendered
- **THEN** the hub loads that tab through `GET /api/documents` (or equivalent)
- **AND** existing empty-state and upload CTA rules still apply
