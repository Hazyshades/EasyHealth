## ADDED Requirements

### Requirement: Active Registry 2.0 revision is the post-acceptance authority

After the EH-106 writer cutover, runtime consumers SHALL obtain accepted laboratory resolver outcome and verification status from the observation's active linked normalization revision and its synchronized observation projection. `document_extracted_biomarkers` SHALL remain a pre-acceptance review snapshot and MUST NOT be interpreted as post-acceptance authority. Runtime consumers MUST NOT reconstruct post-acceptance identity from Registry v1 fields or fallback adapters.

#### Scenario: Document consumer reads an active pending partial result

- **WHEN** an accepted observation has an active `pending` revision with `resolver_result = partial`
- **THEN** the consumer receives the partial outcome and pending verification state from that active revision
- **AND** it retains raw observation evidence without inventing a concrete definition

### Requirement: Consumer identity distinguishes factual incomplete rows from concrete series

Biomarker presentation, structured context, reports, conversion, and definition-specific trends SHALL preserve accepted incomplete rows as factual observations. Conversion and a definition-specific trend series SHALL require an active resolved concrete measurement definition. Partial, ambiguous, and unmapped rows MUST NOT enter a concrete-definition series or acquire a Registry v1 fallback key.

#### Scenario: Partial result appears without a trend identity

- **WHEN** an accepted partial observation is returned to the biomarkers page or report context
- **THEN** its raw name, value, unit, provenance, and partial state remain available
- **AND** it is not grouped into a concrete measurement trend or converted as a concrete definition

### Requirement: Health Profile admission uses reviewed Registry 2.0 bindings only

EH-106 SHALL route a resolved active concrete measurement into the existing Health Profile mapping only through a reviewed compatible Registry 2.0 assessment binding. It SHALL not create a final verification-status, readiness, freshness, or score-required-group rule; those decisions remain owned by EH-141 through EH-147.

#### Scenario: Reviewed bound definition reaches existing profile mapping

- **WHEN** a resolved active observation has a reviewed compatible assessment binding
- **THEN** Health Profile may map its binding input into the existing system aggregation
- **AND** EH-106 does not change the later final score/readiness contract

### Requirement: Registry v1 is unavailable to runtime consumers

Application runtime and worker roots SHALL not import Registry v1 adapters, fallback resolution, compatibility-only paths, Registry v1/v2 feature flags, or dual-read/shadow telemetry after the cutover. Frozen Registry v1 data MAY be used only by explicitly named migration/audit tooling. CI SHALL fail a change that reintroduces a prohibited runtime dependency.

#### Scenario: Runtime fallback is reintroduced

- **WHEN** a production runtime module imports a Registry v1 adapter or fallback fixture
- **THEN** the runtime-import CI check fails
- **AND** migration/audit tooling remains the only permitted exception

### Requirement: EH-104 Phase B waits for compatible consumers and writers

EH-106 SHALL complete the writer and consumer cutover evidence before EH-104 Phase B enables cross-axis guards, composite lineage enforcement, controlled purge enforcement, or legacy promotion RPC removal. EH-105 clean/disposable database verification and EH-104 populated-data preflight remain required release gates.

#### Scenario: Phase B preflight finds a cutover violation

- **WHEN** preflight finds a half-linked observation, divergent projection, or invalid verified/incomplete state after deployment
- **THEN** the persistent environment aborts final enforcement with diagnostics
- **AND** it does not silently re-enable Registry v1 or repair semantic data
