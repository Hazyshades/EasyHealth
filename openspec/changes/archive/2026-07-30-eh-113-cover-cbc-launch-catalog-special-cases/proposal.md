## Why

EH-113 must complete the CBC portion of the Registry 2.0 launch catalog before the resolver-case tracks can ship. Current reviewed definitions cover only a subset of CBC semantics, so common differential, platelet, red-cell distribution, reticulocyte, laboratory-method, multilingual, and OCR-corrupted rows can resolve to the wrong concrete identity or remain unmapped when they should be recognized as partial or ambiguous.

The change is needed now because EH-113 depends on the stable compatibility and incomplete-outcome contracts from EH-111 and EH-112. It must extend the existing resolver and launch-corpus machinery rather than introduce a second matcher or infer a concrete key from missing context.

## What Changes

- Add reviewed or explicitly provisional Registry 2.0 CBC measurement definitions for five-part differential absolute and percent results, segmented and band neutrophils, automated and manual variants, RDW-CV/RDW-SD, reticulocyte variants, MPV, PDW, plateletcrit, and exact parenthetical/abbreviated sample labels.
- Make CBC aliases provenance-aware, including locale, laboratory or fixture source, match type, approval status, and the intended measurement definition; prevent shared labels such as `NEU`, `LYM`, or `RDW` from crossing percent, absolute, or distribution-width definitions without compatible evidence.
- Extend the launch corpus with exact English, multilingual, sample-specific, and OCR-corrupted CBC fixtures, including missing unit, specimen, value-kind, method, and differential-context cases.
- Encode explicit compatibility outcomes for CBC special cases: resolve only when the available label, unit family, value kind, specimen, method, and modifier evidence identifies one reviewed definition; preserve recognized-but-incomplete rows as partial or ambiguous; keep unsupported or conflicting rows unmapped/invalid without concrete inference.
- Preserve the EH-111/EH-112 resolver output contract, including missing-axis and structured evidence fields, and ensure candidate keys in decision evidence never become active concrete identities.
- Add deterministic resolver and corpus regression coverage for percent-versus-absolute conflicts in both directions, segmented-versus-band neutrophils, automated-versus-manual differentials, RDW variants, platelet indices, reticulocyte variants, multilingual aliases, OCR negatives, and missing context.
- Add launch reporting and CI evidence that separates resolved, ambiguous, partial, and unmapped CBC rows and proves that incomplete or conflicting candidates cannot reach normalization conversion or reviewed consumer bindings.
- **BREAKING** Treat CBC definitions as reviewed Registry 2.0 identities only; remove any CBC-specific reliance on frozen launch-catalog/v1 keys or generic fallback matching.

## Capabilities

### New Capabilities

- `cbc-launch-catalog-coverage`: Reviewed CBC definitions, provenance-safe aliases, exact fixtures, compatibility outcomes, launch coverage reporting, and conversion/consumer eligibility gates for CBC measurements.

### Modified Capabilities

- `biomarker-catalog`: Extend the Registry 2.0 measurement-definition and alias requirements with CBC-specific semantic axes and fixture-backed review status.
- `observation-resolution-verification`: Preserve and exercise the EH-111/EH-112 resolver outcome, missing-axis, evidence, and concrete-resolution eligibility contract for CBC rows.

## Impact

- **Registry:** `src/lib/biomarkers/measurement-resolution.ts`, biomarker types, aliases, reviewed definitions, and any Registry 2.0 manifest/validation helpers.
- **Extraction and resolution:** CBC parsing inputs and resolver consumers that must retain method, modifier, specimen, value kind, and raw evidence without fabricating identity.
- **Fixtures and reporting:** launch corpus rows/documents, CBC-specific fixture data, corpus runner expectations, and segmented coverage output.
- **Conversion and read boundaries:** reviewed concrete-definition checks so partial, ambiguous, unmapped, or merely evidenced candidate keys cannot trigger conversion or assessment bindings.
- **Verification:** unit, resolver, corpus, and focused API/service regression commands documented for EH-113; no database schema migration is expected unless implementation discovers a required persisted-field contract from EH-112.
- **Roadmap boundary:** This proposal does not implement EH-112 UI/API behavior, glucose (EH-114), durable trace support access (EH-115), or final cross-domain synthesis (EH-116).