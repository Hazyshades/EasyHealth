## Why

EasyHealth is still pre-launch: there is no production dataset, no external compatibility contract, and no historical observation corpus that justifies running two biomarker identity systems. The previous EH-102 design treated Registry v1 as a permanent runtime compatibility boundary and introduced adapters, dual behavior, and `compatibility_only`. That solves a migration problem the product does not currently have and leaves most real laboratory rows outside the curated model.

The launch requirement is different: preserve the useful terminology, aliases, units, conversions, and assessment policy already collected in Registry v1, migrate that knowledge into one Registry 2.0 launch catalog, and remove Registry v1 from runtime before production. Unknown or incompletely specified results must still retain raw evidence without forcing a false measurement identity.

## What Changes

- Treat the frozen 113-entry Registry v1 catalog as migration input and a regression fixture only; it is not loaded by application runtime after the cutover.
- Build a single launch catalog from all 113 Registry v1 concepts, the 44 row types in `lab_data/sample_newest.pdf`, exact real-world label/unit fixtures, and an explicit review backlog.
- Add the sample-specific gaps: ASO; platelet indices; automated/manual differential variants; Giardia, Ascaris, Toxocara, Opisthorchis, Echinococcus, and Trichinella antibody tests; total IgE; and eosinophilic cationic protein.
- Give catalog records an explicit maturity state so broad recognition does not masquerade as reviewed clinical equivalence. Only reviewed concrete definitions may auto-resolve or participate in assessment; provisional entries may support recognition and review.
- Replace the legacy-specific `compatibility_only` state with a registry-native `partial` state: the analyte or measurement family is recognized, but available evidence does not justify one concrete reviewed `MeasurementDefinition`.
- Remove runtime `legacy_adapter`, legacy fallback resolution, Registry v1/v2 feature flags, dual-read comparison, and legacy promotion paths.
- Replace legacy `canonicalKey` storage coupling with explicit optional `analyte_key`, optional `measurement_definition_key`, resolution status, and independent assessment bindings.
- Preserve every accepted raw result, including `partial` and `unmapped` rows, while excluding unresolved rows from semantic trends and assessment.
- Make the sample PDF a checked launch-corpus fixture with measurable label, unit, value-kind, and resolution coverage.
- Permit a pre-production schema cutover or development-data reset instead of designing a production backfill/rollback contract for data that does not exist.

## Capabilities

### New Capabilities

- `launch-measurement-catalog`: Defines the launch inventory, maturity tiers, corpus coverage report, and release gates for the single runtime registry.

### Modified Capabilities

- `analyte-measurement-model`: Removes legacy identity coupling, introduces provisional/reviewed maturity and partial resolution, and makes assessment bindings explicit.
- `biomarker-catalog`: Migrates useful Registry v1 knowledge into Registry 2.0 and prohibits runtime adapter fallback after cutover.
- `document-extraction-review`: Preserves and accepts raw partial/unmapped observations without forcing a false semantic identity.
- `observation-identity`: Uses optional analyte and measurement-definition identity rather than legacy `biomarker_key` as the primary semantic contract.

## Impact

- This reopens EH-102 implementation work that previously completed the compatibility-adapter path.
- Registry v1 remains in source control only as an audited migration fixture until the launch catalog migration is verified; application code must not import it afterward.
- Observation persistence, health-profile aggregation, unit conversion, reports, APIs, and trends must migrate from `biomarker_key` to Registry 2.0 identity and explicit assessment bindings in one pre-launch cutover.
- Existing local development data may be reset. Raw PDF fixtures and extraction rows remain valuable corpus evidence and are not discarded.
- EH-103 must target the new observation identity and may require complete provenance for new rows instead of nullable legacy-read compatibility.
- `strict-system-score-readiness-2` must replace legacy-vs-new shadow comparison with launch-corpus precision, coverage, ambiguity, and assessment-impact gates.
- No diagnosis logic, external reference ranges, or automatic clinical interpretation is introduced.
