## Why

EasyHealth’s lab pipeline is English-first in practice: identifier normalization strips non-Latin characters, many Cyrillic aliases collapse to empty tokens, “RU” corpus fixtures often carry English labels, and extraction may treat LLM English keys as authoritative. Users already upload Russian (and will upload Spanish) lab reports; without a locale-aware label contract, genuine non-English rows stay unmapped or match unsafely while aggregate EN metrics hide the failure. We need a data-pipeline-only EN+RU+ES foundation before UI localization.

## What Changes

- Introduce a dedicated **measurement-label normalization** contract (`normalizeMeasurementLabel`) separate from identifier `snakeCaseToken`; Unicode-aware, locale-safe for Cyrillic and Spanish diacritics, with collision and empty-token gates.
- Require every resolver-admitted alias to carry an explicit **locale** (`en` | `ru` | `es`); support full names, abbreviations, mixed “local name (CODE)” forms, real lab wording, and safe OCR variants. Laboratory scope only when wording is genuinely lab-specific.
- Fix extraction so **verbatim source labels and qualitative values are authoritative evidence**; LLM canonical English keys/names are soft assists only and cannot alone produce `resolved`.
- Ensure the review surface (English UI shell unchanged) shows **original label + canonical English measurement + original value/unit/reference range**.
- Add **genuine RU and ES corpus fixtures** (pure Cyrillic, diacritics, mixed forms, OCR noise, unknowns, ambiguities) and **language-segmented release gates** so one language cannot mask another.
- Roll out reviewed EN/RU/ES alias coverage for a defined **first launch slice** (CBC, basic metabolic/biochemistry, lipids, thyroid, common liver/kidney, glucose/HbA1c, launch qualitative tests); architecture must extend to the full catalog later.
- Preserve unknown rows as raw `unmapped` / `needs_review` evidence; **do not auto-create** catalog measurement definitions from uploads.
- Audit all affected read/write paths, alias backfill/migration validation, collision policy, resolver precedence, and regression gates **before** implementation cutover.
- **Non-goals / out of scope:** UI i18n, translated system messages, locale switcher, full interface translation, automatic catalog expansion from patient documents.

## Capabilities

### New Capabilities

- `multilingual-measurement-labels`: Unicode label normalization, locale metadata, accent-fold fallback policy for ES, empty/weak-token rejection, and collision detection across measurement definitions.
- `multilingual-lab-release-gates`: Genuine EN/RU/ES fixture authenticity rules and per-language segmented corpus metrics/thresholds for Registry 2.0 candidate release.

### Modified Capabilities

- `measurement-alias-authority`: Locale required on aliases; normalized form produced by `normalizeMeasurementLabel`; ban empty/weak normalized aliases; language authenticity for fixture-owned aliases.
- `context-aware-measurement-resolution`: Authoritative matching uses original label + reviewed aliases; LLM-proposed keys are non-authoritative soft assists; unknown stays `unmapped`.
- `document-processing`: Extraction preserves verbatim labels and qualitative values; does not treat English canonicalization as the sole identity.
- `document-extraction-review`: Review rows expose original label, canonical English measurement (when known), and original value/unit/reference range; English chrome only.
- `qualitative-observations`: Original qualitative text preserved; normalized Positive/Negative (etc.) stored separately and locale-aware where needed.
- `registry-release-corpus-governance`: Required language coverage becomes real EN+RU+ES text; reports and thresholds segmented by language.
- `biomarker-catalog`: First-slice measurements MUST have genuine reviewed EN, RU, and ES alias coverage; mechanism reusable for later catalog expansion.
- `incomplete-laboratory-outcomes`: Incomplete/unmapped explanations remain English product copy but must not imply missing source text when the original non-English label was preserved.

## Impact

- **Domains:** `documents` (extraction worker, review DTO/UI fields), `health-profile` / Registry 2.0 (aliases, resolver, catalog, corpus, release gates).
- **Code (expected touch points, not implementation yet):**
  - `src/lib/biomarkers/normalize.ts` (new label normalizer; keep `snakeCaseToken` for identifiers)
  - `src/lib/biomarkers/types.ts`, `measurement-resolution.ts`, alias admission/validation
  - `src/lib/biomarkers/catalog/**` and Registry 2.0 definition/alias seeds
  - `src/lib/documents/extraction.ts`, worker pipeline insert path
  - `src/lib/documents/observation-normalization-writer.ts`, review workspace/DTOs
  - `src/lib/biomarkers/qualitative.ts` (verbatim + normalized qualitative)
  - `registry/candidate-release/**`, launch fixtures, gate scripts
  - Review UI components that render biomarker rows (display-only fields; no locale switch)
- **Data / migration:** Existing aliases must be re-normalized and validated; empty/colliding/weak RU strings currently in catalog must fail build or be repaired; no automatic patient-data rewrite of raw extraction evidence; reprocess MAY improve mapping later under existing revision rules.
- **Safety:** No auto-catalog growth; no auto-accept of ambiguous/unmapped; EN regression must remain green; language gates independent.
- **Product UI:** English shell stays; users still see English guidance, plus preserved original lab text and English canonical names when resolved.
