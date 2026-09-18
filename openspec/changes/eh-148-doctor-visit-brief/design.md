# Design: eh-148-doctor-visit-brief

## Context

`reports.content` currently stores free-form doctor-summary sections. The generator receives structured rows, but `src/lib/reports.ts` projects most source identity down to a filename and the API persists `document_ids = null` when all eligible documents are selected. The detail page therefore cannot distinguish an evidence-backed claim from generated prose, and later sharing/export cannot enforce the original scope.

The change is the shared seam for EH-149, EH-150, EH-151, and EH-153. It must be small enough for callers to consume without duplicating report parsing or source authorization.

## Goals / Non-Goals

**Goals:**

- Define one versioned report/evidence DTO for generation, validation, rendering, sharing, and export.
- Preserve profile-scoped source identity and an immutable generation scope for every new report.
- Make factual claims carry stable evidence references and make missing evidence visible as a limitation.
- Keep the Doctor Visit Brief concise, educational, and free of diagnosis or treatment instructions.
- Make legacy reports readable without pretending that legacy filenames are citations.

**Non-Goals:**

- Clinical correctness, diagnosis, treatment selection, or a new medical triage policy.
- Share-token implementation, citation validation policy, biomarker dynamics calculations, or export rendering; those are separate changes.
- Reprocessing old reports or backfilling evidence that was not persisted.

## Decisions

### 1. Use a versioned deep report contract

Add `src/lib/report-contract.ts` as the only public boundary for report content. The contract contains:

- `schema_version` and `report_kind`.
- `generated_at`, `detail_level`, and the materialized `source_document_ids` represented by the existing `reports.document_ids` column for new rows.
- `sections` containing typed items rather than arrays of unqualified strings.
- `claims`, each with `id`, `section`, `text`, `factual`, `citations[]`, and `status` (`supported`, `limited`, or `removed`).
- `sources[]`, each with an internal `source_id`, `kind`, `document_id`, observed/recorded date when available, and a display-safe snapshot of the value, unit, range, or text.
- `limitations[]` and the mandatory educational disclaimer.

A `ReportEvidenceRef` points only to a `source_id` in the same payload and carries the document UUID needed for scope checks. It never contains a storage path or an authorization decision. The public DTO omits profile IDs and bearer credentials. Each persisted report also has server-only `report_evidence_sources` rows keyed by `(report_id, source_id)` and mapping to `source_kind`, `source_row_id`, and `document_id`; EH-150 resolves citations through that mapping rather than treating a snapshot as row identity.

The source kinds are `observation`, `finding`, `clinical_note`, `prescription`, `referral`, and `document_summary`. The schema permits non-factual patient questions without a citation, but a factual claim cannot be `supported` with an empty citation list.

### 2. Materialize scope at generation time

`POST /api/reports` resolves eligible documents once, applies the requested selection, and delegates to the service-only `createValidatedReport` transition. The service runs EH-150's pure validator against the server-authorized source catalog and immutable document scope, then calls the EH-148-owned `public.create_validated_report` RPC defined in the report-persistence migration. The RPC accepts only service-generated content, scope, source mappings, validator version, and validator status; it rechecks profile ownership, source-row identity, document scope, and claim/source relationships under `SECURITY DEFINER`, then inserts the report, exact UUID array, validator metadata, and `report_evidence_sources` in one database transaction. Any parse, validation, RPC, mapping, or persistence failure rolls back; no unvalidated report becomes readable, shareable, or exportable.

The migration revokes `EXECUTE` on `public.create_validated_report` from `anon`, `authenticated`, and `public`, and grants it only to the service role. The RPC never trusts a client-supplied profile or scope without re-resolving ownership and source identity inside the function.

The persisted JSON contains the source snapshots used to render the report. The `report_evidence_sources` rows are written in the same transaction as the report, cascade with report deletion, and are not exposed in public DTOs. A later archive or deletion can disable a live source link without changing the historical text already shown. No source snapshot is used to authorize a new document download.

The `public.create_validated_report` RPC is the only writer for a new structured report and its evidence mapping. The route never performs a direct report insert followed by a separate validator or mapping write.

### 3. Keep source projection server-owned

Extend `src/lib/reports.ts` and its typed context adapters so each observation, finding, note, prescription, referral, and document summary retains its database ID and document ID. `src/lib/report-evidence.ts` converts those rows into the contract's source catalog. The LLM receives the source catalog with opaque source IDs; it may cite only those IDs. Filenames remain display labels, never citation identity.

The parser rejects unknown source IDs and malformed claim objects before persistence. EH-150 supplies the reusable full validator; EH-148 keeps the structural parser and contract version check at the generation boundary.

### 4. Render a source ledger, not inline citation prose

`ReportBody` renders typed sections and a source ledger grouped by document. Each claim shows its citation labels and can reveal the date/value/range snapshot. A missing or limited claim shows the associated limitation. The UI does not create links from a filename alone and does not expose raw storage paths.

### 5. Keep the generator deterministic at the boundary

The prompt asks for JSON claims with source IDs, but the server owns normalization: duplicate source references are collapsed, unknown IDs are rejected, empty factual claims are marked limited, and the disclaimer is injected by code. The generator cannot add a new source, widen scope, or write a diagnosis field. Generated patient questions are framed as questions for a clinician and do not contain treatment directions.

### 6. Ownership and handoffs

The file-level ownership matrix is recorded in `ownership.md` in this change. EH-148 owns `report-contract.ts`, source projection, report persistence and detail integration. EH-150 owns the validator module and returns a stable validation result; EH-148 owns the generation-route integration point. EH-149 owns biomarker dynamics projection, EH-151 owns public share verification, EH-152 owns share management UI, and EH-153 owns export adapters. No parallel branch edits another branch's owner files; cross-cutting changes are handed off through the contract.

## Risks / Trade-offs

- Persisted source snapshots increase report size. This is accepted because the snapshot is required for reproducible rendering and export; raw file bytes are never copied.
- Legacy rows cannot gain trustworthy citations without re-generation. They remain visible but are deliberately excluded from sharing/export rather than receiving guessed references.
- A citation proves source linkage, not clinical truth. The UI and disclaimer must state that limitation; EH-150 must not be described as a medical fact checker.
- Archiving a source after generation can make a source link unavailable while the report snapshot remains visible. The UI must show that limitation and deny any unauthorized storage access.
