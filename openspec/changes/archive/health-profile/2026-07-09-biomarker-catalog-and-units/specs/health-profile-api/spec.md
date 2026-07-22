## ADDED Requirements

### Requirement: Systems include catalog-driven ids

`GET /api/health-profile` SHALL return system entries using catalog body system ids including `inflammation` and `nutrients` when those systems have markers.

#### Scenario: Inflammation system in API payload

- **WHEN** the user has cataloged inflammation markers and requests the health profile
- **THEN** the `systems` array may include an entry with id `inflammation`
- **AND** those markers are not forced solely into `general` when cataloged

### Requirement: Scoring fields respect score roles

System `state_score` and `data_confidence` in the health profile API SHALL follow catalog score roles and coverage flags (core scoring; coverage set for confidence).

#### Scenario: Confidence ignores missing extended markers

- **WHEN** a system’s extended catalog markers are absent but coverage-flagged markers are present with refs
- **THEN** `data_confidence` is not computed as if every extended marker were required

### Requirement: Display units in marker payload

The health profile API SHALL either present marker `value`, `unit`, and refs in the user’s preferred lab unit system, or include both native fields and display fields so the client can render preferred units without local factor tables.

#### Scenario: Preferred units applied or dual fields returned

- **WHEN** an authenticated user with `lab_unit_system` set requests `GET /api/health-profile`
- **THEN** each marker includes sufficient data to render preferred units (converted fields and/or native plus conversion metadata)
- **AND** lab-native storage is not mutated by the request
