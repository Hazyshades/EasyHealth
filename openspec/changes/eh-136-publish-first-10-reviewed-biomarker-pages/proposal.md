## Why

EasyHealth currently exposes extracted laboratory values and assessment views, but it has no public, reviewed educational page for the ten measurements that anchor the current blood, metabolic, thyroid, liver, and kidney flows. Users need concise context that explains what a result represents without turning Registry metadata into a diagnosis, a universal range, or a treatment recommendation. This change delivers the first publishable Knowledge Base slice while keeping article content and review metadata independent from observation normalization and score logic.

## What Changes

- Add a version-controlled Knowledge Base content manifest for English biomarker articles, including stable slugs, content versions, publication/review state, reviewer metadata, source references, Registry 2.0 measurement-definition keys, and curated panel/related-measurement metadata.
- Publish ten reviewed biomarker pages for hemoglobin, hematocrit, WBC, platelets, MCV, glucose, HbA1c, TSH, ALT, and the combined creatinine/eGFR kidney view.
- Add one reusable public biomarker article template at `/knowledge/biomarkers/[slug]` with consistent sections for what the measurement represents, aliases, units, specimen, panel membership, related measurements, interpretation factors, sources, and a prominent educational disclaimer.
- Render Registry metadata from reviewed Registry 2.0 definitions and curated panels rather than duplicating runtime identity or assessment rules in article content.
- Keep a clearly separated “Your EasyHealth data” action linking to the authenticated Biomarkers surface; public article rendering must not read or expose another person’s observations.
- Add deterministic publication validation covering the ten-page roster, reviewed concrete definitions, source/review metadata, required sections, panel references, unique slugs, and prohibited diagnostic/prescriptive or universal-range claims.
- Do not change observations, resolver behavior, assessment bindings, Health Profile scoring, external reference-range data, or document-processing behavior.

## Capabilities

### New Capabilities

- `knowledge-base-biomarker-pages`: Versioned, reviewed, source-backed public biomarker articles rendered from a reusable template and linked to reviewed Registry 2.0 definitions.

### Modified Capabilities

- None. The new public educational surface is intentionally independent from the existing `health-profile` and Registry runtime requirements; `health-profile` is the target product domain for the linked measurement context, not a changed requirement set.
