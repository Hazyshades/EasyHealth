# Tasks: eh-148-doctor-visit-brief

Domain: **reports**

## 1. Contract and evidence projection

- [ ] 1.1 Add the versioned `DoctorVisitBrief` and `ReportEvidenceRef` schemas in `src/lib/report-contract.ts`, including claim status, source kinds, limitations, and the educational disclaimer.
- [ ] 1.2 Extend `src/lib/reports.ts` and `src/lib/documents/structured-context.ts` so every observation, finding, clinical note, prescription, referral, and document summary retains its source row ID and document ID.
- [ ] 1.3 Add the server-owned evidence projection that creates opaque source IDs, display-safe snapshots, and `(report_id, source_id)` mappings to source kind/row/document identity without storage paths or profile IDs in public DTOs.
- [ ] 1.4 Preserve the exact resolved document UUID array for every new report and distinguish legacy null-scope/unversioned rows without fabricating evidence.
- [ ] 1.5 Add the `report_evidence_sources` migration and transactionally persist source-row mappings with the report; resolve citations through this mapping and cascade it on report deletion.

## 2. Generation and persistence

- [ ] 2.1 Update report prompts and parsing to accept server-provided source IDs, only the closed `source_fact_snapshot`/`numeric_observation_snapshot` template parameters, and non-factual `clinician_question` items; deterministically reject model-authored factual text, unknown IDs/templates, empty factual claims, diagnosis/treatment/urgency fields, imperative text, and unsupported free-form factual prose.
- [ ] 2.2 Integrate structural parsing, EH-150 validation, and the optional `biomarker_dynamics_period` plus exact report-scope handoff to EH-149 into the service-only `createValidatedReport` transition; accept only the server-generated frozen extension and validation envelope, then call the EH-148-owned `public.create_validated_report` RPC with service-generated content, scope, source mappings, validator status/version/issue codes, and generated-at metadata.
- [ ] 2.3 Keep `summary_preview` derived from the persisted server-rendered `overview` field in the validated contract without a second model call.
- [ ] 2.4 Preserve existing abnormal-only and multi-source eligibility behavior while moving source identity through the contract.
- [ ] 2.5 Verify candidate validation failure, RPC rejection, mapping failure, and persistence failure roll back the transaction and leave no readable unvalidated row.

## 3. Report detail surface

- [ ] 3.1 Replace free-form report rendering with typed Doctor Visit Brief sections, citations, limitations, and a source ledger.
- [ ] 3.2 Add a legacy presentation state that keeps old reports readable but disables source-grounded sharing/export until revalidation.
- [ ] 3.3 Ensure the detail surface never renders storage paths, uncited factual strings, diagnosis, treatment, urgency directives, or `removed` claims as report facts; render factual claims from the closed server templates, questions as questions, and validation issues as safe limitations.
- [ ] 3.4 Implement the EH-148-owned `src/lib/report-read.ts` resolver with explicit `legacy` owner presentation versus new structured validation states; require owner detail, EH-151 public report, and EH-153 export adapters to consume its archive/delete-after-publication limitations and fail-closed legacy/invalid results.

## 4. Verification and handoff

- [ ] 4.1 Add focused verification for mixed source kinds, exact scope, unknown citation/template IDs, unsafe model-authored factual text, validation-envelope status/version/issue-code cases, report-scope-constrained dynamics, missing evidence, archive/delete-after-publication, legacy rows, and educational wording.
- [ ] 4.2 Publish the contract interface and ownership handoff for EH-149, EH-150, EH-151, and EH-153 without allowing those changes to edit the contract module directly.
- [ ] 4.3 Run the EH-148 QA checklist and record developer evidence before calling the change complete.
