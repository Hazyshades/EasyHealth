## 1. QA Preparation

- [x] 1.1 Create `QA/eh-124/checklist.md` from the roadmap checklist template with the EH-124 scope, safe preconditions, result fields, and an explicit unexecuted/blocked evidence policy.
- [x] 1.2 Record the supported browser and screen-reader baseline, authenticated test environment, dedicated test account, and synthetic/de-identified fixture inventory.
- [x] 1.3 Reuse the EH-118 PDF, page-only scan/image, instrumental, and reprocess fixtures; add only safe fixtures needed for long evidence, absent ranges, and recovery states.
- [x] 1.4 Document unavailable EH-120 verification, rejection, supersession, and batch controls as dependency-blocked cases without inventing UI actions.

## 2. Execute Review Workflow QA

- [ ] 2.1 Execute the source-document matrix: multi-page text-layer PDF highlighting, zoom/page navigation, page-only/document-only degradation, image fallback, instrumental findings, and reprocessing of an older document.
- [ ] 2.2 Execute keyboard-only checks for navigation, zoom, page groups, row activation, selection, technical details, correction/undo when exposed, history, acceptance/confirmation, and recovery controls.
- [ ] 2.3 Execute screen-reader checks for control names, focus order, source/page announcements, recovery and error announcements, correction errors, and history disclosure; record the exact assistive-technology environment.
- [ ] 2.4 Execute responsive long-evidence and absent-range/incomplete-axis checks at supported viewport sizes; verify that critical controls remain reachable and raw/partial evidence is preserved.
- [ ] 2.5 Execute distinct recovery cases for workspace bootstrap failure, page-preview failure, worker-offline or stuck processing, and failed acceptance/correction writes; verify retry and no-false-success behavior.

## 3. Regression and Remediation

- [x] 3.1 Run `pnpm test:eh118`, `pnpm test:eh119`, and `pnpm test:eh121`; attach command output to the EH-124 evidence record.
- [x] 3.2 Triage every failed manual or automated result in GitHub, assigning P0 status to inaccessible blocking controls and linking each defect from the checklist.
- [x] 3.3 For each confirmed in-scope P0 defect, add a focused regression, implement the narrow repair, and rerun the affected manual case and automated suite.

## 4. Release Evidence

- [x] 4.1 Publish the EH-124 regression and triage report with manual results, automated results, environments, artifacts, defect links, and retest evidence.
- [x] 4.2 State the EH-120 dependency outcome and whether the available review workflow—not the unavailable full state machine—meets the release gate.
- [ ] 4.3 Verify the checklist contains no unexecuted passing claim and obtain release-owner acceptance only after P0 failures are resolved or formally dispositioned.
