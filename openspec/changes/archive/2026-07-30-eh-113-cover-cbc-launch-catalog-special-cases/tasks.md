## 1. Compatibility prerequisites and inventory

- [x] 1.1 Confirm the implemented EH-111/EH-112 contracts for missing-unit policy, missing value kind, specimen evidence, `missingAxes`, candidate eligibility, incomplete-state serialization, and conversion eligibility; update this change's specs before implementation if the settled contract differs.
- [x] 1.2 Inventory existing Registry 2.0 CBC definitions, aliases, sample fixtures, resolver tests, corpus rows, read-boundary consumers, and any frozen Registry v1-derived CBC runtime references.
- [x] 1.3 Define the reviewed identity matrix for five-part differential percent/absolute forms, segmented/band populations, automated/manual methods, RDW-CV/RDW-SD, reticulocyte forms, MPV, PDW, and plateletcrit, including unit, specimen, method/modifier, value-kind, maturity, and consumer eligibility.

## 2. Health-profile Registry 2.0 catalog

- [x] 2.1 Add or revise reviewed CBC measurement definitions for five-part differential percentage and absolute results, keeping unit families and aliases distinct in both directions.
- [x] 2.2 Add reviewed segmented/band neutrophil and automated/manual differential definitions or explicit provisional records where clinical review is incomplete; require method/population context for concrete selection.
- [x] 2.3 Add or revise RDW-CV/RDW-SD, reticulocyte percent/absolute, MPV, PDW, and plateletcrit definitions with coherent property/scale and unit policies.
- [x] 2.4 Replace broad/sample-only CBC aliases with provenance-aware exact, normalized, multilingual, parenthetical, laboratory, and explicitly reviewed OCR aliases; keep unsafe OCR variants as negative fixtures.
- [x] 2.5 Make `allowedSpecimens` authoritative in resolver compatibility, validate canonical specimen coherence, and remove or correct contradictory CBC specimen metadata.
- [x] 2.6 Extend Registry 2.0 manifest/validation checks for duplicate CBC identities, alias collisions across percent/absolute or RDW variants, invalid unit policies, contradictory specimen policies, and reviewed-provenance completeness.

## 3. Documents extraction and resolver integration

- [x] 3.1 Preserve CBC section, specimen, method, modifier, unit, value kind, parenthetical abbreviation, locale, and raw label evidence from extraction into the existing resolver input without introducing a CBC-only matcher.
- [x] 3.2 Enforce missing-unit, unknown-unit, missing/conflicting value-kind, specimen, method, and modifier behavior through the shared resolver policy for CBC candidates.
- [x] 3.3 Ensure bare/shared aliases such as `NEU`, `LYM`, `MON`, `EOS`, `BAS`, `RDW`, and `RETIC` resolve only with sufficient compatible evidence and otherwise return partial or ambiguous with structured evidence.
- [x] 3.4 Verify candidate evidence never writes or projects a concrete definition key unless exactly one reviewed CBC definition is concrete-eligible.

## 4. Documents launch corpus and fixtures

- [x] 4.1 Add exact fixture rows for all five-part differential percentage and absolute measurements, including percent-to-count and count-to-percent conflict controls.
- [x] 4.2 Add fixtures for segmented versus band neutrophils and automated versus manual differential variants, including missing-method/population cases.
- [x] 4.3 Add fixtures for RDW-CV/RDW-SD, reticulocyte percentage/absolute forms, MPV, PDW, plateletcrit, parenthetical abbreviations, and exact sample labels.
- [x] 4.4 Add multilingual CBC fixtures with locale/source provenance and OCR-corrupted positive/negative cases that prove unsupported corruptions do not acquire concrete identity.
- [x] 4.5 Add missing specimen, missing/unknown unit, missing/conflicting value-kind, and cross-family unit conflict fixtures with expected outcome, missing axes, conflicts, and candidate evidence.
- [x] 4.6 Extend the candidate-corpus report with CBC segmentation by resolver outcome, evidence axis, alias source/match type, maturity, and consumer eligibility; keep the run deterministic and non-mutating.

## 5. Health-profile consumer safety

- [x] 5.1 Add read-boundary regression coverage proving only an active synchronized `resolved` revision with a reviewed CBC definition reaches concrete observation identity.
- [x] 5.2 Add conversion regression coverage proving partial, ambiguous, unmapped, provisional, inactive, and evidence-only candidate keys cannot return or execute a conversion policy.
- [x] 5.3 Add assessment/readiness regression coverage proving incomplete CBC candidates cannot contribute reviewed bindings and equivalent CBC contribution groups do not double-count sibling definitions.
- [x] 5.4 Remove any remaining CBC runtime dependency on frozen Registry v1 keys, broad fallback catalogs, or consumer-side label matching; migrate every active caller to reviewed Registry 2.0 identity.

## 6. Verification and release evidence

- [x] 6.1 Add focused resolver unit tests for every EH-113 identity and negative matrix, including bidirectional unit-family conflicts, missing axes, and exact expected evidence codes.
- [x] 6.2 Add deterministic candidate-corpus regression tests for all EH-113 fixtures, required fixture manifest entries, outcome segmentation, and zero unexpected concrete resolutions.
- [ ] 6.3 Run the Registry validation, focused biomarker/resolver, runtime-cutover, and candidate-corpus commands; record exact commands and passing output in the EH-113 developer evidence.
- [x] 6.4 Assess database-test applicability under the EH roadmap database-testing rules; run the required safe database regression suite if persisted/read-boundary behavior changes, otherwise document why no database contract changed.
- [x] 6.5 Create or update `QA/eh-113/checklist.md` with synthetic/de-identified test data, numbered product-interface checks, explicit expected partial/ambiguous behavior, and separate developer evidence; do not mark unavailable UI checks as executed.
- [ ] 6.6 Run `openspec validate eh-113-cover-cbc-launch-catalog-special-cases --strict`, reconcile every issue acceptance criterion with automated/manual evidence, and leave the change ready for roadmap progress update and archival only after implementation is complete.