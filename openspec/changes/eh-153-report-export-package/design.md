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

Implementation prerequisite: `make-document-deletion-durable` is a hard prerequisite. EH-153 consumes the committed tombstone/report-invalidation/final-purge and owner report-delete transitions through EH-148's `report-read.ts`; it never infers source deletion from missing rows or serializes a snapshot after the durable resolver returns generic unavailable.

## Decisions

### 1. Build one export input adapter

Add `src/lib/report-export/index.ts` with `getExportableReport(accessContext, format, input)` returning the already validated EH-148 report DTO, its complete report-scope source ledger, the internal validation envelope, and the persisted frozen EH-149 `BiomarkerDynamicsReport` extension selected by `src/lib/report-read.ts` for a report created with `biomarker_dynamics_period`. The resolver verifies every dynamics point/document mapping is in report scope and omits removed claims. Serializers project only the safe validation status/version and visible limitations; internal issue codes never enter any export bytes. The owner adapter loads the signed-in profile; the share adapter receives a verified EH-151 capability containing distinct `report_scope_document_ids`, optional `raw_document_download_ids`, and `allowed_export_formats`. Report serializers always use the complete report-scope ledger; the raw-document proxy uses only the child allow-list and is not a serializer input. The adapter rejects legacy/unvalidated or tampered validation envelopes, a missing required persisted dynamics extension, a source-unavailable read that cannot be represented safely, and any format not in the share allow-list. It accepts no client-supplied dynamics DTO or raw observation query.

Each serializer consumes only this adapter result:

- **JSON:** versioned machine-readable contract, safe validation projection `{ status, version }`, limitations, supported/limited claims, source snapshots, and the optional persisted dynamics DTO. Internal issue codes never serialize; removed claims are absent.
- **CSV:** a deterministic `record_type` ledger with `row_order` and section fields. Metadata rows carry generated-at, contract version, validator version, validation status, disclaimer, and limitations; claim rows carry section, server-rendered claim text/status, and citation IDs, omitting removed claims; source rows carry every report-ledger entry's source ID, kind, document ID, display-safe snapshot, and label; measurement rows carry values plus source ID, document ID, observed date, native value/unit/range, display value/unit, and conversion indicator from the persisted dynamics DTO. `row_order` emits metadata first, then claim/measurement rows in the EH-148 canonical section order `document_summary`, `latest_measurements`, `changes`, `clinician_questions`, `limitations`, `source_ledger`, then source rows in source-ledger order. Claims are not fabricated as measurements.
- **PDF:** the same EH-148 canonical section order `document_summary`, `latest_measurements`, `changes`, `clinician_questions`, `limitations`, `source_ledger`, followed by the optional dynamics extension, citation labels, source ledger, disclaimer, generated-at timestamp, and versions.

### 2. Use a pinned server-side PDF renderer

Use `@react-pdf/renderer` behind `src/lib/report-export/pdf.ts` with a committed, licensed Unicode font asset. The adapter is server-only and does not depend on browser print state. The implementation must smoke-test Cyrillic, accented Latin, long filenames, page breaks, and an empty optional section before release. If the renderer cannot load the font or produce a valid document, the endpoint fails rather than returning an incomplete PDF.

### 3. Keep export authorization separate from serialization

Authorization resolves the report, complete report scope, optional raw-document child IDs, and allowed export formats before serialization. An authenticated owner of a validated report is allowed PDF, CSV, and JSON; a shared export is allowed only when its format is in `allowed_export_formats`. The serializers never query Supabase or storage and cannot widen scope. `download_policy` `report` permits the shared report formats, `documents` additionally permits explicitly scoped raw documents, and `none` permits neither file export nor raw-document download. The public share export route applies EH-151's `applyPublicShareResponsePolicy` helper to every permitted PDF, CSV, and JSON response before returning bytes.

### 4. Add controls through a leaf component

Create `src/components/report-export-actions.tsx` for format selection, pending state, and error messaging. EH-148 wires it into the authenticated report detail page; EH-151 wires it into the public share page through its named integration slot. EH-153 supplies the component and props contract but does not edit either page or route authorization.

## Risks / Trade-offs

- PDF rendering increases bundle size and server CPU. Keep the renderer server-only and enforce bounded report size before rendering.
- A CSV can preserve the complete report contract only through typed metadata, claim, source, and measurement rows; consumers must treat `record_type` and `row_order` as part of the format rather than assuming every row is a measurement.
- Unicode font licensing and loading are release risks. The font asset and license evidence are part of the EH-153 checklist.
- Exported files are copies outside application control. The UI states the same educational disclaimer and source limitations; EH-154 verifies download policy and no-store headers.
