# scoped-report-sharing

## ADDED Requirements

### Requirement: Owner creates an expiring scoped share

An authenticated owner SHALL be able to create a share for a validated report with an expiry, optional PIN, explicit `download_policy`, an `allowed_export_formats` subset of `pdf`, `csv`, and `json`, and optional document IDs. The server SHALL select a configured token-key version, persist that version with the keyed token digest, and verify that the report and every selected document belong to the owner and are in the report scope. An empty format list SHALL deny file exports.

#### Scenario: Report-only share is created

- **WHEN** an owner creates a validated report share with `download_policy` `report` and `allowed_export_formats` `["pdf", "json"]`
- **THEN** the response returns a one-time plaintext link
- **AND** the persisted share stores only a token digest and the explicit format allow-list
- **AND** PDF and JSON exports are allowed while CSV and raw document downloads are denied

#### Scenario: Out-of-scope document is rejected

- **WHEN** a create request includes a document not in the report's materialized source scope
- **THEN** the server returns a generic validation error
- **AND** no share is created

### Requirement: Public token verification

The public share route SHALL verify token digest, expiry, revocation, optional PIN, report ownership, report validation status, and requested resource scope on every request. Invalid, expired, revoked, and missing shares SHALL fail with the same non-enumerating response.

#### Scenario: Valid token opens the scoped report

- **WHEN** a recipient presents a valid unexpired token and satisfies any PIN requirement
- **THEN** the route returns only the selected validated report resources
- **AND** the response is `no-store` and non-indexable

#### Scenario: Revoked or expired token fails safely

- **WHEN** a recipient presents a revoked or expired token
- **THEN** the route returns the generic failure response
- **AND** it does not reveal whether revocation or expiry caused the failure

### Requirement: Public response privacy

Public share responses SHALL NOT expose bearer tokens, PIN fields, profile IDs, storage paths, unrelated documents, or third-party analytics data. The route SHALL set private no-store caching, noindex headers, and a restrictive referrer policy.

#### Scenario: Public response headers are inspected

- **WHEN** a valid recipient loads a shared report or approved export
- **THEN** the response includes `Cache-Control: no-store, private`
- **AND** includes `X-Robots-Tag: noindex, nofollow`
- **AND** does not include a raw storage path
