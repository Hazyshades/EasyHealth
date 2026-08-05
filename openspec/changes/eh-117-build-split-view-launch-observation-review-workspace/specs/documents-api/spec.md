## ADDED Requirements

### Requirement: Per-document observations read exposes raw review evidence

`GET /api/documents/[id]/observations` SHALL return, for every projected
observation, the raw provenance fields the review surface renders: `raw_name`,
`raw_value_text`, `raw_unit`, `raw_reference_text`, `specimen`, `modifier`,
`source_page`, `source_text` and `confidence`, alongside the boundary-projected
`resolver_result`, `verification_status`, `registry_binding_ready` and
`resolution_details`. The response SHALL be served with `Cache-Control:
no-store` so review state is never read from a cache. The route MUST NOT return
`bounding_box`, because no consumer is permitted to draw a region highlight
until reliable bounding boxes exist.

#### Scenario: Observation carries extraction confidence

- **WHEN** an authenticated owner requests the observations of their document
- **THEN** every returned observation includes its recorded extraction
  `confidence`, or `null` when none was recorded

#### Scenario: Review state is not cached

- **WHEN** the observations endpoint responds successfully
- **THEN** the response carries `Cache-Control: no-store`

#### Scenario: Region coordinates are not exposed

- **WHEN** an observation row has a stored `bounding_box`
- **THEN** the endpoint does not return it
