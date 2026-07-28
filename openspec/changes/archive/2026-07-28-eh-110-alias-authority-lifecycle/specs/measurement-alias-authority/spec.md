## ADDED Requirements

### Requirement: Registry aliases SHALL be explicit authority records
The Registry 2.0 catalog SHALL represent every resolver-admitted alias as an `AliasDefinition` with a stable key, owning measurement-definition key, literal value, deterministic normalized value, source, match type, match authority, approval status, lifecycle, source-record provenance, and any applicable locale, laboratory scope, review reference, and fixture references. The catalog MUST reject an alias with missing required provenance, a duplicate stable key, or a fixture source without one or more fixture references.

#### Scenario: Catalog rejects an unprovenanced alias
- **WHEN** a registry build contains an alias without its required source-record provenance
- **THEN** the build MUST fail before the alias can be exposed to the resolver or manifest

#### Scenario: Fixture alias retains corpus ownership
- **WHEN** a fixture-derived alias is included in the launch catalog
- **THEN** its record MUST identify the de-identified source fixture and the owning measurement definition

### Requirement: Alias authority and lifecycle SHALL control resolver admission
The catalog SHALL distinguish `recognition_only` from `reviewed_resolution` authority and `provisional` from `reviewed` approval. Only an active, reviewed alias with `reviewed_resolution` authority may admit a reviewed active definition to the concrete-resolution candidate set. An active provisional or recognition-only alias MAY admit its definition for recognition evidence only. A deprecated alias MUST remain serializable for release-history reproducibility and MUST NOT admit any new resolver candidate. Alias authority MUST NOT override definition maturity or definition retirement.

#### Scenario: Provisional corpus label remains partial recognition
- **WHEN** an extracted label matches an active provisional fixture alias for a provisional definition
- **THEN** the resolver MUST retain recognition evidence without producing a concrete reviewed definition from that alias

#### Scenario: Deprecated alias cannot create a new candidate
- **WHEN** an extracted label equals a deprecated alias
- **THEN** the resolver MUST NOT admit the alias or its definition as a candidate

#### Scenario: Reviewed alias cannot promote a provisional definition
- **WHEN** an active reviewed-resolution alias matches a provisional measurement definition
- **THEN** the resolver MUST NOT produce a concrete reviewed resolution from that definition

### Requirement: Matching SHALL use declared bounded policies only
The alias-admission boundary SHALL compare labels only with the active alias's declared `exact`, `normalized`, `ocr_variant`, or `bounded_fuzzy` policy. `exact` MUST use canonical Unicode/trimmed literal comparison; `normalized` MUST use the catalog normalization token; `ocr_variant` MUST match an explicitly declared variant; and `bounded_fuzzy` MUST declare a maximum Damerau-Levenshtein distance of one or two, require a normalized input length of at least five, and have active reviewed-resolution authority. The resolver MUST NOT use substring, token-containment, phonetic, unbounded edit-distance, or implicit proposed-key matching.

#### Scenario: Fuzzy input within a reviewed bound is admitted
- **WHEN** a normalized extraction label of at least five characters is within the declared distance of one from an active reviewed bounded-fuzzy alias
- **THEN** the admission result MUST identify that alias key, its match type, and its authority

#### Scenario: Over-distance text is not admitted
- **WHEN** an extraction label exceeds the bounded-fuzzy alias's declared distance
- **THEN** the alias MUST NOT be admitted

#### Scenario: Unsupported fuzzy authority is rejected
- **WHEN** a provisional or recognition-only alias declares `bounded_fuzzy`
- **THEN** the catalog build MUST reject the alias

### Requirement: Laboratory scope SHALL constrain alias matching
An alias with a laboratory scope SHALL be admitted only when the extraction input identifies the same laboratory. An unscoped alias MAY be admitted globally. Locale is preserved as provenance and MUST NOT expand an alias's match scope until locale-aware extraction selection is explicitly introduced.

#### Scenario: Foreign-laboratory alias is excluded
- **WHEN** an input identifies laboratory A and only a matching alias scoped to laboratory B exists
- **THEN** the alias MUST NOT be admitted

#### Scenario: Global reviewed alias remains available
- **WHEN** an input matches an unscoped active reviewed-resolution alias
- **THEN** the resolver MAY admit it regardless of laboratory attribution

### Requirement: Resolver evidence SHALL identify the admitted alias
The alias-admission boundary SHALL return the matched alias key, match type, authority, approval status, lifecycle, and source provenance with every candidate admission. Candidate evidence SHALL preserve the matched alias identity and alias-specific reason code. Downstream resolver policy MUST consume this admission and MUST NOT recreate matching by direct normalized-string comparison.

#### Scenario: Candidate evidence records authority source
- **WHEN** the resolver evaluates a candidate admitted by an alias
- **THEN** its evidence MUST identify the exact alias record and declared matching policy used

### Requirement: Launch corpus ownership SHALL be versioned and testable
The release SHALL include a versioned, de-identified corpus descriptor with stable fixture identifiers, exact labels, laboratory attribution when known, and the alias keys authorized by each fixture. Reviewed and bounded-fuzzy alias authority SHALL name a review reference. The regression suite MUST include negative authority cases for deprecated, provisional, foreign-laboratory, fixture-only, unapproved-fuzzy, and over-distance aliases.

#### Scenario: Negative authority suite detects permissive matching
- **WHEN** any negative authority fixture is evaluated
- **THEN** the result MUST demonstrate that the disallowed alias cannot admit a reviewed concrete-resolution candidate

### Requirement: Release manifests SHALL reproduce alias authority
The deterministic registry manifest SHALL serialize every field that affects alias admission or release interpretation, including stable identity, literal and normalized forms, source, match policy and bounds, authority, approval, lifecycle, scope, provenance, review reference, and fixture references. Changing admitted alias text, scope, policy, authority, approval, lifecycle, provenance, or fixture ownership MUST be classified as review-required; removing an active reviewed-resolution admission or broadening its authority or scope MUST be classified as breaking.

#### Scenario: Manifest digest changes with alias approval
- **WHEN** only an alias's approval status changes
- **THEN** the manifest digest MUST change and the definition change MUST be classified as review-required or breaking according to the authority effect

### Requirement: The catalog SHALL cut over without legacy alias admission
The pre-launch implementation SHALL migrate all runtime Registry 2.0 aliases to explicit authority records and remove the implicit alias factory, implicit reviewed defaults, and direct normalized-string alias comparison. Runtime resolution MUST have exactly one alias-admission path. Historical resolver revisions remain readable through their stored evidence and registry manifests; they MUST NOT require runtime reactivation of deprecated aliases.

#### Scenario: Runtime static boundary excludes legacy matching
- **WHEN** the Registry 2.0 resolver is inspected or exercised after cutover
- **THEN** it MUST obtain alias candidates exclusively from the authoritative alias-admission boundary