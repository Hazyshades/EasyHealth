## 1. Read contract and data shape

- [x] 1.1 Define independent persisted-decision source, quality, persistence, and quality-code types.
- [x] 1.2 Define the complete active-revision read shape including trace, identity, and release metadata from Change A.
- [x] 1.3 Normalize Supabase relation cardinality and select exactly one active revision without current Resolver evaluation.
- [x] 1.4 Replace combined trace-availability semantics with source/quality fields across shared read types.

## 2. Persisted consistency evaluation

- [x] 2.1 Parse supported technical trace schemas and distinguish missing, invalid, and unsupported historical traces.
- [x] 2.2 Compare revision outcome and identity fields with operational resolver evidence and technical trace.
- [x] 2.3 Validate winning candidate, non-concrete outcomes, trace schema, input hash/version, release metadata, and source lineage.
- [x] 2.4 Emit stable conflict codes while preserving conflicting persisted values without repair or winner selection.
- [x] 2.5 Mark missing legacy evidence and unavailable current catalog enrichment as unavailable without live fallback.
- [x] 2.6 Keep current catalog lookups limited to historical enrichment and fail closed for consumers needing concrete binding.

## 3. Shared persisted-decision reader

- [x] 3.1 Implement the active persisted-decision reader over the complete revision and consistency contract.
- [x] 3.2 Implement the explicit no-active-revision preview branch with `source = preview` and `notPersisted = true`.
- [x] 3.3 Return `source = none` and `quality = unavailable` when neither persisted decision nor requested preview exists.
- [x] 3.4 Ensure an active revision always suppresses any supplied current preview.
- [x] 3.5 Preserve raw evidence and EH-164 text-marker semantics across available, unavailable, and conflict results.

## 4. Consumer cutover

- [x] 4.1 Cut normalization review to use persisted reads for active revisions and preview only for rows without an active revision.
- [x] 4.2 Cut incomplete-outcome serialization and Health Profile linked observations to the shared reader.
- [x] 4.3 Cut document biomarker details, reports, and structured context to the shared reader.
- [x] 4.4 Keep correction, acceptance, reprocessing, and explicit preview paths as separate prospective evaluation seams.
- [x] 4.5 Preserve candidate-key non-concreteness and fail-closed consumer eligibility for unavailable/conflicting reads.
- [x] 4.6 Update authenticated API and review UI payloads for independent source/quality and conflict details.
- [x] 4.7 Preserve profile ownership checks and trace allowlisting before returning technical read data.

## 5. Verification and documentation

- [x] 5.1 Add read fixtures for valid persisted, legacy unavailable, persisted conflict, catalog-unavailable, explicit preview, no-data, and incomplete outcomes.
- [x] 5.2 Verify that current Registry/Resolver changes do not alter active persisted outcome or trace presentation.
- [x] 5.3 Verify that all persisted consumers return the same source, quality, outcome, and conflict state for one revision.
- [x] 5.4 Verify EH-164 accepted text markers remain excluded from numeric score and trend contributions.
- [x] 5.5 Verify unauthorized and foreign-profile reads fail before revision or trace data is returned.
- [x] 5.6 Update affected canonical Registry/biomarker documentation and run generated documentation checks, Wiki staging, and tracking issue updates.
- [x] 5.7 Validate the completed OpenSpec change with strict validation and review the apply-ready task list.
