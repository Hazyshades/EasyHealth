## Context

Registry v1 contains 113 canonical biomarker records with useful aliases, units, conversions, system membership, and assessment roles. Registry 2.0 currently contains 23 curated concrete definitions and 101 generated adapter definitions. Directly evaluating the 44 result rows in `lab_data/sample_newest.pdf` against exact printed labels produced 2 resolved, 4 compatibility-only, and 38 unmapped outcomes. This diagnostic intentionally omitted model-proposed keys and richer section context, so it is not a production accuracy benchmark; it demonstrates that exact label variants, unit spellings, missing specialty concepts, and incomplete concrete identity all need explicit launch coverage.

The prior design assumed production observations and public interfaces already depended on Registry v1. That assumption is invalid: EasyHealth is pre-launch and has no valuable production migration boundary. Preserving two runtime systems would increase code paths and postpone the point at which Registry 2.0 becomes the product's actual data model.

The useful asset is the catalog knowledge, not the legacy runtime contract.

## Goals / Non-Goals

**Goals:**

- Run exactly one biomarker/measurement registry at launch.
- Migrate every Registry v1 concept into an explicit reviewed or provisional Registry 2.0 record without runtime adapter generation.
- Recognize every result type in the supplied sample PDF at least at analyte or measurement-family level.
- Fully resolve a result only when label, value kind, unit, specimen, timing, and method evidence justify one concrete reviewed definition.
- Preserve raw accepted results even when semantic identity is partial or unmapped.
- Separate measurement identity from assessment grouping and score eligibility.
- Measure launch readiness from corpus coverage, false-resolution review, ambiguity, and assessment impact.

**Non-Goals:**

- Promise that every possible laboratory test is supported at launch.
- Infer specimen, timing, method, or clinical equivalence from prevalence alone.
- Require the product owner to hand-author medical terminology records.
- Implement diagnosis, result interpretation, external reference ranges, or medical advice.
- Require complete LOINC binding in EH-102. Official common-result lists and UCUM units are prioritization and validation inputs; reviewed external coding can be additive.
- Preserve disposable development observations or old API shapes solely for backward compatibility.

## Decisions

### 1. Use a pre-launch hard cutover

Registry v1 is read only by a one-time migration/verification tool. The generated Registry 2.0 launch release is checked in as explicit source content. After the cutover, runtime modules, APIs, workers, assessment, reports, and UI import only Registry 2.0 services.

The frozen Registry v1 artifact remains in source control until migration verification proves that all 113 source concepts were dispositioned. It then serves as an audit fixture, not a fallback.

Alternative rejected: keep a runtime adapter until after launch. With no production consumers, this creates two identities, two acceptance paths, and two failure modes without protecting user data.

### 2. Build the launch catalog from three evidence sources

The launch inventory is the union of:

1. all 113 Registry v1 concepts and their established aliases, units, conversions, and assessment metadata;
2. every distinct row type and exact printed label/unit/value-kind fixture in `sample_newest.pdf`;
3. additional de-identified launch-corpus documents plus official common-result and common-unit lists used to find high-frequency omissions.

LOINC's common result/order lists help prioritize breadth, and UCUM-compatible unit tokens help normalize units. EasyHealth's own stable keys remain authoritative until individual external mappings are reviewed.

### 3. Separate broad recognition from clinical approval

Measurement records declare `maturity: "provisional" | "reviewed" | "retired"`.

- `provisional` means the concept is useful for recognition/display but one or more identity, unit, or assessment claims still require review;
- `reviewed` means identity axes, aliases, units, and assessment behavior have passed the launch review contract;
- `retired` remains readable in release history but is not a resolver candidate.

Only reviewed concrete definitions can produce `resolved` or feed assessment. Provisional records can support `partial` recognition and candidate evidence. This permits a broad launch catalog without presenting imported Registry v1 metadata as fully curated clinical truth.

Alternative rejected: count every imported record as curated. Numeric coverage would look high while semantic safety remained unknown.

### 4. Use a registry-native four-state resolver

```text
resolved   one reviewed concrete MeasurementDefinition is justified
ambiguous  multiple reviewed concrete definitions remain plausible
partial    a known analyte/family or provisional definition matches, but concrete identity is incomplete
unmapped   no launch-catalog analyte, definition, or reviewed alias matches
```

`partial` carries an optional analyte key, candidate definition keys, missing identity axes, accepted evidence, and hard conflicts. It has no dependency on Registry v1 and replaces `compatibility_only`.

For ALT in `U/L` with no specimen, the resolver recognizes ALT catalytic activity but does not guess serum or plasma. For Anti-Opisthorchis felineus IgG qualitative ELISA with no stated specimen, it recognizes the antibody test, nominal value kind, and ELISA method while leaving specimen unresolved.

### 5. Make observation storage tolerant of incomplete semantics

An accepted observation stores:

- immutable raw label, value, unit, reference text, source page/region, and extraction version;
- `resolution_status`;
- nullable `analyte_key`;
- nullable `measurement_definition_key`;
- the active append-only normalization revision and registry/resolver versions.

`source_extracted_biomarker_id` provides source uniqueness. A concrete measurement identity is not fabricated merely to satisfy a non-null legacy `biomarker_key`. Partial and unmapped observations remain visible and reprocessable but do not enter definition-specific trend series or assessment.

Alternative rejected: store a synthetic semantic key derived from raw text. That would turn unreviewed strings into durable medical identities.

### 6. Replace legacy canonical keys with assessment bindings

Measurement identity and assessment aggregation are separate. A reviewed definition may declare zero or more versioned assessment bindings such as an assessment input/group identifier and compatibility policy. Serum and plasma glucose may have distinct measurement identities while intentionally feeding the same reviewed assessment input.

The launch migration converts Registry v1 `system`, `scoreRole`, coverage, and conversion knowledge into explicit Registry 2.0 metadata or assessment bindings. No `canonicalKey` is retained merely to keep the old storage model alive.

### 7. Make aliases and units part of corpus evidence

Aliases are structured records with normalized form, language, source, match type, status, and fixture references. Parenthetical abbreviations (`Hemoglobin (HGB)`), percent abbreviations (`NEU%`, `LYMF%`), punctuation, OCR variants, and English/Russian names are tested as actual inputs rather than assumed to match by substring.

Units retain the raw token and normalize to reviewed unit families. The sample requires at least `g/L`, `mmol/L`, `umol/L`, `U/L`, `IU/mL`, `mg/L`, `x10^12/L`, `x10^9/L`, `%`, `fL`, `pg`, `mm/hour`, positivity coefficient, titer, and unitless qualitative results.

### 8. Use tiered launch coverage

- Tier A: common quantitative panels needed by assessment and trends; reviewed concrete definitions and strict unit/specimen fixtures.
- Tier B: common extended measurements; reviewed for identity and display/trends, assessment binding optional.
- Tier C: specialty or corpus-specific tests; at minimum safe analyte/family recognition and value-kind handling, display-only until clinical review is complete.

The sample serology/parasitology rows are Tier C. They must not be discarded or shown as OCR failures, but they need not affect health scoring.

### 9. Gate launch on corpus behavior, not legacy agreement

Required launch evidence includes:

- 100% raw preservation for extracted result rows;
- 100% of the 44 supplied sample row types recognized as `resolved`, `ambiguous`, or `partial`, with no expected sample row left `unmapped`;
- no false concrete specimen/method inference in reviewed negative fixtures;
- explicit disposition of all 113 Registry v1 concepts as reviewed, provisional, merged, or retired;
- no runtime imports of Registry v1 or generated adapter definitions;
- deterministic release manifest and resolver output;
- manual review of score-affecting mappings and representative corpus failures.

Coverage is reported separately for analyte recognition, concrete resolution, alias match, unit compatibility, value-kind parsing, and assessment eligibility. A single aggregate percentage is insufficient.

## Risks / Trade-offs

- [Migrating all 113 concepts expands EH-102] -> Use migration tooling and maturity tiers; do not require every imported record to become assessment-capable.
- [A broad provisional catalog may appear clinically complete] -> UI and APIs expose resolution status; only reviewed definitions can resolve or score.
- [Removing `biomarker_key` touches many consumers] -> Perform one coordinated pre-launch schema/API cutover and reset disposable development data.
- [One sample PDF is not representative] -> Use it as the first mandatory fixture, then add de-identified documents across target laboratories, languages, and panels.
- [Missing specimen is common in printed reports] -> Support `partial` recognition and later reprocessing instead of guessing or treating the entire result as unknown.
- [External terminology work can dominate scope] -> Use common LOINC/UCUM lists for prioritization and validation; add only reviewed external codes.
- [Assessment behavior can accidentally change] -> Treat assessment bindings as versioned reviewed artifacts and require score-impact regression output.

## Migration Plan

1. Generate a launch inventory from Registry v1 and the sample corpus, recording source, aliases, units, maturity, and unresolved curation questions.
2. Add Registry 2.0 maturity, partial-resolution, structured alias, unit, and assessment-binding contracts.
3. Convert all Registry v1 concepts to explicit Registry 2.0 records; no runtime adapter output is accepted.
4. Add the sample-specific concepts and variants listed in `launch-catalog.md`.
5. Replace observation `biomarker_key` identity with nullable analyte/measurement identity plus resolution status and immutable raw provenance.
6. Migrate extraction, acceptance, normalization, trends, reports, health profile, unit conversion, and assessment consumers to Registry 2.0.
7. Remove `legacy_adapter`, `compatibility_only`, legacy fallback, feature flags, dual-read, shadow-difference telemetry, and legacy-specific database fields.
8. Reset or transform local development data, run the full launch-corpus and assessment regression suite, and publish the first launch manifest.
9. Keep the frozen v1 fixture only for audit of the one-time migration; prohibit application imports in CI.

Rollback before production is a code/database reset to the last development revision, not restoration of a permanent runtime Registry v1 path.

## Open Questions

- Which countries/languages and laboratory styles must be represented beyond the current English/Russian aliases before closed beta?
- Who provides clinical approval for reviewed assessment-capable definitions versus display-only provisional recognition?
- Which additional de-identified lab reports should join the launch corpus after the supplied sample?
- Should reviewed LOINC codes be included in the first launch manifest or added in the planned terminology phase?
