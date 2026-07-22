## ADDED Requirements

### Requirement: Machine-readable service manifest

The system SHALL expose `GET /api/agent/manifest` returning, without payment, a machine-readable description of every available agent service: endpoint path, tier, base price, dynamic-pricing parameters, and request/response JSON schemas.

#### Scenario: Manifest lists all services

- **WHEN** an agent sends `GET /api/agent/manifest`
- **THEN** the system returns HTTP 200 with an entry for each `/api/agent/*` insight endpoint
- **THEN** each entry includes its tier, base price, and request/response schema

#### Scenario: Manifest is free

- **WHEN** an agent requests the manifest without any payment header
- **THEN** the system returns HTTP 200 and does not return HTTP 402

### Requirement: Manifest enables autonomous tier selection

The manifest SHALL provide sufficient pricing and schema information for a buyer agent to select a service tier and construct a valid request before making any payment.

#### Scenario: Agent selects tier from manifest data

- **WHEN** a buyer agent reads the manifest and evaluates tiers against its task and budget
- **THEN** it can identify a target endpoint, its base price, and the schema needed to build a request
- **THEN** it can construct a request body that passes endpoint validation
