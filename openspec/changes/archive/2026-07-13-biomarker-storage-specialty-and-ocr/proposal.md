## Why

After catalog/units work, four storage and specialty gaps remain: qualitative urinalysis is dropped (numeric-only), hormones/tumor/acute markers are uncataloged or risk being scored like wellness labs, `(profile_id, biomarker_key, observed_at)` collapses serum vs urine and free vs total on the same day, and OCR provenance already half-exists on extract rows but does not fully flow into accepted observations or a clear raw-OCR contract. This change closes those gaps so ordinary urine strips, specialty panels, and multi-specimen days store correctly without polluting body-map wellness scores.

## What Changes

- **Qualitative / semi-quantitative observations:** store non-numeric lab results (`Negative`, `Trace`, `1+`, `Positive`, free text) with optional ordinal rank; accept them from extraction; show on biomarkers/UI; **never** include in body-map state score.
- **Specialty marker catalog (hormones, tumor, coag, cardiac acute, autoimmune):** first-class catalog keys + aliases with `scoreRole: display` (or specialty-only); body map stays free of wellness “green/red” for these; reports MAY reference them factually.
- **Observation identity (BREAKING for upserts):** extend uniqueness with `specimen` and `modifier` (and keep document-aware behavior where needed) so serum creatinine ≠ urine creatinine same day, free T4 ≠ total T4 collisions stop, dual variants can coexist.
- **Raw OCR / extraction provenance schema:** normalize and complete provenance fields on extract + observation paths (page, snippet, bbox, raw name/value/unit, alternate reported value, confidence, method); document required OCR artifact shape; ensure qualitative `value_text` is first-class on both extract and accepted rows.
- Depends on foundations from `biomarker-catalog-and-units` (canonical keys, score roles). Prefer implement catalog/units first; this change assumes those APIs or ships thin compat shims if ordered otherwise.

**Explicit non-goal:** body-map health scoring of hormones, PSA/tumor markers, troponin, D-dimer, or qualitative urine as equal-weight wellness scores.

## Capabilities

### New Capabilities

- `qualitative-observations`: Non-numeric and ordinal lab results storage, acceptance, and display (urine dipstick and similar).
- `specialty-biomarker-catalog`: Hormones, tumor markers, coagulation, acute cardiac, autoimmune markers as display-only catalog entries with aliases and report visibility rules.
- `observation-identity`: Specimen/modifier dimensions and expanded uniqueness for observations.
- `extraction-provenance`: Raw OCR / extraction provenance schema and end-to-end flow into review and accepted observations.

### Modified Capabilities

- `document-extraction-review`: Review UI/API must surface and allow accept of qualitative rows and provenance fields.
- `document-processing`: Extraction prompts/pipeline capture qualitative values and richer provenance; do not drop non-numeric lab lines by default.
- `biomarkers-overview`: Show qualitative results and specimen/modifier when present.
- `health-profile`: Specialty and qualitative markers must not drive organ state scores; may appear only under General/display rules if shown at all.
- `health-profile-api`: Payload supports non-numeric observations and identity fields without scoring them as core.
- `biomarker-catalog` (from sibling change, if present as main spec later): extend with specialty/qualitative definitions — delta also defined here for forward merge.

## Impact

- **Domains:** documents (extraction, review, acceptance), health-profile (observations model, scoring exclusions), reports (optional factual use of specialty markers).
- **Schema:** `observations` columns (`value_text`, `value_kind`, `ordinal`, `specimen`, `modifier`, provenance fields); unique constraint migration; possibly tighten `document_extracted_biomarkers` required provenance.
- **Code:** acceptance path (today drops null numeric), parseLabNumber/skip qualitative, extraction instructions, biomarkers UI, health-systems scoring filters.
- **Risk:** unique constraint migration needs careful backfill of specimen/modifier defaults for existing rows.
- **Related change:** `biomarker-catalog-and-units` (catalog, aliases, units, Layer-1 quant panels).
