# Proposal

## Why

EasyHealth needs deterministic laboratory documents that can demonstrate upload, extraction review, verification, Health Profile readiness, biomarker history, and report dynamics without using patient data. The current `lab_data` corpus contains real or reconstructed reference material, but it does not provide one controlled English/Spanish synthetic corpus with repeated compatible measurements across three dates.

## What Changes

- Add a bilingual synthetic laboratory corpus for the `documents` domain.
- Add one Spanish multi-date report and three Spanish single-date reports under `lab_data/chile/`.
- Add one English multi-date report and three English single-date reports under `lab_data/chile/en/`.
- Make the multi-date report contain the same measurement definitions and dated rows as the three single-date reports so both upload strategies exercise the same history behavior.
- Cover score-readiness groups and useful extensions across lipid, metabolic, thyroid, liver, kidney, CBC, iron, nutrient, and inflammation panels.
- Preserve extraction evidence in the rendered document: printed raw labels, numeric values, units, reference intervals, collection dates, specimen, method, modifiers, section headings, and page-local source text.
- Use exact Registry-supported English labels and reviewed Spanish aliases where available. Do not create resolver aliases as part of this fixture change.
- Mark every page as synthetic demonstration data and use fictional, non-identifying patient and laboratory metadata.
- Keep the PDF text-native and deterministic so OCR/extraction can read table rows and source dates without relying on image-only scans.
- Do not silently overwrite the existing untracked `lab_data/chile/original.pdf`; implementation must inspect it first and preserve it or replace it only when it is confirmed to be the intended Spanish multi-date fixture.

## Capabilities

### New Capabilities

- None. This is a deterministic fixture-corpus addition, not a new product behavior.

### Modified Capabilities

- None. `skip_specs: true` is set because the existing document extraction, Registry resolution, score-readiness, and dynamics contracts are being exercised rather than changed.

Reference-only capability specs for implementation and verification:

- `incomplete-laboratory-outcomes`
- `measurement-alias-authority`
- `health-profile-score-readiness`
- `timeline-panel-release-validation`

## Impact

- **Target domain:** `documents`, with verification touchpoints in Health Profile and reports.
- **Repository assets:** eight PDF fixtures under `lab_data/chile/`.
- **Runtime code/API:** no production code or API contract changes.
- **Registry:** no aliases, definitions, units, bindings, or manifests change. Spanish labels must come from the current catalog instead of introducing new authority records.
- **Verification:** exercise upload/extraction/review, verification and acceptance, score readiness, repeated biomarker series, report source selection, and the known limitation that direction policy may return `not_available` when no tolerance is configured.
- **Safety:** all values, names, dates, laboratory metadata, and identifiers are synthetic and visibly labeled as such; the documents are not medical records or clinical advice.
