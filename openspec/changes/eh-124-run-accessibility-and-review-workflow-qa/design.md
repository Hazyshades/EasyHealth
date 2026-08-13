## Context

EH-124 is the Sprint 3 P0 QA gate for the Documents review workspace. EH-118 provides page and source-region provenance, EH-119 provides append-only measurement corrections, and EH-121 provides compact observation change history. Their existing contract suites pass, but the authenticated UI paths have not been executed against representative documents or assistive technology.

The current workspace is rendered by `DocumentViewer` and its source pane, review list/rows, correction form, and history panel. It already exposes recovery controls for initial load, page-preview load, processing/worker availability, and reprocessing. EH-120, a declared dependency, is still open; the current UI does not expose its full verification-state transition model.

## Goals / Non-Goals

**Goals:**

- Produce a repeatable, tester-facing EH-124 checklist using safe, synthetic or de-identified documents.
- Establish evidence for the current review workflow across document provenance, keyboard use, screen-reader use, layout resilience, absent-range handling, and recovery paths.
- Preserve the distinction between automated regression proof, executed manual checks, blocked checks, and defects requiring triage.
- Repair confirmed P0 issues only when they prevent a user from completing an available review workflow accessibly or correctly.

**Non-Goals:**

- Implement EH-120's verification-state machine, rejection/supersession model, batch semantics, or controls that do not yet exist.
- Backfill source regions, introduce OCR for scans, or change the EH-118 page-only fallback.
- Alter raw extraction immutability, correction lineage, history retention, or database schema without a confirmed defect.
- Treat unexecuted local UI checks as passed because static or automated tests pass.

## Decisions

### Use one EH-124 checklist as the release-gate source of manual evidence

The change will create `QA/eh-124/checklist.md` from the roadmap template. It will provide tester-ready preconditions, data identifiers, numbered product-interface steps, expected results, and result fields. Database, static-contract, API-only, and concurrency evidence will remain in a separate developer-evidence section.

**Rationale:** Existing EH-118, EH-119, and EH-121 checklists contain useful feature-level cases but do not create a single executed release-gate record for accessibility and failure recovery.

**Alternative considered:** Mark earlier checklists complete based on their automated evidence. Rejected because their manual UI checks explicitly remain unexecuted.

### Reuse existing synthetic fixtures and extend only for uncovered states

The test matrix will reuse the EH-118 text-layer PDF, scan/image fallback, instrumental report, and legacy/reprocess cases. It will add synthetic fixtures only for long unbroken values, missing ranges, and controlled recovery states.

**Rationale:** Reusing named fixtures maintains provenance coverage without introducing patient data or a second conflicting matrix.

**Alternative considered:** Test arbitrary uploaded reports. Rejected because it is non-reproducible and can expose sensitive data.

### Test the actual accessible interaction, not only markup assertions

Manual execution will cover keyboard focus/order/activation and one supported screen reader/browser pairing. It will verify the labels and announcements of navigation, source selection, correction, history, and recovery controls. Static inspection may identify candidates, but cannot replace the user-facing result.

**Rationale:** The release criterion is absence of inaccessible blocking controls; it is observable only through real interaction.

**Alternative considered:** Add an accessibility library and use it as the sole gate. Rejected because automated scans do not validate keyboard flow, live announcements, or authenticated data states.

### Keep recovery cases distinct

The checklist will separately exercise initial workspace load failure, page-preview failure, worker-offline/stuck processing, and failed write actions. Each must state what is retried and what state must not be falsely reported as successful.

**Rationale:** A single generic offline test can hide that one recovery action leaves the reviewer stranded.

### Make EH-120 an explicit blocked dependency boundary

Any test that requires unavailable EH-120 verification, rejection, supersession, or batch controls will be recorded as `Blocked` with the dependency named. EH-124 will not invent an interface, mark such cases `N/A`, or certify the complete verification workflow.

**Rationale:** It preserves honest release evidence while allowing QA of available P0 paths.

## Risks / Trade-offs

- **[No authenticated/deployed test environment]** → Keep all manual UI checks unexecuted or blocked; attach automated evidence only and do not accept the release gate.
- **[EH-120 remains undelivered]** → Segregate its workflow-state cases as dependency-blocked and escalate the incomplete release scope to the release owner.
- **[A confirmed P0 defect requires code changes]** → Create narrowly scoped remediation tasks, add a regression that reproduces the failure, and rerun the affected manual and automated checks.
- **[Synthetic fixture does not reproduce a visual/document state]** → Record the gap as blocked; do not substitute production data.
- **[Screen-reader behavior differs by platform]** → Record the exact browser, screen reader, version, and operating system with each result.

## Migration Plan

No production migration is planned. The checklist and evidence ship with the release branch. If a verified defect needs a code repair, deploy it through the existing CI path, rerun the relevant regression suite and manual case, and retain both the original defect link and the retest evidence. Rollback follows the normal application deployment rollback; no data transformation is involved.

## Open Questions

- Which authenticated CI or deployed environment will supply the manual test account and run evidence?
- Which browser and screen-reader pairing is the supported accessibility baseline for this release?
- Will EH-120 be delivered before the Sprint 3 release gate, or must the release owner explicitly accept a limited EH-124 scope?
