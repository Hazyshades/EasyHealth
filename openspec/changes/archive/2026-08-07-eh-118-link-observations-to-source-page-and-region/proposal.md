# Link observations to source page and region

## Why

EH-103 gave observations a place to record where they came from: `source_page`,
`source_text`, and `bounding_box`. Nothing fills the region and nothing renders
it. Today `bounding_box` is always null for laboratory rows, the extraction
model receives the whole document as one undifferentiated text blob so its
`source_page` is a guess defaulted to page 1, the observations API does not
return page provenance at all, and the viewer can only jump to a page and print
a text snippet.

That leaves review unverifiable. A reviewer confirming a value cannot see the
line it was read from, and a wrong page attribution is indistinguishable from a
right one. The stored `bounding_box` is also shapeless: any JSON object is
accepted, so a pixel-space or model-invented rectangle can be written, and
provenance is write-once, so a wrong rectangle is permanent.

## What Changes

- Add the normalized source-region contract as the single accepted
  `bounding_box` shape, validated identically in TypeScript and in the database.
- Extract the PDF page index with word geometry (poppler `-bbox-layout`) and
  write one page OCR artifact per page with normalized blocks, replacing the
  single page-1 artifact that carried no coordinates.
- Feed extraction explicit page markers so the model reads `source_page` off its
  input instead of guessing it.
- Add the OCR/LLM provenance adapter: ground each extracted row's `source_text`
  against the page index, correct the model's page hint when a unique match
  disagrees with it, and degrade to page-only provenance whenever the match is
  ambiguous, absent, or geometrically implausible.
- **BREAKING** Stop asking the extraction model for `bounding_box` on
  instrumental measures, and reject any stored region that fails the contract or
  disagrees with its row's `source_page`.
- **BREAKING** Require a source page on every observation created from a
  document extraction, and reject non-positive page indexes.
- Return `source_page`, `source_text`, and the validated region from the
  document and observations APIs.
- Render the source region as a highlight overlay on the page preview, with an
  explicit page-only state and an explicit "source page unavailable" state.
- Bump the observation provenance schema version to `2`.

## Capabilities

### New Capabilities

- None. EH-118 completes contracts that EH-103 introduced; it records its
  requirements as modifications of the existing change-local specifications.

### Modified Capabilities

- `extraction-provenance`: page index covers every page and carries normalized
  word geometry; extracted rows persist a grounded page and a contract-valid
  region or nothing.
- `observation-provenance-metadata`: every document-sourced observation links to
  a source page, and a stored region is valid and page-coherent by construction.
- `document-viewer`: the viewer highlights the source region on the page preview
  and states its fallback when no region exists.
- `document-extraction-review`: review rows expose their source page, region
  availability, and the quoted source text.

## Impact

- Affected domains: `documents` (extraction pipeline, viewer, review),
  `health-profile` (observation provenance reads).
- Affected code: `src/lib/documents/source-region.ts`,
  `src/lib/documents/pdf-text-layout.ts`,
  `src/lib/documents/source-region-match.ts`,
  `src/lib/documents/extraction.ts`,
  `src/lib/documents/instrumental-extraction.ts`,
  `src/lib/documents/instrumental-measure-lineage.ts`,
  `src/lib/documents/observation-normalization-writer.ts`,
  `src/lib/biomarkers/measurement-resolution.ts`, `worker/src/previews.ts`,
  `worker/src/pipeline.ts`, `src/app/api/documents/[id]/route.ts`,
  `src/app/api/documents/[id]/observations/route.ts`,
  `src/components/documents/document-viewer.tsx`,
  `src/components/documents/source-highlight-overlay.tsx`.
- Affected data and operations: migration
  `044_eh118_observation_source_region.sql` adds the region contract function
  and CHECK constraints on `observations`,
  `document_extracted_biomarkers`, and
  `document_extracted_instrumental_measures`, clears pre-contract regions, and
  requires a source page for document-sourced observations. Existing documents
  keep page-only provenance until they are reprocessed.
