## 1. Health Profile assessment eligibility

- [x] 1.1 Add the pure fail-closed assessment eligibility predicate, stable exclusion codes, and user-safe labels.
- [x] 1.2 Route shared laboratory outcome serialization and Health Profile input projection through the predicate.
- [x] 1.3 Select source reference provenance in assessment snapshots and expose strict eligibility plus reason from the Biomarkers API.

## 2. Biomarkers presentation and durable recalculation

- [x] 2.1 Render assessment-specific exclusion guidance in the Biomarkers table while preserving raw result visibility.
- [x] 2.2 Add the EH-142 migration that requeues affected Health Profile calculations, preserves in-flight jobs, and marks synthesis stale.

## 3. Regression and QA evidence

- [x] 3.1 Add focused EH-142 TypeScript regression coverage and its package script for every eligibility gate and safe label.
- [x] 3.2 Add a disposable EH-142 database migration-contract test and package script.
- [x] 3.3 Create the tester-facing `QA/eh-142/checklist.md` with developer-only evidence for the migration and automated checks.

## 4. Registry documentation synchronization

- [x] 4.1 Regenerate and verify canonical biomarker documentation, render and review the Wiki staging output, and publish or record its explicit pending blocker.
- [x] 4.2 Update issue #42 as the single Registry documentation tracking record with canonical docs, Wiki status, commands, evidence, and remaining gaps.

## 5. Final validation

- [x] 5.1 Run targeted TypeScript, database, type, documentation, and strict OpenSpec validation; record any unavailable-environment evidence in QA.
