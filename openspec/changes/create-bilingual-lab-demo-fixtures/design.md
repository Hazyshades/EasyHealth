# Design

## Context

See `proposal.md` for the motivation and corpus scope. The implementation must fit the existing `documents` extraction contract rather than inventing a second laboratory format.

The extraction pipeline treats `raw_name` as the verbatim printed label and relies on row-local evidence for value text, unit, reference range, source page, source text, section context, specimen, modifier, method, and collection date. A row date is used as the observation date when it is present. Repeated biomarker series group only compatible resolved observations with the same measurement definition and compatible specimen, modifier, method, scale, and units. Health Profile readiness additionally requires numeric core markers and at least one document-native numeric reference bound.

The repository already has `@react-pdf/renderer` and a committed DejaVu Sans font used by the server-side report exporter. The existing `lab_data/chile/original.pdf` is untracked and its text extraction is incomplete, so it is treated as a user-owned artifact until explicitly inspected.

## Goals / Non-Goals

**Goals:**

- Produce eight deterministic, text-native A4 PDFs from one semantic fixture dataset.
- Keep the multi-date and single-date documents semantically equivalent for the same date rows.
- Exercise Registry-supported English labels and current reviewed Spanish aliases without changing Registry authority.
- Include enough complete numeric evidence to exercise score readiness for all scoreable systems, plus panel and trend extensions.
- Make source dates, raw labels, units, reference intervals, specimen, method, modifiers, sections, and page-local text unambiguous to extraction.
- Make generation repeatable and safe around the existing untracked `original.pdf`.

**Non-Goals:**

- No production upload, extraction, resolver, observation, scoring, dynamics, or report code changes.
- No new biomarker definitions, aliases, units, assessment bindings, manifests, or migration data.
- No use of real patient, clinician, laboratory, address, license, signature, certificate, or insurance data.
- No clinical interpretation, diagnosis, treatment recommendation, or claim that a value is medically normal outside the printed synthetic reference interval.
- No image-only scan simulation. The files must remain machine-readable fixtures.

## Decisions

### 1. Use one canonical semantic fixture manifest

Create a checked-in fixture source, for example `scripts/fixtures/bilingual-lab-demo-fixtures.ts`, containing:

- the three canonical collection dates: `2026-08-01`, `2026-09-15`, and `2026-11-01`;
- one stable row identity per measurement definition;
- English and Spanish printed labels;
- the Registry measurement-definition key used for verification only;
- numeric values and printed reference bounds for each applicable date;
- native units, explicit specimen, method, modifier, panel section, and score/trend intent;
- synthetic laboratory and patient metadata.

The manifest is the source of truth. The generator derives the one multi-date document and the six single-date language documents from it. This prevents the English and Spanish files or the alternate upload strategies from drifting. A hand-edited set of eight PDFs was rejected because it would not provide a reproducible way to prove that repeated rows retain the same semantic axes.

The score-critical coverage must include the current readiness alternatives: LDL or non-HDL cholesterol, HDL, triglycerides, fasting glucose or HbA1c, TSH, free T4, ALT, AST, ALP, bilirubin, albumin, eGFR or creatinine, UACR, hemoglobin or hematocrit, WBC, platelets, MCV, vitamin D, B12, and folate. Include both useful alternatives where practical, plus total cholesterol, GGT, kidney electrolytes, CBC indices/differential, iron studies, and CRP as display/context rows.

### 2. Generate a fixed output matrix with a guarded overwrite policy

Add a dedicated generator such as `scripts/generate-bilingual-lab-demo-fixtures.tsx` and a package command such as `generate:lab-demo-fixtures`. The generator writes:

```text
lab_data/chile/original.pdf
lab_data/chile/baseline-es-2026-08-01.pdf
lab_data/chile/follow-up-es-2026-09-15.pdf
lab_data/chile/follow-up-es-2026-11-01.pdf
lab_data/chile/en/original.pdf
lab_data/chile/en/baseline-en-2026-08-01.pdf
lab_data/chile/en/follow-up-en-2026-09-15.pdf
lab_data/chile/en/follow-up-en-2026-11-01.pdf
```

Generation must stage outputs first, verify them, and then publish them to the target paths. If `lab_data/chile/original.pdf` already exists, the default command must fail with an actionable message instead of overwriting it. A separate explicit replacement mode may be used only after the existing file is confirmed to be the intended synthetic Spanish multi-date fixture. Other generated files may be replaced only when their expected synthetic marker and generator metadata match.

### 3. Use the existing server-side PDF renderer and font

Render with `@react-pdf/renderer`, following the existing server-side font registration and valid `%PDF-` checks in `src/lib/report-export/pdf.tsx`. Use the committed DejaVu Sans asset so accented Spanish text remains embedded and selectable. Do not add a browser, network service, or new PDF dependency for this corpus.

The document component should use A4 pages with:

- a laboratory-style header and patient/specimen metadata block;
- a visible bilingual synthetic-data banner on every page;
- repeated table headers and explicit panel headings;
- columns for test, result, unit, reference interval, specimen, method, modifier, and collection date where the document contains multiple dates;
- page numbers and a footer stating that the document is not a medical record or clinical advice;
- stable typography and page breaks that do not split a row.

The Spanish document must print Spanish labels as `raw_name`; the English document must print English labels. Do not generate Spanish by translating an already-rendered English PDF, because extraction must observe the actual printed source language.

### 4. Treat Registry aliases as input constraints, not generated behavior

Before rendering Spanish labels, resolve each proposed label against the current catalog and record the accepted alias or canonical label in the fixture manifest. Prefer exact reviewed aliases. If no reviewed Spanish label is available for a required row, use the canonical English label in the Spanish document rather than adding an unreviewed alias or a free translation that could produce an unintended `partial`, `ambiguous`, or `unmapped` outcome.

Every printed row must explicitly state the specimen and method when those axes are needed for reviewed compatibility. `source_text` must be able to recover the label, result, unit, and the relevant specimen/method context from the page. All score-critical values must be numeric, non-censored, dated, and paired with at least one numeric document-native reference bound.

### 5. Make historical rows intentionally compatible

For the repeated history set, keep the measurement definition, raw label, unit dimension, specimen, modifier, method, scale, and reference-range format stable across all three dates. Use deterministic changes for at least LDL cholesterol, HbA1c, ALT, creatinine, hemoglobin, and vitamin D. The single-date files must contain the exact corresponding row for their date, while `original.pdf` contains all three rows with explicit per-row dates.

Do not use comparator values such as `< 0.20` for score-critical or trend-critical rows. Keep qualitative/context rows separate from the numeric score corpus. Do not place dates only in a report header when a table contains multiple dates; each affected row must carry its collection date.

### 6. Verify through the real consumer path

Verification must use both artifact checks and the product path:

1. Run the generator twice in a clean staging directory and confirm stable output metadata/content hashes.
2. Confirm exactly eight expected PDFs exist, each begins with a valid PDF signature, contains the synthetic marker, and has the expected language/date/file mapping.
3. Upload at least the Spanish multi-date file and one English single-date file through the application. Confirm extraction preserves raw labels, dates, numeric values, units, reference ranges, and stated axes.
4. Accept and verify the resolved rows. Confirm incomplete or unsupported rows, if any, remain excluded rather than being forced into a concrete identity.
5. Confirm Health Profile readiness has numeric score inputs only where every required group has a usable numeric marker and document-native reference bound.
6. Upload the three single-date files, verify the repeated rows, and confirm the Biomarkers history surface produces compatible series with source filenames and dates retained.
7. Create a report using the three documents and a dynamics period covering all dates. Confirm the source ledger and dynamics points cite the uploaded documents. Record `not_available` direction as an allowed limitation if the current direction policy has no tolerance for the selected definition.
8. Run repository formatting/type checks and any existing document/biomarker fixture verification commands required by the implementation.

## Risks / Trade-offs

- **[PDF renderer compatibility]** `@react-pdf/renderer` has had runtime and font-resolution failures in this repository. Use the existing renderer boundary and font, run a real render smoke test, and fail before publishing partial output.
- **[Alias drift]** A future Registry catalog may retire or reclassify a Spanish alias. Resolve labels during generation and report the exact unresolved label instead of silently changing the printed source.
- **[Existing user artifact]** `lab_data/chile/original.pdf` is already untracked. Default generation must refuse to overwrite it; replacement requires an explicit, reviewed action.
- **[Realistic appearance versus safety]** More realistic metadata can be mistaken for a real medical record. Use a prominent synthetic banner, fictional identifiers, no real institution, and no clinical interpretation on every page.
- **[Pagination and extraction]** Dense tables can split headings or lose row context. Keep row-level dates and provenance fields in the same table row, use repeated headers, and visually inspect every generated page.
- **[Direction semantics]** Numeric movement is not a clinical improvement claim, and the current tolerance policy may return `not_available`. Preserve the application disclaimer and record the observed limitation rather than modifying production policy for the fixture.

## Migration Plan

No database migration or production deployment is required. Implementation should:

1. Add the manifest and generator tooling.
2. Render to a temporary staging directory.
3. Run deterministic artifact and extraction smoke checks.
4. Publish only verified PDFs to `lab_data/chile/`.
5. Leave the pre-existing `original.pdf` untouched unless explicit replacement is approved.
6. Roll back by removing only newly generated fixture outputs and generator tooling; do not delete or rewrite unrelated `lab_data` assets.

## Open Questions

None. The existing `original.pdf` is handled as a guarded pre-existing artifact rather than an unresolved design decision.
