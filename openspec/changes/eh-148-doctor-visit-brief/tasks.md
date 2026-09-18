# Tasks: eh-148-doctor-visit-brief

Domain: **reports**

## 1. Contract and evidence projection

- [ ] 1.1 Add the versioned `DoctorVisitBrief` and `ReportEvidenceRef` schemas in `src/lib/report-contract.ts`, including claim status, source kinds, limitations, and the educational disclaimer.
- [ ] 1.2 Extend report context adapters so every observation, finding, clinical note, prescription, referral, and document summary retains its source row ID and document ID.
- [ ] 1.3 Add the server-owned evidence projection that creates opaque source IDs, display-safe snapshots, and `(report_id, source_id)` mappings to source kind/row/document identity without storage paths or profile IDs in public DTOs.
- [ ] 1.4 Preserve the exact resolved document UUID array for every new report and distinguish legacy null-scope/unversioned rows without fabricating evidence.
- [ ] 1.5 Add the `report_evidence_sources` migration and transactionally persist source-row mappings with the report; resolve citations through this mapping and cascade it on report deletion.

## 2. Generation and persistence

- [ ] 2.1 Update report prompts and parsing to accept only server-provided source IDs and typed claims, with deterministic rejection of unknown IDs and empty factual claims.
- [ ] 2.2 Integrate structural parsing and EH-150 validation into the service-only `createValidatedReport` transaction, including staged mapping/scope, validator status, and generated-at metadata; do not direct-insert before validation.
- [ ] 2.3 Keep the summary preview derived from validated overview content without a second model call.
- [ ] 2.4 Preserve existing abnormal-only and multi-source eligibility behavior while moving source identity through the contract.
- [ ] 2.5 Verify mapping, validation, and persistence failures roll back the candidate report and leave no readable unvalidated row.

## 3. Report detail surface

- [ ] 3.1 Replace free-form report rendering with typed Doctor Visit Brief sections, citations, limitations, and a source ledger.
- [ ] 3.2 Add a legacy presentation state that keeps old reports readable but disables source-grounded sharing/export until revalidation.
- [ ] 3.3 Ensure the detail surface never renders storage paths, uncited factual strings, diagnosis, treatment, or urgency directives as report facts.

## 4. Verification and handoff

- [ ] 4.1 Add focused verification for mixed source kinds, exact scope, unknown citation IDs, missing evidence, legacy rows, and educational safety wording.
- [ ] 4.2 Publish the contract interface and ownership handoff for EH-149, EH-150, EH-151, and EH-153 without allowing those changes to edit the contract module directly.
- [ ] 4.3 Run the EH-148 QA checklist and record developer evidence before calling the change complete.
