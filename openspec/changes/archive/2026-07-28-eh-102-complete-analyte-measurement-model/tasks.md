## 1. Reopened Pre-launch Architecture

- [x] 1.1 Verify there is no production dataset or external Registry v1 compatibility contract requiring a dual runtime.
- [x] 1.2 Inventory the 113 Registry v1 concepts, 23 current curated definitions, and 44 rows in `sample_newest.pdf`.
- [x] 1.3 Record architecture approval for a pre-launch hard cutover and update GitHub roadmap items EH-102, EH-105, EH-106, and the Registry 2.0 rollout work.

## 2. Registry-native Identity and Resolution

- [x] 2.1 Add measurement maturity (`provisional`, `reviewed`, `retired`) and validation rules.
- [x] 2.2 Replace `definitionSource: legacy_adapter`, legacy `canonicalKey`, and legacy coverage invariants with explicit source provenance and optional assessment bindings.
- [x] 2.3 Replace `compatibility_only` with registry-native `partial`, carrying optional analyte identity, candidate definitions, missing axes, evidence, and conflicts.
- [x] 2.4 Ensure only one reviewed concrete candidate can produce `resolved`; provisional, ambiguous, partial, and unmapped rows never auto-score.
- [x] 2.5 Retain explicit analyte, specimen, property, scale, timing, method, value-kind, unit-policy, alias, and lifecycle contracts.

## 3. Launch Catalog Migration

- [x] 3.1 Build a deterministic one-time inventory generator from Registry v1 that produces reviewable Registry 2.0 source records rather than runtime adapters.
- [x] 3.2 Disposition all 113 source concepts as reviewed, provisional, merged, or retired, preserving established terminology and conversions without inventing unknown axes.
- [x] 3.3 Add exact sample-PDF aliases, abbreviations, punctuation, section/method context, and unit spellings.
- [x] 3.4 Add ASO; MPV, PDW, plateletcrit; manual differential variants; parasite antibody tests; total IgE; and eosinophilic cationic protein.
- [x] 3.5 Retain and review concrete glucose, differential, RDW, reticulocyte, segmented/band neutrophil, and ALT/AST/ALP/GGT definitions.
- [x] 3.6 Generate a launch report separating analyte recognition, concrete resolution, ambiguity, partial recognition, unit compatibility, value-kind parsing, and assessment eligibility.

## 4. Observation and Consumer Hard Cutover

- [x] 4.1 Replace required observation `biomarker_key` identity with `resolution_status`, nullable `analyte_key`, nullable `measurement_definition_key`, source-row identity, and active revision linkage.
- [x] 4.2 Migrate extraction, bulk acceptance, manual correction, and reprocessing so resolved, partial, and unmapped raw results are preserved without fabricated semantic keys.
- [x] 4.3 Migrate trends, biomarker APIs/UI, reports, structured context, and unit conversion to Registry 2.0 identity.
- [x] 4.4 Migrate health-system scoring from legacy key/score-role lookup to versioned reviewed assessment bindings.
- [x] 4.5 Use a pre-launch database cutover or development-data reset; do not add historical production backfill complexity.

## 5. Remove Legacy Runtime

- [x] 5.1 Delete runtime adapter generation and prohibit application imports of the frozen Registry v1 catalog.
- [x] 5.2 Remove legacy fallback resolution, `compatibility_only`, Registry v1/v2 feature flags, and off/shadow/promote legacy branches.
- [x] 5.3 Remove legacy-specific telemetry and database/API fields after dependent consumers use Registry 2.0.
- [x] 5.4 Retain Registry v1 only as an audited migration fixture and add CI enforcement that runtime bundles do not depend on it.

## 6. Launch Corpus and Safety Verification

- [x] 6.1 Turn all 44 sample rows into committed exact-label/unit/value-kind resolver fixtures.
- [x] 6.2 Prove 44/44 sample row types are at least recognized and no expected row remains unmapped.
- [x] 6.3 Add negative fixtures proving missing specimen/method/timing remains partial or ambiguous and is never guessed.
- [x] 6.4 Verify raw preservation and reprocessing for resolved, partial, ambiguous, and unmapped accepted observations.
- [x] 6.5 Review all score-affecting assessment bindings and record before/after assessment impact.
- [x] 6.6 Run registry, resolver, observation, documents, trends, reports, health-profile, typecheck, and production-build verification.
- [x] 6.7 Validate OpenSpec and record EH-102 architecture approval with the launch manifest and coverage report.
