## ADDED Requirements

### Requirement: The Knowledge Base barrel preserves the canonical measurement schema export

The public `src/lib/knowledge-base` module SHALL re-export the canonical `measurementEducationArticleSchema` value defined by the shared EH-133 contract. The export SHALL reference the existing schema implementation; the repair SHALL NOT introduce a duplicate schema, alias-only replacement, or changed validation behavior.

#### Scenario: EH-134 consumers can import the measurement schema publicly

- **WHEN** a consumer imports `measurementEducationArticleSchema` from `src/lib/knowledge-base`
- **THEN** the value is available and validates the existing EH-134 measurement article shape
- **AND** the canonical schema behavior remains unchanged

### Requirement: Existing health route labels remain stable alongside Knowledge labels

The health navigation label helper SHALL preserve the existing `Biomarkers` label for `/app/biomarkers`, including paths carrying supported navigation query parameters. It SHALL also return `Knowledge` for `/app/knowledge` and nested Knowledge routes. Adding the Knowledge mapping SHALL NOT replace or alter labels for existing destinations.

#### Scenario: Biomarkers context navigation keeps its label

- **WHEN** `healthRouteLabel` receives `/app/biomarkers` with or without measurement, observation, or return-path query parameters
- **THEN** it returns `Biomarkers`
- **AND** document breadcrumbs and back actions that use this label remain consistent with the pre-EH-135 navigation contract

#### Scenario: Knowledge context navigation uses its new label

- **WHEN** `healthRouteLabel` receives `/app/knowledge` or a nested route such as `/app/knowledge/panels/cbc`
- **THEN** it returns `Knowledge`
- **AND** the existing labels for other app destinations remain unchanged
