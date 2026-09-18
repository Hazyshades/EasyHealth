# Design: eh-153-report-export-package

## Context

The report detail page renders free-form strings and has no export boundary. EH-148 introduces a versioned report/evidence DTO and EH-150 defines the publish gate; every format must serialize that same validated object and preserve the same scope.

## Goals / Non-Goals

**Goals:**

- Produce deterministic PDF, CSV, and JSON exports from validated report content.
- Preserve report sections, limitations, source references, generation time, contract version, validator version, units, and reference ranges.
- Apply owner-session authorization or the exact EH-151 share scope to every format.
- Keep Unicode names, values, dates, and source labels readable.

**Non-Goals:**

- A second report schema, a new LLM call, or a raw database dump.
- Exporting unrelated documents, storage paths, bearer tokens, PINs, or hidden profile metadata.
- Editing the report or changing clinical meaning during serialization.

## Decisions

### 1. Build one export input adapter

Add `src/lib/report-export/index.ts` with `getExportableReport(accessContext, format)` returning the already validated report DTO plus a scope-limited source ledger. The owner adapter loads the signed-in profile; the share adapter receives a verified EH-151 capability and its allowed resource set. The adapter rejects legacy/unvalidated content and reports a stable error code.

Each serializer consumes only this adapter result:

- **JSON:** versioned machine-readable contract, validation metadata, limitations, claims, and source snapshots.
- **CSV:** one row per numeric/qualitative measurement point plus source ID, document ID, observed date, native value/unit/range, display value/unit, and conversion indicator. Non-measurement claims remain in the JSON/PDF formats.
- **PDF:** the same ordered sections, citation labels, source ledger, limitations, disclaimer, generated-at timestamp, and versions.

### 2. Use a pinned server-side PDF renderer

Use `@react-pdf/renderer` behind `src/lib/report-export/pdf.ts` with a committed, licensed Unicode font asset. The adapter is server-only and does not depend on browser print state. The implementation must smoke-test Cyrillic, accented Latin, long filenames, page breaks, and an empty optional section before release. If the renderer cannot load the font or produce a valid document, the endpoint fails rather than returning an incomplete PDF.

### 3. Keep export authorization separate from serialization

Authorization resolves the report and allowed document IDs before serialization. The serializers never query Supabase or storage and cannot widen scope. Shared exports permit only formats enabled by the share's download policy; report JSON/PDF may be allowed while raw document downloads remain denied.

### 4. Add controls through a leaf component

Create `src/components/report-export-actions.tsx` for format selection, pending state, and error messaging. EH-148 owns the report detail page integration point; EH-153 does not rewrite report content rendering or route authorization.

## Risks / Trade-offs

- PDF rendering increases bundle size and server CPU. Keep the renderer server-only and enforce bounded report size before rendering.
- A CSV cannot express every narrative claim. It is explicitly a measurement ledger; JSON/PDF remain the complete report formats.
- Unicode font licensing and loading are release risks. The font asset and license evidence are part of the EH-153 checklist.
- Exported files are copies outside application control. The UI states the same educational disclaimer and source limitations; EH-154 verifies download policy and no-store headers.
