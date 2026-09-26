# Tasks: eh-148-doctor-visit-brief

Domain: **reports**

## 0. Prerequisite and lifecycle handoff

- [x] 0.1 Require `make-document-deletion-durable` to land first and expose the committed document tombstone, `write_generation`, report-invalidation, final-purge, and owner report-delete transitions; EH-148 consumes those boundaries and does not add a parallel document lifecycle or direct report-delete path.

## 1. Contract and evidence projection

- [x] 1.1 Add the versioned `DoctorVisitBrief` and `ReportEvidenceRef` schemas in `src/lib/report-contract.ts`, including the closed canonical section IDs/order, required/empty-state rules, claim status, question origin (`generated`/`user_selected`), bounded user-selected questions, source kinds, limitations, and the educational disclaimer.
- [x] 1.2 Extend `src/lib/reports.ts` and `src/lib/documents/structured-context.ts` so every observation, finding, clinical note, prescription, referral, and document summary retains its source row ID and document ID.
- [x] 1.3 Add the server-owned evidence projection that creates opaque source IDs, display-safe snapshots, and `(report_id, source_id)` mappings to source kind/row/document identity without storage paths or profile IDs in public DTOs.
- [ ] 1.4 Preserve the typed requested scope separately from the exact non-null actual `source_document_ids` set for every new report, capture each source document's `write_generation` before LLM work, and distinguish legacy null-scope/unversioned rows without fabricating evidence.
- [x] 1.5 Add the `report_evidence_sources` migration and transactionally persist source-row mappings with the report; resolve citations through this mapping and cascade it on report deletion.

## 2. Generation and persistence

- [x] 2.1 Update report prompts and parsing to accept server-provided source IDs, bounded normalized user-selected questions, the inclusive UTC `report_date_range`, only the closed `source_fact_snapshot`/`numeric_observation_snapshot` template parameters, and non-factual `clinician_question` items; deterministically reject model-authored factual text, unknown IDs/templates, empty factual claims, invalid question input, diagnosis/treatment/urgency fields, imperative text, and unsupported free-form factual prose.
- [ ] 2.2 Integrate structural parsing, EH-150 validation, the server-resolved inclusive UTC-calendar-date report range, and the optional `biomarker_dynamics_period` plus exact report-scope handoff to EH-149 into the service-only `createValidatedReport` transition; capture source generations before LLM work, accept only the server-generated frozen extension and validation envelope, then call the EH-148-owned `public.create_validated_report` RPC with service-generated content, normalized question claims, requested scope, exact actual source IDs/generations, filtered scope, source mappings, validator status/version/issue codes, and generated-at metadata.
- [ ] 2.3 Keep `summary_preview` derived from the persisted server-rendered `overview` field in the validated contract without a second model call.
- [ ] 2.4 Preserve existing abnormal-only and multi-source eligibility behavior while moving source identity through the contract.
- [ ] 2.5 Verify candidate validation failure, RPC rejection, mapping failure, persistence failure, tombstone race, and source `write_generation` drift roll back the transaction and leave no readable unvalidated or stale row.

## 3. Report detail surface

- [x] 3.1 Replace free-form report rendering with the canonical typed Doctor Visit Brief sections/order, explicit empty states, citations, limitations, a source ledger, and visibly distinct generated versus user-selected clinician questions.
- [x] 3.2 Add a legacy presentation state that keeps old reports readable but disables source-grounded sharing/export until revalidation.
- [x] 3.3 Ensure the detail surface never renders storage paths, uncited factual strings, diagnosis, treatment, urgency directives, or `removed` claims as report facts; render factual claims from the closed server templates, questions as questions, and validation issues as safe limitations.
- [x] 3.4 Implement the EH-148-owned `src/lib/report-read.ts` resolver with explicit `legacy` owner presentation versus new structured validation states; preserve limited snapshots only for archived/removed source rows under active documents, invalidate whole reports on document tombstone before reads, and require owner detail, EH-151 public report, and EH-153 export adapters to consume the resolver's archive/tombstone outcomes.

## 4. Verification and handoff

- [ ] 4.1 Add focused verification for mixed source kinds, canonical section order/unknown/missing/duplicate/empty states, inclusive UTC-calendar-date report range and explicit-scope conflicts including an end-of-day timestamp, bounded/invalid user questions, exact requested/actual scope, unknown citation/template IDs, unsafe model-authored factual text, validation-envelope status/version/issue-code cases, document-first durable tombstone/republish race fencing with `write_generation`, report-scope-constrained dynamics, missing evidence, archive/remove-after-publication, tombstoned-report invalidation, legacy rows, question rendering, and educational wording.
- [x] 4.2 Publish the contract interface and ownership handoff for EH-149, EH-150, EH-151, and EH-153 without allowing those changes to edit the contract module directly.
- [ ] 4.3 Run the EH-148 QA checklist and record developer evidence before calling the change complete.
