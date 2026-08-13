## Why

EH-118 source provenance, EH-119 measurement correction, and EH-121 observation history have automated contract evidence, but their authenticated review workspace paths have not been manually verified for accessibility, representative documents, or failure recovery. EH-124 is the P0 release gate for this user-visible data-review loop; it must create auditable QA evidence and triage any release-blocking defect before the Sprint 3 gate can be accepted.

## What Changes

- Add an executable, tester-facing QA plan for the Documents review workspace using only synthetic or de-identified documents.
- Exercise the PDF/image provenance matrix, page and source-region fallbacks, keyboard-only operation, screen-reader names and announcements, long evidence values, absent reference ranges, and processing/page/load retry states.
- Record a regression report that distinguishes automated evidence from manual execution, links every failure to its triage record, and prevents an unexecuted check from being reported as passing.
- Treat EH-120 verification transitions that are not exposed by the current product as blocked dependency coverage, rather than inventing controls or certifying them as passing.
- Remediate only confirmed P0 accessibility or review-workflow defects found by this QA run, then re-run the affected checks and regressions.

## Capabilities

### New Capabilities
- `review-workflow-qa`: Defines release-gate QA evidence for the Documents review workflow, including accessible interaction, representative source-document states, recovery paths, and defect triage.

### Modified Capabilities
- None.

## Impact

- **Domain:** `documents`.
- **Affected interface:** `DocumentViewer`, `DocumentSourcePane`, `ObservationReviewList`, `ObservationReviewRow`, `ObservationCorrectionForm`, and `ObservationChangeHistoryPanel`.
- **Affected evidence:** new `QA/eh-124/checklist.md`, a regression/triage report, and existing `pnpm test:eh118`, `pnpm test:eh119`, and `pnpm test:eh121` suites.
- **Dependencies:** EH-118, EH-120, and EH-121. EH-120 remains an explicit blocker for state-transition cases absent from the UI.
- No schema, API, migration, or patient-data changes are planned unless a confirmed defect requires a narrowly scoped remediation.
